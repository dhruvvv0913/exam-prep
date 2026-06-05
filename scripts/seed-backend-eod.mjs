// One-time: seed the "Economics of Development" subject into the Supabase
// backend library (as a FREE sample). Uses the service_role key, which bypasses
// RLS — run it locally, never ship the key.
//
// Run (PowerShell):
//   $env:SUPABASE_SERVICE_KEY="<your service_role secret>"; node scripts/seed-backend-eod.mjs
// (Supabase → Settings → API → "service_role" secret. Keep it private.)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL || "https://czsenlgujdxgdfckmnff.supabase.co";
const key = process.env.SUPABASE_SERVICE_KEY;
if (!key) {
  console.error("Missing SUPABASE_SERVICE_KEY. Get it from Supabase → Settings → API → service_role (secret).");
  process.exit(1);
}

const sb = createClient(url, key);
const result = JSON.parse(readFileSync("scripts/seed-eod.json", "utf8"));
const meta = {
  id: "eod",
  subject: "Economics of Development",
  code: "HS20120",
  paper_count: result.paperCount,
  question_count: result.questionCount,
  topic_count: (result.groups || []).length,
  is_free: true, // free sample so anyone can open it
};

const r1 = await sb.from("subjects").upsert(meta);
if (r1.error) { console.error(r1.error); process.exit(1); }
const r2 = await sb.from("subject_content").upsert({ subject_id: "eod", content: result });
if (r2.error) { console.error(r2.error); process.exit(1); }
console.log(`Seeded "${meta.subject}" (free) — ${meta.question_count} questions, ${meta.topic_count} topics.`);
