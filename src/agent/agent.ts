/**
 * agent/agent.ts
 * Core AI agent loop — Firestore edition.
 * Same architecture as the SQL agent but queries Firestore instead.
 */

import { genkit, z } from "genkit";
import { ollama } from "genkitx-ollama";
import { indexSchema } from "./rag/vectorStore.js";
import { buildSystemPrompt } from "./prompts.js";
import { extractToolCall, TOOLS } from "../tools/firestoretool.js";
import { retrieveRelevantSchema } from "./rag/schemaRetriever.js";
import type { AgentResult } from "../types/index.js";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
const OLLAMA_SERVER = process.env.OLLAMA_SERVER_ADDRESS ?? "http://localhost:11434";
const MAX_STEPS = 8;

export const ai = genkit({
  plugins: [
    ollama({
      models: [{ name: OLLAMA_MODEL, type: "generate" }],
      serverAddress: OLLAMA_SERVER,
    }),
  ],
  model: "ollama/" + OLLAMA_MODEL,
});

// ─── Core agent loop ──────────────────────────────────────────────────────────

async function runAgentCore(
  userMessage: string,
  history: { role: "user" | "model"; content: string }[],
): Promise<string> {

  // Step 1: RAG — find relevant Firestore collections
  const ctx = await retrieveRelevantSchema(userMessage);
  console.log("  Collections: " + ctx.collectionNames.join(", "));
  if (ctx.joinHints.length > 0) {
    console.log("  Relations: " + ctx.joinHints.join(" | "));
  }

  // Step 2: Build system prompt with retrieved schema
  const systemPrompt = buildSystemPrompt(ctx);

  // Merge system prompt into first user message.
  // llama3.2 and most local Ollama models do not support a separate system
  // role when multiple messages are present — prepend it to the first user turn.
  const firstUserContent = systemPrompt + "\n\n---\n\nUser question: " + userMessage;

  const messages: { role: "user" | "model"; content: string }[] = [
    ...history,
    { role: "user", content: firstUserContent },
  ];

  // Step 3: Agent reasoning loop with tool calls
  for (let step = 0; step < MAX_STEPS; step++) {
    const fullPrompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    const { text } = await ai.generate({
      //system: systemPrompt,
      messages: [{ role: "user", content: [{ text: fullPrompt }] }],
      config: { temperature: 0.0, maxOutputTokens: 2048 },
    });

    if (process.env.DEBUG_AGENT === "true") {
      console.log(`[DEBUG step ${step}]:\n${text}`);
    }

    const toolCall = extractToolCall(text);
    console.log(toolCall ? `  Tool call: ${toolCall.tool}` : "  No tool call detected.");

    if (!toolCall) {
      return text.trim();
    }

    const handler = TOOLS[toolCall.tool];
    let toolResult: unknown;

    if (!handler) {
      toolResult = {
        error: `Unknown tool: "${toolCall.tool}". Available tools: query_collection, update_document.`,
      };
    } else {
      try {
        toolResult = await handler(toolCall.args ?? {});
        const preview = JSON.stringify(toolResult).slice(0, 200);
        console.log(`  ${toolCall.tool} -> ${preview}`);
      } catch (err) {
        toolResult = { error: String(err) };
      }
    }

    const docCount = (toolResult as Record<string, unknown>).docCount;

    // After tool execution
    const toolMessage = "TOOL RESULT (" + toolCall.tool + "):\n" +
      JSON.stringify(toolResult, null, 2) + "\n\n" +
      (docCount === 0
        ? "No records were found. Say so clearly."
        : "Present the data above in plain, friendly English. " +
        "Do not invent any values not in the result.");

    // Instead of pushing two messages, merge:
    messages.push({ role: "user", content: toolMessage });
  }

  return "Reached max reasoning steps. Please rephrase your question.";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function initAgent(): Promise<void> {
  await indexSchema();
}

export async function askAgent(
  userMessage: string,
  history: { role: "user" | "model"; content: string }[] = [],
): Promise<AgentResult> {
  console.log(`\nSearching schema for: "${userMessage}"`);
  const text = await runAgentCore(userMessage, history);
  return { type: "answer", text };
}

// ─── Genkit flow (for external use) ──────────────────────────────────────────

export const courseAgentFlow = ai.defineFlow(
  {
    name: "courseAgent",
    inputSchema: z.object({
      userMessage: z.string(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "model"]),
        content: z.string(),
      })).optional().default([]),
    }),
    outputSchema: z.object({ response: z.string() }),
  },
  async ({ userMessage, conversationHistory }) => {
    const result = await askAgent(userMessage, conversationHistory ?? []);
    return { response: result.text };
  }
);