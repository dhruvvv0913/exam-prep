// Backend (Supabase) subject library: protected, admin-managed.
//   subjects         — public metadata (browse without paying)
//   subject_content  — the questions; RLS serves only if free / entitled / admin
//   entitlements     — (email, subject_id) rows granted by the admin
// All access control is enforced server-side by Row-Level Security; these are
// just the queries.
import { supabase } from "../lib/supabase.js";

// --- everyone ----------------------------------------------------------
export async function listSubjects() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("subjects").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Returns the analysis result for a subject, or null if not allowed (locked).
export async function getSubjectContent(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("subject_content").select("content").eq("subject_id", id).maybeSingle();
  if (error) throw error;
  return data?.content || null;
}

// subject_ids the signed-in user is entitled to (own rows only, via RLS).
export async function myEntitlements() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("entitlements").select("subject_id");
  if (error) return [];
  return (data || []).map((r) => r.subject_id);
}

// --- My Library: a signed-in user's own saved analyses (private via RLS) ---
export async function listMySubjects() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("my_subjects")
    .select("id,title,code,paper_count,question_count,topic_count,created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function getMySubject(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("my_subjects").select("content").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.content || null;
}

export async function saveMySubject(meta, content) {
  const { data, error } = await supabase
    .from("my_subjects")
    .insert({ title: meta.title, code: meta.code || null, paper_count: meta.paperCount, question_count: meta.questionCount, topic_count: meta.topicCount, content })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteMySubject(id) {
  const { error } = await supabase.from("my_subjects").delete().eq("id", id);
  if (error) throw error;
}

// --- admin only (RLS rejects non-admins) -------------------------------
export async function publishSubject(meta, content) {
  const { error: e1 } = await supabase.from("subjects").upsert(meta);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("subject_content").upsert({ subject_id: meta.id, content });
  if (e2) throw e2;
}

export async function deleteSubject(id) {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw error;
}

export async function listEntitlements() {
  const { data, error } = await supabase.from("entitlements").select("*").order("granted_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function grantAccess(email, subjectId) {
  const { error } = await supabase.from("entitlements").upsert({ email: email.trim().toLowerCase(), subject_id: subjectId });
  if (error) throw error;
}

export async function revokeAccess(email, subjectId) {
  const { error } = await supabase.from("entitlements").delete().eq("email", email.trim().toLowerCase()).eq("subject_id", subjectId);
  if (error) throw error;
}
