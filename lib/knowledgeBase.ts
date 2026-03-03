/**
 * Knowledge Base utility — searches the Nyra health KB using
 * Pinecone vector search (semantic) with a keyword-based fallback.
 *
 * Uses direct REST API calls (no Pinecone SDK) to stay React Native compatible.
 */

import knowledgeBaseData from "../data/knowledge_base.json";

export interface KBEntry {
  id: string;
  source_file: string;
  source_url: string;
  title: string;
  summary: string;
  keywords: string[];
}

const entries: KBEntry[] = knowledgeBaseData as KBEntry[];

// ── Pinecone config (REST API, no SDK) ──────────────────────
const PINECONE_INDEX_HOST =
  "https://nyra-health-kb-jygsyxm.svc.aped-4627-b74a.pinecone.io";
const EMBEDDING_MODEL = "text-embedding-3-small";

// ── Embed query via OpenAI ──────────────────────────────────
async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// ── Pinecone vector search (REST API) ───────────────────────
interface PineconeMatch {
  id: string;
  score: number;
  metadata?: Record<string, string>;
}

async function vectorSearch(
  query: string,
  limit: number
): Promise<KBEntry[]> {
  const apiKey = process.env.EXPO_PUBLIC_PINECONE_API_KEY;
  if (!apiKey) throw new Error("Pinecone not configured");

  const queryVector = await embedQuery(query);

  const res = await fetch(`${PINECONE_INDEX_HOST}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      vector: queryVector,
      topK: limit,
      includeMetadata: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone query ${res.status}: ${err}`);
  }

  const data = await res.json();

  return ((data.matches || []) as PineconeMatch[]).map((match) => ({
    id: match.id,
    source_file: "",
    source_url: match.metadata?.source_url || "",
    title: match.metadata?.title || "",
    summary: match.metadata?.summary || "",
    keywords: (match.metadata?.keywords || "").split(", ").filter(Boolean),
  }));
}

// ── Keyword fallback (original logic) ───────────────────────
const STOP_WORDS = new Set([
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should",
  "can", "could", "may", "might", "shall", "must",
  "a", "an", "the", "and", "but", "or", "nor", "not", "no",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
  "this", "that", "these", "those", "what", "which", "who", "whom",
  "how", "when", "where", "why", "if", "then", "so", "than",
  "about", "up", "out", "into", "over", "after", "before",
  "just", "also", "very", "much", "more", "some", "any", "all",
  "tell", "please", "know", "want", "need", "help", "get",
  "kya", "hai", "mujhe", "mere", "mera", "meri", "ka", "ke", "ki",
  "ko", "se", "ne", "ho", "hota", "kaise", "kuch", "bhi",
  "batao", "bata", "de", "do", "kar", "karo",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

interface IndexedEntry {
  entry: KBEntry;
  titleTokens: Set<string>;
  keywordSet: Set<string>;
  summaryTokens: Set<string>;
}

const keywordIndex: IndexedEntry[] = entries.map((entry) => ({
  entry,
  titleTokens: new Set(tokenize(entry.title)),
  keywordSet: new Set(entry.keywords.map((k) => k.toLowerCase())),
  summaryTokens: new Set(tokenize(entry.summary)),
}));

function keywordSearch(query: string, limit: number): KBEntry[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const results: { entry: KBEntry; score: number }[] = [];

  for (const indexed of keywordIndex) {
    let score = 0;

    for (const token of queryTokens) {
      if (indexed.titleTokens.has(token)) score += 5;
      for (const kw of indexed.keywordSet) {
        if (kw === token || kw.includes(token) || token.includes(kw)) {
          score += 4;
          break;
        }
      }
      if (indexed.summaryTokens.has(token)) score += 1;
    }

    const matchedTokenCount = queryTokens.filter(
      (t) =>
        indexed.titleTokens.has(t) ||
        [...indexed.keywordSet].some((kw) => kw.includes(t) || t.includes(kw)) ||
        indexed.summaryTokens.has(t)
    ).length;

    if (matchedTokenCount > 1) score += matchedTokenCount * 2;
    if (score > 0) results.push({ entry: indexed.entry, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry);
}

// ── Public API ──────────────────────────────────────────────

/**
 * Search the knowledge base for entries relevant to the query.
 * Uses Pinecone vector search, falls back to keyword search on failure.
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 3
): Promise<KBEntry[]> {
  try {
    const results = await vectorSearch(query, limit);
    if (results.length > 0) return results;
  } catch (err) {
    console.warn("[KB] Vector search failed, using keyword fallback:", err);
  }

  return keywordSearch(query, limit);
}

/**
 * Format KB results as a context block for the system prompt.
 * Returns empty string if no relevant entries found.
 */
export async function formatKBContext(
  query: string,
  limit: number = 3
): Promise<string> {
  const results = await searchKnowledgeBase(query, limit);
  if (results.length === 0) return "";

  const blocks = results.map((entry, i) => {
    const summary =
      entry.summary.length > 800
        ? entry.summary.substring(0, 800).replace(/\s+\S*$/, "") + "..."
        : entry.summary;

    return `[${i + 1}] ${entry.title}\n${summary}`;
  });

  return `\n\nRelevant health knowledge (use this to inform your response — do NOT quote it verbatim, just use the facts naturally):\n${blocks.join("\n\n")}`;
}

export { entries as allEntries };
