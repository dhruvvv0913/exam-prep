// Auth context: exposes the signed-in user, admin status, and sign in/out.
// Sign-in is OPTIONAL — the free self-upload flow never requires it. Auth gates
// admin powers now, and (later) paid library access.
//
// NOTE: the client-side `isAdmin` (email match) only controls what UI we show.
// Real enforcement of admin-only writes / paid content happens server-side via
// Supabase Row-Level Security in a later phase — never trust the client.
import React from "react";
import { supabase, supabaseEnabled } from "./lib/supabase.js";

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();

const AuthCtx = React.createContext({
  enabled: false, ready: true, user: null, isAdmin: false,
  signInWithGoogle: () => {}, signOut: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [ready, setReady] = React.useState(!supabaseEnabled);

  React.useEffect(() => {
    if (!supabaseEnabled) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    enabled: supabaseEnabled,
    ready,
    user,
    isAdmin: !!ADMIN_EMAIL && (user?.email || "").toLowerCase() === ADMIN_EMAIL,
    signInWithGoogle: () =>
      supabaseEnabled &&
      supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } }),
    signOut: () => supabaseEnabled && supabase.auth.signOut(),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => React.useContext(AuthCtx);
