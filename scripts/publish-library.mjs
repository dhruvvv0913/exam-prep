// Admin-only: publish a grouping result (e.g. scripts/llm-groups.out.json from
// llm-group.mjs) into the Supabase library as a subject. Uses the service_role
// key, which bypasses RLS — run it LOCALLY, never ship/commit the key.
//
//   $env:SUPABASE_SERVICE_KEY="<service_role secret>"   # or put it in .env
//   node --env-file=.env scripts/publish-library.mjs \
//        --id=coa --subject="Computer Organisation & Architecture" --code=CS21002 \
//        [--in=scripts/llm-groups.out.json] [--paid] [--papers=N]
//
// (Supabase → Settings → API → "service_role" secret. Keep it private.)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const opt = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split("=")[1] : d; };
const has = (n) => process.argv.includes(`--${n}`);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://czsenlgujdxgdfckmnff.supabase.co";
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("Missing SUPABASE_SERVICE_KEY (Supabase → Settings → API → service_role). Put it in .env (local only) and run with --env-file=.env."); process.exit(1); }

const id = opt("id");
const subject = opt("subject");
if (!id || !subject) { console.error('usage: node --env-file=.env scripts/publish-library.mjs --id=coa --subject="..." [--code=...] [--in=...] [--paid] [--papers=N]'); process.exit(1); }

const inPath = opt("in", "scripts/llm-groups.out.json");
const parsed = JSON.parse(readFileSync(inPath, "utf8"));
const groups = parsed.groups || [];
if (!groups.length) { console.error(`No groups in ${inPath}`); process.exit(1); }

const items = groups.flatMap((g) => g.items || []);
const questionCount = items.length;
const paperCount = Number(opt("papers")) || new Set(items.map((it) => it.pIdx)).size;
const topicCount = groups.length;

// content must be the shape the app's analysis screen consumes (it reads
// data.groups via summarize(), plus paper/question counts in the top bar).
const content = { groups, questionCount, paperCount, topicCount, papers: [] };
const meta = {
  id,
  subject,
  code: opt("code", null),
  paper_count: paperCount,
  question_count: questionCount,
  topic_count: topicCount,
  is_free: !has("paid"), // free by default (current launch strategy)
};

const sb = createClient(url, key);
const r1 = await sb.from("subjects").upsert(meta);
if (r1.error) { console.error("subjects upsert failed:", r1.error.message); process.exit(1); }
const r2 = await sb.from("subject_content").upsert({ subject_id: id, content });
if (r2.error) { console.error("subject_content upsert failed:", r2.error.message); process.exit(1); }

console.log(`Published "${subject}" [${id}] (${meta.is_free ? "free" : "paid"}) — ${questionCount} questions, ${topicCount} topics, ${paperCount} papers.`);
