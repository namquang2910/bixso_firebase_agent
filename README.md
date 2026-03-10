# CourseAI Agent 📚

An AI agent for a **Coursera-like learning platform** that answers natural language questions by querying Firestore in real time. Built with **Genkit** + **Ollama** + **Firebase Firestore**.

---

## Architecture

```
src/
├── agent/
│   ├── agent.ts              ← Core AI agent loop (LLM + tool calling)
│   ├── prompts.ts            ← System prompt builder
│   └── rag/
│       ├── vectorStore.ts    ← Collection schema embeddings + hybrid search
│       ├── schemaRetriever.ts← RAG: finds relevant collections for a query
│       └── utils.ts          ← Embedding, cosine similarity, text builders
├── db/
│   └── firestore.ts          ← Firestore init, static schema, query execution
├── tools/
│   └── firestoretool.ts      ← Tool parsing + query_collection / update_document
├── types/
│   └── index.ts              ← Shared TypeScript types
└── index.ts                  ← CLI entry point

scripts/
└── seed-firestore.ts         ← Seeds Firestore with realistic course platform data
```

## Firestore Collections

| Collection       | Description                                      |
|------------------|--------------------------------------------------|
| `users`          | Students and instructors                         |
| `instructors`    | Instructor profiles with stats                   |
| `categories`     | Course categories (supports parent/child)        |
| `courses`        | Course catalog with metadata and ratings         |
| `↳ lessons`      | Subcollection: individual lessons per course     |
| `enrollments`    | Student–course link with progress tracking       |
| `quizzes`        | Quiz definitions per course                      |
| `↳ questions`    | Subcollection: questions per quiz                |
| `quiz_attempts`  | Student quiz attempt records                     |
| `reviews`        | Student reviews with ratings                     |
| `certificates`   | Issued completion certificates                   |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Pull Ollama models

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

### 3. Set up Firebase

**Option A — Local Emulator (recommended for development)**

```bash
npm install -g firebase-tools
firebase emulators:start --only firestore
```

Copy `.env.example` to `.env` and keep the emulator settings.

**Option B — Production Firestore**

1. Create a Firebase project at https://console.firebase.google.com
2. Download your service account JSON
3. In `.env`, comment out emulator settings and set:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json
   ```

### 4. Seed sample data

```bash
npm run seed
```

This creates 6 users, 4 courses, 19 lessons, 10 enrollments, 2 quizzes, 4 quiz attempts, 5 reviews, and 3 certificates.

### 5. Start the agent

```bash
npm start
```

---

## Example Questions

```
What courses is Alice enrolled in?
Which courses has Carol completed?
Show me all lessons in the Python ML course, in order
Which instructor has the highest average rating?
How many students passed the React hooks quiz?
List all courses with a rating above 4.8
Who reviewed the Data Analysis course?
What certificates has Carol earned?
Show me Bob's quiz attempt history
Which courses are beginner level?
```

## CLI Commands

```
/collections          — List all Firestore collections
/schema <collection>  — Show fields for a collection
/clear                — Clear conversation history
/exit                 — Quit
```

---

## How It Works

1. **RAG Schema Retrieval** — The user's question is embedded and compared against embedded Firestore collection/field descriptions using hybrid scoring (vector + keyword).
2. **Context Injection** — The most relevant collections and their relationships are injected into the system prompt.
3. **Tool-Calling Loop** — The LLM decides which Firestore queries to run and calls `query_collection` or `update_document`.
4. **Result Presentation** — Query results are fed back to the LLM to produce a natural language answer.

## Safety Guardrails

- `users` and `instructors` collections are **read-only** via the agent
- Fields like `role`, `email`, `password` cannot be modified
- All writes are **audit-logged** with intent descriptions
- Write operations require `confirmIntent` to be explicitly stated
# bixso_firebase_agent
