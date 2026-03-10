/**
 * agent/rag/utils.ts
 * Embedding and scoring utilities for the Firestore schema RAG.
 * Same approach as the SQL version — vector + keyword hybrid scoring.
 */

import type { CollectionInfo, FieldInfo, CollectionDocument, RelationshipHint } from "../../types/index.js";

const OLLAMA_SERVER = process.env.OLLAMA_SERVER_ADDRESS ?? "http://localhost:11434";
const EMBED_MODEL   = process.env.OLLAMA_EMBED_MODEL   ?? "nomic-embed-text";

// ─── Embedding ────────────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_SERVER}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Ollama embed failed (${res.status}): ${err}\n` +
      `Make sure you have pulled: ollama pull ${EMBED_MODEL}`
    );
  }
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Keyword overlap ──────────────────────────────────────────────────────────

export function keywordScore(query: string, target: string): number {
  const qWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const tWords = target.toLowerCase().split(/\W+/);
  if (qWords.length === 0) return 0;
  const hits = qWords.filter(w => tWords.some(t => t.includes(w) || w.includes(t)));
  return hits.length / qWords.length;
}

// ─── Text builders for embedding ─────────────────────────────────────────────

export function buildFieldText(collectionId: string, field: FieldInfo, sampleValue?: unknown): string {
  const humanName = field.name.replace(/_/g, " ");
  const sample = sampleValue !== undefined && sampleValue !== null
    ? ` Example value: ${JSON.stringify(sampleValue)}.`
    : "";
  return (
    `Field "${field.name}" (${humanName}) in Firestore collection "${collectionId}". ` +
    `Type: ${field.type}. ${field.description}.${sample}`
  );
}

export function buildCollectionText(info: CollectionInfo, sampleDoc?: Record<string, unknown> | null): string {
  const fieldSummary = info.fields
    .map(f => `${f.name.replace(/_/g, " ")} (${f.type})`)
    .join(", ");

  const sampleStr = sampleDoc
    ? ` Sample document: ${Object.entries(sampleDoc).slice(0, 5).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}.`
    : "";

  const subs = info.subcollections?.length
    ? ` Subcollections: ${info.subcollections.join(", ")}.`
    : "";

  return (
    `Firestore collection "${info.collectionId}": ${info.description}` +
    `${subs} Fields: ${fieldSummary}.${sampleStr}`
  );
}

// ─── Relationship hints (like FK hints in SQL version) ────────────────────────
// Infers relationships from fields ending in "Id" that match collection names.

export function buildRelationshipHints(allCollections: CollectionInfo[]): RelationshipHint[] {
  const collectionIds = new Set(allCollections.map(c => c.collectionId));
  const hints: RelationshipHint[] = [];

  for (const col of allCollections) {
    for (const field of col.fields) {
      // Pattern: someCollectionId or someCollectionSingularId
      const m = field.name.match(/^(.+)Id$/);
      if (!m) continue;
      const base = m[1]; // e.g. "course", "instructor", "user"

      for (const candidate of [base, base + "s", base.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()]) {
        if (collectionIds.has(candidate) && candidate !== col.collectionId) {
          hints.push({
            fromCollection: col.collectionId,
            fromField: field.name,
            toCollection: candidate,
            toField: "id",
            description: `${col.collectionId}.${field.name} references ${candidate} document ID`,
          });
          break;
        }
      }
    }
  }

  return hints;
}
