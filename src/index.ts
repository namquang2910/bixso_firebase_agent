/**
 * index.ts — CLI entry point with disambiguation support
 */

import "dotenv/config";
import readline from "readline";
import { initAgent, askAgent, sqlAgentFlow} from "./agent/agent.js";
import {type DisambiguationResult} from "./types/index.js";
import { getAllTableNames, getTableSchema } from "./db/database.js";

const ollamaModel  = process.env.OLLAMA_MODEL ?? "llama3.2";
const embedModel   = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const ollamaServer = process.env.OLLAMA_SERVER_ADDRESS ?? "http://localhost:11434";

console.log("\n🦙 LLM model:   " + ollamaModel);
console.log("📐 Embed model: " + embedModel);
console.log("🌐 Server:      " + ollamaServer);
console.log("\n   Make sure both models are pulled:");
console.log("   ollama pull " + ollamaModel);
console.log("   ollama pull " + embedModel + "\n");

const WELCOME = `
╔══════════════════════════════════════════════════════════╗
║        🤖  SQL AI Agent  — RAG-powered by Genkit         ║
╠══════════════════════════════════════════════════════════╣
║  /tables [filter]  List tables                           ║
║  /schema <table>   Show table schema                     ║
║  /clear            Clear conversation history            ║
║  /exit             Exit                                  ║
╚══════════════════════════════════════════════════════════╝
`;

async function main() {
  await initAgent();
  console.log(WELCOME);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history: { role: "user" | "model"; content: string }[] = [];
  const prompt = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  while (true) {
    const input = (await prompt("\n🧑 You: ")).trim();
    if (!input) continue;

    // ── Slash commands (only when not in disambiguation) ──────────────────────
    if (input === "/exit" || input === "/quit") {
      console.log("\nGoodbye! 👋\n");
      rl.close();
      process.exit(0);
    }

    if (input === "/clear") {
      history.length = 0;
      console.log("✅ History cleared.");
      continue;
    }

    if (input.startsWith("/tables")) {
      const filter = input.split(" ").slice(1).join(" ") || undefined;
      const tables = await getAllTableNames(filter);
      console.log("\n📋 " + tables.length + " tables:\n  " + tables.join(", "));
      continue;
    }

    if (input.startsWith("/schema ")) {
      const name = input.slice(8).trim();
      try {
        const s = await getTableSchema(name);
        console.log("\n📊 " + name + " (" + s.rowCount + " rows):");
        s.columns.forEach(c => {
          const f = [c.primaryKey ? "PK" : null, c.notNull ? "NOT NULL" : null]
            .filter(Boolean).join(", ");
          console.log("  " + c.name.padEnd(25) + c.type.padEnd(15) + f);
        });
      } catch (e) { console.log("❌ " + e); }
      continue;
    }

    // ── Normal query ──────────────────────────────────────────────────────────
    console.log("\n🤖 Agent: (thinking...)\n");
    try {
      const result = await askAgent(input, history);

      if (result.type === "answer") {
        history.push({ role: "user", content: input });
        history.push({ role: "model", content: result.text });
        if (history.length > 20) history.splice(0, 2);
        console.log("🤖 Agent:\n\n" + result.text + "\n");
      }

    } catch (err) {
      console.error("\n❌ Error: " + err + "\n");
    }
  }
}

function showDisambiguation(d: DisambiguationResult): void {
  console.log("\n🔀 Found " + d.candidates.length + " people matching \"" + d.partial + "\":");
  d.candidates.forEach(function(c, i) {
    console.log("  " + (i + 1) + ". " + c.fullName);
  });
  console.log("\nWhich one did you mean? (Enter a number, type their name, or \"cancel\")");
}

export { sqlAgentFlow };
main().catch(err => { console.error("Fatal:", err); process.exit(1); });
