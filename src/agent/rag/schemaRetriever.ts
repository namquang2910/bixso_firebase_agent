/**
 * agent/rag/schemaRetriever.ts
 * RAG-based Firestore schema retrieval.
 * Mirrors the SQL schemaRetriever but works with Firestore collections.
 */

import { searchSchema, getRelationshipHints, getAllRelationshipHints } from "./vectorStore.js";
import { SCHEMA, getCollectionInfo } from "../../db/firestore.js";
import type { RetrievedContext } from "../../types/index.js";

const TOP_K_COLLECTIONS = parseInt(process.env.TOP_K_TABLES ?? "5");

export async function retrieveRelevantSchema(query: string): Promise<RetrievedContext> {
  const results = await searchSchema(query, TOP_K_COLLECTIONS);

  if (results.length === 0) {
    return { contextBlock: "No relevant collections found.", collectionNames: [], joinHints: [], fieldMap: {} };
  }

  const topHits = results
    .map(r => `${r.collectionId} (${(r.score * 100).toFixed(0)}%)`)
    .join(", ");
  console.log("  Finds: " + topHits);

  // Expand with related collections via relationship hints (2-hop)
  const scoreMap = new Map(results.map(r => [r.collectionId, r.score]));
  const retrievedIds = results.map(r => r.collectionId);
  const allRelHints = getAllRelationshipHints();
  const expandedIds = new Set(retrievedIds);

  for (let hop = 0; hop < 2; hop++) {
    for (const hint of allRelHints) {
      if (expandedIds.has(hint.fromCollection)) expandedIds.add(hint.toCollection);
      if (expandedIds.has(hint.toCollection))   expandedIds.add(hint.fromCollection);
    }
  }

  // Build context block
  const contexts: string[] = ["AVAILABLE FIRESTORE COLLECTIONS:", ""];
  const finalIds: string[] = [];
  const joinHintsSet: string[] = [];

  for (const collectionId of expandedIds) {
    const info = getCollectionInfo(collectionId);
    if (!info) continue;

    finalIds.push(collectionId);
    const score = scoreMap.get(collectionId) ?? 0;
    const label = score > 0
      ? `[relevance: ${(score * 100).toFixed(0)}%]`
      : "[related collection]";

    contexts.push(`COLLECTION: ${collectionId}  ${label}`);
    contexts.push(`  Description: ${info.description}`);

    if (info.subcollections?.length) {
      contexts.push(`  Subcollections: ${info.subcollections.join(", ")}`);
      contexts.push(`  Query subcollections using parentCollection + parentDoc args`);
    }

    const fieldList = info.fields
      .map(f => `${f.name} (${f.type})`)
      .join(", ");
    contexts.push(`  Fields: ${fieldList}`);
    contexts.push("");
  }

  // Relationship hints
  const relHints = getRelationshipHints(finalIds);
  if (relHints.length > 0) {
    contexts.push("COLLECTION RELATIONSHIPS (how to join across collections):");
    for (const h of relHints) {
      const hint = `${h.fromCollection}.${h.fromField} → ${h.toCollection}.id`;
      joinHintsSet.push(hint);
      contexts.push(`  ${hint}  (${h.description})`);
    }
    contexts.push("");
  }

  // Field → collection map for ownership section in system prompt
  const fieldMap: Record<string, string> = {};
  for (const colId of finalIds) {
    const info = getCollectionInfo(colId);
    if (!info) continue;
    for (const field of info.fields) {
      if (!fieldMap[field.name]) fieldMap[field.name] = colId;
    }
  }

  return { contextBlock: contexts.join("\n"), collectionNames: finalIds, joinHints: joinHintsSet, fieldMap };
}
