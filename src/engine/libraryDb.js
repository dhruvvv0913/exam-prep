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

// --- community contributions (students submit; admin reviews) -----------
const slug = (s) => (s || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "subject";

// A soft cap on how many contributions one user can have awaiting review, so a
// single user can't flood the admin queue. Enforced here (client + RLS lets the
// user read their own rows); the admin can always approve/reject to free slots.
const MAX_PENDING_CONTRIBUTIONS = 10;

// Any signed-in user can submit. `targetSubjectId` set => "pool into" that
// subject; null => propose a brand-new subject.
export async function submitContribution(meta, content, targetSubjectId = null) {
  if (!supabase) throw new Error("Sign-in required");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign-in required");
  // Soft per-user cap. Count only this user's still-pending rows; fail open on a
  // count error so a transient hiccup never blocks a legitimate submission.
  const { count, error: countErr } = await supabase
    .from("contributions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (!countErr && (count || 0) >= MAX_PENDING_CONTRIBUTIONS)
    throw new Error(`You already have ${count} contributions awaiting review — please wait for those before sending more.`);
  const { error } = await supabase.from("contributions").insert({
    email: user.email || null, title: meta.title, code: meta.code || null,
    target_subject_id: targetSubjectId, content,
  });
  if (error) throw error;
}

export async function listContributions() { // admin only (RLS)
  const { data, error } = await supabase.from("contributions").select("*").eq("status", "pending").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Append one analysis's groups into another's, re-basing pIdx so paper counts
// don't collide. Same-topic groups are NOT auto-merged — the admin tidies those
// in the review screen afterward.
function mergeContent(target, add) {
  const tGroups = target.groups || [];
  const maxP = Math.max(-1, ...tGroups.flatMap((g) => g.items.map((it) => it.pIdx ?? 0)));
  const offset = maxP + 1;
  const shifted = (add.groups || []).map((g) => ({
    ...g,
    items: g.items.map((it) => { const p = (it.pIdx ?? 0) + offset; return { ...it, pIdx: p, uid: `${p}__${it.id}` }; }),
  }));
  const groups = [...tGroups, ...shifted].map((g, i) => ({ ...g, id: `g${i}` }));
  const questionCount = groups.reduce((n, g) => n + g.items.length, 0);
  const paperCount = new Set(groups.flatMap((g) => g.items.map((it) => it.pIdx))).size;
  return { papers: [...(target.papers || []), ...(add.papers || [])], groups, questionCount, paperCount, topicCount: groups.length };
}

export async function approveContribution(c) {
  if (c.target_subject_id) {
    const target = (await getSubjectContent(c.target_subject_id)) || { groups: [], papers: [] };
    const merged = mergeContent(target, c.content);
    const r1 = await supabase.from("subject_content").upsert({ subject_id: c.target_subject_id, content: merged });
    if (r1.error) throw r1.error;
    const r2 = await supabase.from("subjects").update({ question_count: merged.questionCount, paper_count: merged.paperCount, topic_count: merged.topicCount }).eq("id", c.target_subject_id);
    if (r2.error) throw r2.error;
  } else {
    await publishSubject(
      { id: slug(c.title), subject: c.title, code: c.code || null, paper_count: c.content.paperCount, question_count: c.content.questionCount, topic_count: (c.content.groups || []).length, is_free: true },
      c.content
    );
  }
  const { error } = await supabase.from("contributions").update({ status: "approved" }).eq("id", c.id);
  if (error) throw error;
}

export async function rejectContribution(id) {
  const { error } = await supabase.from("contributions").update({ status: "rejected" }).eq("id", id);
  if (error) throw error;
}
