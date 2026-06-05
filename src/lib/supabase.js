// Supabase client. Reads config from Vite env (VITE_SUPABASE_*). If those
// aren't set, the app still runs fully in its free, client-side mode — auth
// features just stay hidden (supabaseEnabled === false).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anon);
export const supabase = supabaseEnabled ? createClient(url, anon) : null;
