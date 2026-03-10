/**
 * agent/rag/vectorStore.ts
 * Firestore schema vector store — same hybrid-scoring approach as the SQL version.
 *
 * Instead of indexing SQL table schemas, we index Firestore collection definitions
 * from the static SCHEMA in db/firestore.ts.
 *
 * Scoring: vector similarity + keyword overlap (table-level + field-level)
 */

import { SCHEMA, getCollectionInfo } from "../../db/firestore.js";
import type {
  CollectionDocument,
  FieldDocument,
  SearchResult,
  RelationshipHint,
  FieldInfo,
} from "../../types/index.js";
import {
  buildCollectionText,
  buildFieldText,
  buildRelationshipHints,
  embedText,
  cosine,
  keywordScore,
} from "./utils.js";

// ─── Store state ──────────────────────────────────────────────────────────────

let _collectionDocs: CollectionDocument[] = [];
let _relationshipHints: RelationshipHint[] = [];
let _indexed = false;

// ─── Indexing ─────────────────────────────────────────────────────────────────

export async function indexSchema(): Promise<void> {
  if (_indexed) return;

  console.log(`\n📐 Indexing ${SCHEMA.length} Firestore collections (collection + field embeddings)...`);

  const docs: CollectionDocument[] = [];

  for (const colInfo of SCHEMA) {
    try {
      // Collection-level embedding
      const colText      = buildCollectionText(colInfo);
      const colEmbedding = await embedText(colText);

      // Field-level embeddings
      const fieldDocs: FieldDocument[] = [];
      for (const field of colInfo.fields) {
        const fieldText = buildFieldText(colInfo.collectionId, field);
        const fieldEmb  = await embedText(fieldText);
        fieldDocs.push({
          collectionId: colInfo.collectionId,
          fieldName: field.name,
          text: fieldText,
          embedding: fieldEmb,
        });
      }

      const fieldDetails = colInfo.fields
        .map(f => `${f.name} (${f.type})`)
        .join(", ");

      docs.push({
        collectionId:       colInfo.collectionId,
        fields:             colInfo.fields,
        fieldDetails,
        collectionEmbedding: colEmbedding,
        fieldDocs,
        sampleDoc:          null,
      });

      process.stdout.write(`  ✓ ${colInfo.collectionId} (${colInfo.fields.length} fields)\n`);
    } catch (err) {
      console.warn(`  ⚠ Skipped ${colInfo.collectionId}: ${err}`);
    }
  }

  _collectionDocs   = docs;
  _relationshipHints = buildRelationshipHints(SCHEMA);
  _indexed = true;

  console.log(`✅ Vector store ready — ${docs.length} collections, ${_relationshipHints.length} relationships detected\n`);
}

// ─── Hybrid search ────────────────────────────────────────────────────────────

export async function searchSchema(query: string, topK = 5): Promise<SearchResult[]> {
  if (!_indexed) throw new Error("Call indexSchema() first.");

  const queryEmb = await embedText(query);
  const results: SearchResult[] = [];

  for (const doc of _collectionDocs) {
    // 1. Collection-level vector similarity
    const colSim = cosine(queryEmb, doc.collectionEmbedding);

    // 2. Best field-level similarity
    let bestFieldSim = 0;
    const matchedFields: string[] = [];

    for (const fieldDoc of doc.fieldDocs) {
      const sim = cosine(queryEmb, fieldDoc.embedding);
      if (sim > bestFieldSim) bestFieldSim = sim;
      if (sim > 0.60) matchedFields.push(fieldDoc.fieldName);
    }

    // 3. Keyword overlap on collection name and field names
    const colKeyword   = keywordScore(query, doc.collectionId);
    const fieldKeyword = Math.max(0, ...doc.fields.map(f => keywordScore(query, f.name)));

    // Hybrid score — same formula as SQL version
    const score = (
      colSim       * 0.25 +
      bestFieldSim * 0.50 +
      colKeyword   * 0.15 +
      fieldKeyword * 0.10
    );

    results.push({
      collectionId:   doc.collectionId,
      fields:         doc.fields,
      matchedFields,
      score,
      sampleData:     doc.sampleDoc ?? undefined,
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(r => r.score > 0.20);
}

// ─── Relationship helpers ─────────────────────────────────────────────────────

export function getRelationshipHints(collectionIds: string[]): RelationshipHint[] {
  const set = new Set(collectionIds);
  return _relationshipHints.filter(h => set.has(h.fromCollection) && set.has(h.toCollection));
}

export function getAllRelationshipHints(): RelationshipHint[] {
  return _relationshipHints;
}

// ─── Re-index a single collection ────────────────────────────────────────────

export async function reindexCollection(collectionId: string): Promise<void> {
  const colInfo = getCollectionInfo(collectionId);
  if (!colInfo) throw new Error(`Collection "${collectionId}" not found in schema.`);

  const colText      = buildCollectionText(colInfo);
  const colEmbedding = await embedText(colText);

  const fieldDocs: FieldDocument[] = [];
  for (const field of colInfo.fields) {
    const fieldText = buildFieldText(collectionId, field);
    const fieldEmb  = await embedText(fieldText);
    fieldDocs.push({ collectionId, fieldName: field.name, text: fieldText, embedding: fieldEmb });
  }

  const fieldDetails = colInfo.fields.map(f => `${f.name} (${f.type})`).join(", ");
  const doc: CollectionDocument = {
    collectionId,
    fields: colInfo.fields,
    fieldDetails,
    collectionEmbedding: colEmbedding,
    fieldDocs,
    sampleDoc: null,
  };

  const idx = _collectionDocs.findIndex(d => d.collectionId === collectionId);
  if (idx >= 0) _collectionDocs[idx] = doc;
  else _collectionDocs.push(doc);

  _relationshipHints = buildRelationshipHints(SCHEMA);
}
