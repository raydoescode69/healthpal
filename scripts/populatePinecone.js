/**
 * One-time script to populate Pinecone with knowledge base embeddings.
 *
 * Usage:
 *   EXPO_PUBLIC_OPENAI_API_KEY=sk-... EXPO_PUBLIC_PINECONE_API_KEY=pcsk_... node scripts/populatePinecone.js
 *
 * Re-run whenever data/knowledge_base.json changes.
 */

const { Pinecone } = require("@pinecone-database/pinecone");
const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────
const INDEX_NAME = "nyra-health-kb";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const BATCH_SIZE = 50;

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.EXPO_PUBLIC_PINECONE_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
  process.exit(1);
}
if (!PINECONE_API_KEY) {
  console.error("Missing EXPO_PUBLIC_PINECONE_API_KEY");
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────
async function getEmbeddings(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen).replace(/\s+\S*$/, "") + "...";
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  // 1. Load knowledge base
  const kbPath = path.join(__dirname, "..", "data", "knowledge_base.json");
  const entries = JSON.parse(fs.readFileSync(kbPath, "utf-8"));
  console.log(`Loaded ${entries.length} KB entries`);

  // 2. Initialize Pinecone
  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });

  // 3. Create index if it doesn't exist
  const existingIndexes = await pc.listIndexes();
  const indexNames = (existingIndexes.indexes || []).map((i) => i.name);

  if (!indexNames.includes(INDEX_NAME)) {
    console.log(`Creating index "${INDEX_NAME}"...`);
    await pc.createIndex({
      name: INDEX_NAME,
      dimension: EMBEDDING_DIM,
      metric: "cosine",
      spec: { serverless: { cloud: "aws", region: "us-east-1" } },
    });
    // Wait for index to be ready
    console.log("Waiting for index to initialize...");
    let ready = false;
    while (!ready) {
      await new Promise((r) => setTimeout(r, 5000));
      const desc = await pc.describeIndex(INDEX_NAME);
      ready = desc.status?.ready === true;
      if (!ready) process.stdout.write(".");
    }
    console.log("\nIndex ready!");
  } else {
    console.log(`Index "${INDEX_NAME}" already exists`);
  }

  const index = pc.index(INDEX_NAME);

  // 4. Embed and upsert in batches
  let totalUpserted = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const texts = batch.map((e) => `${e.title} ${e.summary}`);

    console.log(
      `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)} (${batch.length} entries)...`
    );

    const embeddings = await getEmbeddings(texts);

    const vectors = batch.map((entry, j) => ({
      id: entry.id,
      values: embeddings[j],
      metadata: {
        title: entry.title,
        summary: truncate(entry.summary, 800),
        source_url: entry.source_url || "",
        keywords: (entry.keywords || []).join(", "),
      },
    }));

    await index.upsert({ records: vectors });
    totalUpserted += vectors.length;
    console.log(`  Upserted ${totalUpserted}/${entries.length}`);
  }

  console.log(`\nDone! ${totalUpserted} vectors upserted to "${INDEX_NAME}"`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
