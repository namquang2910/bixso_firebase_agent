/**
 * tools/firestoretool.ts
 * Defines the Firestore query/write tools the AI agent can call.
 * Replaces the SQL-based sqltool.ts.
 *
 * The agent outputs a JSON tool call block; this module parses and executes it.
 *
 * TOOL 1: query_collection   — read documents from a collection
 * TOOL 2: update_document    — update fields on a document (guarded)
 */

import { executeQuery, executeWrite } from "../db/firestore.js";
import type { FirestoreQuery } from "../db/firestore.js";

const BACKTICK = "\x60";
const TRIPLE   = BACKTICK + BACKTICK + BACKTICK;

// ─── Tool call extraction (same pattern as original) ─────────────────────────

export function extractToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  // Match ```tool ... ``` block
  const toolBlock = text.match(new RegExp(TRIPLE + "tool\\s*([\\s\\S]*?)" + TRIPLE));
  if (toolBlock) {
    try { return JSON.parse(toolBlock[1].trim()); } catch { /* next */ }
  }

  // Match ```json ... ``` block
  const jsonBlock = text.match(new RegExp(TRIPLE + "(?:json)?\\s*([\\s\\S]*?)" + TRIPLE));
  if (jsonBlock) {
    try {
      const p = JSON.parse(jsonBlock[1].trim());
      if (p?.tool) return p;
    } catch { /* next */ }
  }

  // Bare JSON object scan
  const start = text.search(/\{[\s\S]*?"tool"\s*:/);
  if (start !== -1) {
    let depth = 0, end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try {
        const p = JSON.parse(text.slice(start, end + 1));
        if (p?.tool) return p;
      } catch { /* ignore */ }
    }
  }
  return null;
}

// ─── Tool: query_collection ───────────────────────────────────────────────────

async function runQueryCollection(args: Record<string, unknown>): Promise<unknown> {
  const collection = String(args.collection ?? "");
  if (!collection) {
    return { error: "Missing required field: collection. Provide the Firestore collection name." };
  }

  const query: FirestoreQuery = {
    collection,
    parentCollection: args.parentCollection as string | undefined,
    parentDoc: args.parentDoc as string | undefined,
    collectionGroup: Boolean(args.collectionGroup ?? false),
    limit: Number(args.limit ?? 50),
  };

  // Parse where clauses
  if (Array.isArray(args.where)) {
    query.where = (args.where as Array<Record<string, unknown>>).map(w => ({
      field: String(w.field),
      op: String(w.op) as FirebaseFirestore.WhereFilterOp,
      value: w.value,
    }));
  }

  // Parse orderBy
  if (Array.isArray(args.orderBy)) {
    query.orderBy = (args.orderBy as Array<Record<string, unknown>>).map(o => ({
      field: String(o.field),
      direction: (o.direction as "asc" | "desc") ?? "asc",
    }));
  }

  try {
    const result = await executeQuery(query);
    console.log(`  query_collection(${result.collectionPath}) -> ${result.totalCount} docs`);
    return { docs: result.docs, docCount: result.totalCount, collectionPath: result.collectionPath };
  } catch (err) {
    return { error: String(err) };
  }
}

// ─── Tool: update_document ────────────────────────────────────────────────────

async function runUpdateDocument(args: Record<string, unknown>): Promise<unknown> {
  const collectionPath = String(args.collectionPath ?? "");
  const docId          = String(args.docId ?? "");
  const fields         = (args.fields ?? {}) as Record<string, unknown>;
  const intent         = String(args.confirmIntent ?? args.intent ?? "no intent given");

  if (!collectionPath || !docId) {
    return { error: "Missing required fields: collectionPath and docId." };
  }
  if (Object.keys(fields).length === 0) {
    return { error: "No fields to update provided." };
  }

  const result = await executeWrite(collectionPath, docId, fields);

  if (result.success) {
    console.log(`  AUDIT: ${intent} | ${collectionPath}/${docId} | fields: ${result.updatedFields?.join(", ")}`);
  }

  return result;
}

// ─── Tool registry ────────────────────────────────────────────────────────────

export const TOOLS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  query_collection: runQueryCollection,
  update_document:  runUpdateDocument,
};
