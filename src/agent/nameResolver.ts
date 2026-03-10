
import { executeQuery } from "../db/database.js";
import { buildSystemPrompt } from "./prompts.js";
import {type NameHint, type Candidate} from "../types/index.js";

const NAME_TABLES = [
  { table: "customers",  first: "first_name", last: "last_name" },
  { table: "users",      first: "first_name", last: "last_name" },
  { table: "employees",  first: "first_name", last: "last_name" },
  { table: "contacts",   first: "first_name", last: "last_name" },
  { table: "people",     first: "first_name", last: "last_name" },
  { table: "members",    first: "first_name", last: "last_name" },
];

// ─── Name extraction ──────────────────────────────────────────────────────────

function extractNameFromQuery(query: string): NameHint | null {
  const patterns = [
    /\bof\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
    /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
    /\bnamed?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    /\bcalled\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\'s\b/,
    /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/,
  ];

  const nameColumns = ["first_name", "last_name", "username", "name", "full_name"];

  for (const pattern of patterns) {
    const m = query.match(pattern);
    if (!m || !m[1]) continue;

    const raw   = m[1].trim();
    const parts = raw.split(/\s+/);
    let whereClause: string;

    if (parts.length === 1) {
      whereClause = nameColumns
        .map(function(col) { return col + " LIKE '%" + parts[0] + "%'"; })
        .join(" OR ");
    } else {
      const firstLast = "(first_name LIKE '%" + parts[0] + "%' AND last_name LIKE '%" + parts[parts.length - 1] + "%')";
      const fullInAny = nameColumns
        .map(function(col) { return col + " LIKE '%" + raw + "%'"; })
        .join(" OR ");
      whereClause = firstLast + " OR (" + fullInAny + ")";
    }

    return { raw, parts, whereClause, nameTable: null };
  }
  return null;
}

// ─── Candidate lookup ─────────────────────────────────────────────────────────
// Query the DB directly to find all people matching the partial name.

async function lookupNameCandidates(partial: string): Promise<Candidate[]> {
  const term = partial.trim();
  const candidates: Candidate[] = [];

  for (const def of NAME_TABLES) {
    const sql = [
      "SELECT * FROM " + def.table,
      "WHERE " + def.first + " LIKE '%" + term + "%'",
      "   OR " + def.last  + " LIKE '%" + term + "%'",
      "LIMIT 10",
    ].join(" ");

    try {
      const result = await executeQuery(sql);
      for (const row of result.rows) {
        const first = String(row[def.first] ?? "");
        const last  = String(row[def.last]  ?? "");
        const fullName = (first + " " + last).trim();
        if (fullName) {
          candidates.push({ fullName, table: def.table, row });
        }
      }
      // If we found candidates in this table, stop searching further tables
      if (candidates.length > 0) break;
    } catch {
      // Table doesn't exist in this DB — skip silently
    }
  }

  // Deduplicate by fullName
  const seen = new Set<string>();
  return candidates.filter(function(c) {
    if (seen.has(c.fullName)) return false;
    seen.add(c.fullName);
    return true;
  });
}