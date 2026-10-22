const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

async function run() {
  const { data: blocks } = await sb.from("blocks").select("id, order_index, title");
  const { data: topics } = await sb.from("topics").select("id, order_index, title, block_id");
  const { data: subs } = await sb.from("subtopics").select("id, order_index, title, topic_id");
  const { data: questions } = await sb.from("questions").select("id, subtopic_id");
  const { data: fc } = await sb.from("flashcards").select("id, subtopic_id");
  console.log("BLOCKS:", blocks?.length, JSON.stringify(blocks));
  console.log("TOPICS:", topics?.length, JSON.stringify(topics));
  console.log("SUBTOPICS:", subs?.length, JSON.stringify(subs));
  console.log("QUESTIONS:", questions?.length);
  console.log("FLASHCARDS:", fc?.length);
}
run();
