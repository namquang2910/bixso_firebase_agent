/**
 * server.ts
 * Express HTTP API server for the CourseAI Agent.
 *
 * Run: npm run api
 *
 * Endpoints:
 *   POST /api/chat          — send a question, get an AI answer
 *   GET  /api/chat/history  — get the current conversation history
 *   DELETE /api/chat/history — clear the conversation history
 *   GET  /api/health        — health check
 */

import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { initAgent, askAgent } from "./agent/agent.js";

const PORT = process.env.API_PORT ?? 3000;

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── In-memory conversation history ──────────────────────────────────────────
// Each session is keyed by sessionId (provided by the client).
// If no sessionId is given, a default "global" session is used.

type Message = { role: "user" | "model"; content: string };
const sessions = new Map<string, Message[]>();

function getHistory(sessionId: string): Message[] {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId)!;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Simple health check — useful for checking the server is running.
 *
 * Response:
 *   { status: "ok", timestamp: "..." }
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /api/chat
 * Send a question to the AI agent and get an answer back.
 *
 * Request body:
 *   {
 *     "message": "What courses is Alice enrolled in?",
 *     "sessionId": "user-123"   // optional, defaults to "default"
 *   }
 *
 * Response:
 *   {
 *     "answer": "Alice is enrolled in 3 courses...",
 *     "sessionId": "user-123",
 *     "messageCount": 4
 *   }
 */
app.post("/api/chat", async (req: Request, res: Response) => {
  const { message, sessionId = "default" } = req.body as {
    message?: string;
    sessionId?: string;
  };

  // Validate request
  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400).json({
      error: "Missing required field: message",
      example: { message: "What courses is Alice enrolled in?", sessionId: "user-123" },
    });
    return;
  }

  const history = getHistory(sessionId);

  try {
    console.log(`\n[chat] session=${sessionId} message="${message.slice(0, 80)}"`);

    const result = await askAgent(message.trim(), history);

    // Save turn to history
    history.push({ role: "user",  content: message.trim() });
    history.push({ role: "model", content: result.text });

    // Keep history to last 20 messages (10 turns) to avoid token bloat
    if (history.length > 20) history.splice(0, history.length - 20);

    res.json({
      answer: result.text,
      sessionId,
      messageCount: history.length,
    });

  } catch (err) {
    console.error("[chat] Error:", err);
    res.status(500).json({
      error: "Agent failed to process the request.",
      detail: String(err),
    });
  }
});

/**
 * GET /api/chat/history
 * Returns the conversation history for a session.
 *
 * Query params:
 *   ?sessionId=user-123   // optional, defaults to "default"
 *
 * Response:
 *   {
 *     "sessionId": "user-123",
 *     "messages": [
 *       { "role": "user",  "content": "What courses is Alice enrolled in?" },
 *       { "role": "model", "content": "Alice is enrolled in..." }
 *     ],
 *     "messageCount": 2
 *   }
 */
app.get("/api/chat/history", (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) ?? "default";
  const history   = getHistory(sessionId);

  res.json({
    sessionId,
    messages: history,
    messageCount: history.length,
  });
});

/**
 * DELETE /api/chat/history
 * Clears the conversation history for a session.
 *
 * Query params:
 *   ?sessionId=user-123   // optional, defaults to "default"
 *
 * Response:
 *   { "cleared": true, "sessionId": "user-123" }
 */
app.delete("/api/chat/history", (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) ?? "default";
  sessions.delete(sessionId);
  res.json({ cleared: true, sessionId });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    availableRoutes: [
      "POST   /api/chat",
      "GET    /api/chat/history?sessionId=",
      "DELETE /api/chat/history?sessionId=",
      "GET    /api/health",
    ],
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

console.log("\n Starting CourseAI API Server...");

await initAgent();

app.listen(PORT, () => {
  console.log(`\n API Server running at http://localhost:${PORT}`);
  console.log("\nAvailable endpoints:");
  console.log(`  POST   http://localhost:${PORT}/api/chat`);
  console.log(`  GET    http://localhost:${PORT}/api/chat/history`);
  console.log(`  DELETE http://localhost:${PORT}/api/chat/history`);
  console.log(`  GET    http://localhost:${PORT}/api/health`);
  console.log("\nExample request:");
  console.log(`  curl -X POST http://localhost:${PORT}/api/chat \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"message": "What courses is Alice enrolled in?", "sessionId": "test"}'`);
  console.log("");
});
