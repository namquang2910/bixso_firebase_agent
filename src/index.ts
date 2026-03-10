/**
 * index.ts — CLI entry point for the CourseAI Firestore Agent
 */

import "dotenv/config";
import readline from "readline";
import { initAgent, askAgent, courseAgentFlow } from "./agent/agent.js";
import { getAllCollectionNames, getCollectionInfo } from "./db/firestore.js";

const ollamaModel  = process.env.OLLAMA_MODEL  ?? "llama3.2";
const embedModel   = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const ollamaServer = process.env.OLLAMA_SERVER_ADDRESS ?? "http://localhost:11434";

console.log("\n🦙 LLM model:   " + ollamaModel);
console.log("📐 Embed model: " + embedModel);
console.log("🌐 Server:      " + ollamaServer);
console.log("\n   Make sure both models are pulled:");
console.log("   ollama pull " + ollamaModel);
console.log("   ollama pull " + embedModel + "\n");

const WELCOME = `
╔══════════════════════════════════════════════════════════════╗
║     📚  CourseAI Agent  — Firestore-powered by Genkit        ║
╠══════════════════════════════════════════════════════════════╣
║  /collections          List all Firestore collections        ║
║  /schema <collection>  Show collection fields                ║
║  /clear                Clear conversation history            ║
║  /exit                 Exit                                  ║
╚══════════════════════════════════════════════════════════════╝

Example questions:
  • What courses is Alice enrolled in?
  • Show me all completed courses with certificates
  • Which instructor has the highest average rating?
  • List lessons in the Python ML course in order
  • How many students passed the React quiz?
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

    // ── Slash commands ────────────────────────────────────────────────────────
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

    if (input === "/collections") {
      const names = getAllCollectionNames();
      console.log("\n📋 " + names.length + " collections:\n  " + names.join(", "));
      continue;
    }

    if (input.startsWith("/schema ")) {
      const name = input.slice(8).trim();
      const info = getCollectionInfo(name);
      if (!info) {
        console.log(`❌ Collection "${name}" not found.`);
        continue;
      }
      console.log(`\n📊 ${name}`);
      console.log(`   ${info.description}`);
      if (info.subcollections?.length) {
        console.log(`   Subcollections: ${info.subcollections.join(", ")}`);
      }
      console.log("   Fields:");
      for (const f of info.fields) {
        console.log(`     ${f.name.padEnd(28)} ${f.type.padEnd(12)} ${f.description}`);
      }
      continue;
    }

    // ── Normal query ──────────────────────────────────────────────────────────
    console.log("\n🤖 Agent: (thinking...)\n");
    try {
      const result = await askAgent(input, history);
      history.push({ role: "user",  content: input });
      history.push({ role: "model", content: result.text });
      if (history.length > 20) history.splice(0, 2);
      console.log("🤖 Agent:\n\n" + result.text + "\n");
    } catch (err) {
      console.error("\n❌ Error: " + err + "\n");
    }
  }
}

export { courseAgentFlow };
main().catch(err => { console.error("Fatal:", err); process.exit(1); });
