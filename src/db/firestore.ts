/**
 * db/firestore.ts
 * Firestore database layer — replaces the SQLite database.ts.
 *
 * Provides schema discovery and query execution against Firestore.
 * Supports the local emulator (development) and production Firestore.
 *
 * For the agent:
 *  - getCollectionInfo()     → schema discovery (like PRAGMA table_info)
 *  - getAllCollectionNames()  → list collections
 *  - executeQuery()          → run a structured Firestore query
 *  - executeWrite()          → update a document (with safety guardrails)
 */

import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { CollectionInfo, FieldInfo, QueryResult, WriteResult } from "../types/index.js";

// ─── Init ─────────────────────────────────────────────────────────────────────

function initFirebase(): void {
  if (getApps().length > 0) return;

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "courseai-demo" });
    console.log("🔧 Firestore Emulator:", emulatorHost);
    return;
  }

  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (keyPath && fs.existsSync(path.resolve(keyPath))) {
    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
    initializeApp({ credential: cert(serviceAccount) });
    return;
  }

  throw new Error(
    "Firebase not configured.\n" +
    "  Option A: Set FIRESTORE_EMULATOR_HOST=localhost:8080\n" +
    "  Option B: Set FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json"
  );
}

initFirebase();
export const db = getFirestore();

// ─── Forbidden write patterns ─────────────────────────────────────────────────

const FORBIDDEN_COLLECTIONS_WRITE = ["users", "instructors"];
const FORBIDDEN_FIELDS_WRITE = ["password", "passwordHash", "role", "uid", "email"];

export function validateWrite(
  collectionPath: string,
  fields: Record<string, unknown>
): { safe: boolean; reason?: string } {
  const rootCollection = collectionPath.split("/")[0];

  if (FORBIDDEN_COLLECTIONS_WRITE.includes(rootCollection)) {
    return {
      safe: false,
      reason: `Writing to "${rootCollection}" is forbidden. User and instructor records can only be modified via the auth system.`,
    };
  }

  for (const field of FORBIDDEN_FIELDS_WRITE) {
    if (field in fields) {
      return {
        safe: false,
        reason: `Modifying the field "${field}" is not allowed.`,
      };
    }
  }

  return { safe: true };
}

// ─── Schema — static collection definitions ───────────────────────────────────
// Since Firestore is schemaless, we define the schema explicitly.
// The agent uses this for RAG-based context retrieval.

export const SCHEMA: CollectionInfo[] = [
  {
    collectionId: "users",
    description: "Platform users — both students and instructors. Stores profile info, role, and learning stats.",
    subcollections: [],
    fields: [
      { name: "uid", type: "string", description: "Unique user ID, same as Firestore doc ID" },
      { name: "email", type: "string", description: "User email address" },
      { name: "displayName", type: "string", description: "Full display name" },
      { name: "firstName", type: "string", description: "First name" },
      { name: "lastName", type: "string", description: "Last name" },
      { name: "role", type: "string", description: "Account role: student | instructor | admin" },
      { name: "bio", type: "string", description: "Short biography" },
      { name: "location", type: "string", description: "User location e.g. 'New York, USA'" },
      { name: "joinedAt", type: "Timestamp", description: "When the user signed up" },
      { name: "lastLoginAt", type: "Timestamp", description: "Most recent login time" },
      { name: "totalCoursesEnrolled", type: "number", description: "Count of courses enrolled" },
      { name: "totalCertificates", type: "number", description: "Count of certificates earned" },
    ],
  },
  {
    collectionId: "instructors",
    description: "Instructor profiles with expertise, stats, and social links. Linked to users via userId.",
    subcollections: [],
    fields: [
      { name: "userId", type: "string", description: "References users collection doc ID" },
      { name: "name", type: "string", description: "Instructor full name" },
      { name: "email", type: "string", description: "Instructor email" },
      { name: "title", type: "string", description: "Professional title e.g. 'AI/ML Researcher'" },
      { name: "bio", type: "string", description: "Full instructor biography" },
      { name: "expertise", type: "string[]", description: "List of skill/topic tags" },
      { name: "totalCourses", type: "number", description: "Number of courses created" },
      { name: "totalStudents", type: "number", description: "Total students across all courses" },
      { name: "averageRating", type: "number", description: "Average course rating (1–5)" },
      { name: "totalReviews", type: "number", description: "Total review count" },
      { name: "joinedAt", type: "Timestamp", description: "When the instructor joined the platform" },
    ],
  },
  {
    collectionId: "categories",
    description: "Course categories (e.g. Programming, Data Science). Supports parent/child hierarchy via parentId.",
    subcollections: [],
    fields: [
      { name: "name", type: "string", description: "Category display name" },
      { name: "slug", type: "string", description: "URL-friendly identifier e.g. 'data-science'" },
      { name: "description", type: "string", description: "Short description" },
      { name: "totalCourses", type: "number", description: "Number of courses in this category" },
      { name: "parentId", type: "string|null", description: "Parent category doc ID, or null if top-level" },
    ],
  },
  {
    collectionId: "courses",
    description: "Course catalog. Each course has metadata, pricing, rating, and contains a lessons subcollection.",
    subcollections: ["lessons"],
    fields: [
      { name: "title", type: "string", description: "Course title" },
      { name: "slug", type: "string", description: "URL slug" },
      { name: "description", type: "string", description: "Full course description" },
      { name: "shortDescription", type: "string", description: "One-line summary" },
      { name: "instructorId", type: "string", description: "References instructors collection" },
      { name: "instructorName", type: "string", description: "Denormalized instructor name" },
      { name: "categoryId", type: "string", description: "References categories collection" },
      { name: "categoryName", type: "string", description: "Denormalized category name" },
      { name: "level", type: "string", description: "Difficulty: beginner | intermediate | advanced" },
      { name: "language", type: "string", description: "Course language e.g. 'English'" },
      { name: "priceCents", type: "number", description: "Current price in cents (USD)" },
      { name: "originalPriceCents", type: "number", description: "Original price before discount" },
      { name: "tags", type: "string[]", description: "Topic tags e.g. ['React', 'TypeScript']" },
      { name: "totalLessons", type: "number", description: "Number of lessons" },
      { name: "totalDurationMinutes", type: "number", description: "Total video/content length in minutes" },
      { name: "totalStudents", type: "number", description: "Enrolled student count" },
      { name: "averageRating", type: "number", description: "Average review rating (1–5)" },
      { name: "totalReviews", type: "number", description: "Number of reviews" },
      { name: "isPublished", type: "boolean", description: "Whether course is live on platform" },
      { name: "isFeatured", type: "boolean", description: "Whether course appears on homepage" },
      { name: "publishedAt", type: "Timestamp", description: "When the course went live" },
      { name: "updatedAt", type: "Timestamp", description: "Last update time" },
      { name: "createdAt", type: "Timestamp", description: "When the course was created" },
    ],
  },
  {
    collectionId: "lessons",
    description: "Subcollection of courses (path: courses/{courseId}/lessons). Individual lessons inside a course.",
    subcollections: [],
    fields: [
      { name: "courseId", type: "string", description: "Parent course doc ID" },
      { name: "title", type: "string", description: "Lesson title" },
      { name: "description", type: "string", description: "Short lesson description" },
      { name: "type", type: "string", description: "Content type: video | article | quiz" },
      { name: "order", type: "number", description: "Position in the course (1-based)" },
      { name: "durationMinutes", type: "number", description: "Lesson length in minutes" },
      { name: "isPreview", type: "boolean", description: "If true, accessible without enrollment" },
      { name: "videoUrl", type: "string", description: "Video stream URL (if type=video)" },
      { name: "createdAt", type: "Timestamp", description: "When the lesson was added" },
    ],
  },
  {
    collectionId: "enrollments",
    description: "Student-to-course enrollments. Tracks progress, completed lessons, payment, and certificate status.",
    subcollections: [],
    fields: [
      { name: "userId", type: "string", description: "References users collection" },
      { name: "courseId", type: "string", description: "References courses collection" },
      { name: "courseTitle", type: "string", description: "Denormalized course title" },
      { name: "instructorId", type: "string", description: "References instructors collection" },
      { name: "enrolledAt", type: "Timestamp", description: "When the student enrolled" },
      { name: "status", type: "string", description: "active | completed | paused | refunded" },
      { name: "progressPercent", type: "number", description: "0–100 completion percentage" },
      { name: "completedLessons", type: "string[]", description: "Array of completed lesson IDs" },
      { name: "lastAccessedAt", type: "Timestamp", description: "Most recent activity timestamp" },
      { name: "lastLessonId", type: "string|null", description: "Most recently accessed lesson" },
      { name: "paidAmountCents", type: "number", description: "Amount paid in cents" },
      { name: "certificateIssued", type: "boolean", description: "Whether a certificate was issued" },
      { name: "completedAt", type: "Timestamp", description: "When the course was completed (if applicable)" },
    ],
  },
  {
    collectionId: "quizzes",
    description: "Quiz definitions linked to a course and lesson. Contains a questions subcollection.",
    subcollections: ["questions"],
    fields: [
      { name: "courseId", type: "string", description: "References courses collection" },
      { name: "title", type: "string", description: "Quiz name" },
      { name: "description", type: "string", description: "Quiz overview" },
      { name: "afterLessonId", type: "string", description: "Quiz unlocked after this lesson" },
      { name: "passingScore", type: "number", description: "Minimum score to pass (0–100)" },
      { name: "timeLimitMinutes", type: "number", description: "Time limit in minutes" },
      { name: "totalQuestions", type: "number", description: "Number of questions" },
      { name: "isPublished", type: "boolean", description: "Whether the quiz is live" },
    ],
  },
  {
    collectionId: "questions",
    description: "Subcollection of quizzes (path: quizzes/{quizId}/questions). Individual quiz questions.",
    subcollections: [],
    fields: [
      { name: "quizId", type: "string", description: "Parent quiz doc ID" },
      { name: "text", type: "string", description: "Question text" },
      { name: "options", type: "string[]", description: "Answer options array" },
      { name: "correctOption", type: "number", description: "Index of correct answer in options array" },
      { name: "explanation", type: "string", description: "Explanation shown after answering" },
      { name: "points", type: "number", description: "Points awarded for correct answer" },
    ],
  },
  {
    collectionId: "quiz_attempts",
    description: "Records of students taking quizzes. Includes score, pass/fail, per-question answers, and timing.",
    subcollections: [],
    fields: [
      { name: "userId", type: "string", description: "References users collection" },
      { name: "quizId", type: "string", description: "References quizzes collection" },
      { name: "courseId", type: "string", description: "References courses collection" },
      { name: "attemptNumber", type: "number", description: "Attempt count (1 = first try)" },
      { name: "score", type: "number", description: "Score achieved (0–100)" },
      { name: "passed", type: "boolean", description: "Whether the student passed the quiz" },
      { name: "answers", type: "object[]", description: "Array of {questionId, selectedOption, correct}" },
      { name: "timeTakenSeconds", type: "number", description: "Time taken to complete the quiz" },
      { name: "completedAt", type: "Timestamp", description: "When the attempt was submitted" },
    ],
  },
  {
    collectionId: "reviews",
    description: "Student reviews for courses. Linked to both the user and course. Includes rating and helpful votes.",
    subcollections: [],
    fields: [
      { name: "userId", type: "string", description: "References users collection" },
      { name: "courseId", type: "string", description: "References courses collection" },
      { name: "instructorId", type: "string", description: "References instructors collection" },
      { name: "rating", type: "number", description: "Star rating 1–5" },
      { name: "title", type: "string", description: "Short review headline" },
      { name: "body", type: "string", description: "Full review text" },
      { name: "isVerifiedPurchase", type: "boolean", description: "True if reviewer is enrolled" },
      { name: "isPublished", type: "boolean", description: "Whether review is visible publicly" },
      { name: "helpfulVotes", type: "number", description: "Number of users who found this review helpful" },
      { name: "createdAt", type: "Timestamp", description: "When the review was submitted" },
    ],
  },
  {
    collectionId: "certificates",
    description: "Completion certificates issued to students after finishing a course.",
    subcollections: [],
    fields: [
      { name: "userId", type: "string", description: "References users collection" },
      { name: "courseId", type: "string", description: "References courses collection" },
      { name: "courseTitle", type: "string", description: "Denormalized course title" },
      { name: "instructorName", type: "string", description: "Denormalized instructor name" },
      { name: "studentName", type: "string", description: "Denormalized student full name" },
      { name: "certificateNumber", type: "string", description: "Unique cert ID e.g. CERT-2024-PML-0022" },
      { name: "issuedAt", type: "Timestamp", description: "Issue date" },
      { name: "verificationUrl", type: "string", description: "Public URL to verify the certificate" },
    ],
  },
];

// ─── Schema helpers ───────────────────────────────────────────────────────────

export function getAllCollectionNames(): string[] {
  return SCHEMA.map(c => c.collectionId);
}

export function getCollectionInfo(collectionId: string): CollectionInfo | null {
  return SCHEMA.find(c => c.collectionId === collectionId) ?? null;
}

export function getSchemaSummary(): string {
  return SCHEMA.map(col => {
    const fieldList = col.fields.map(f => `  - ${f.name} (${f.type}): ${f.description}`).join("\n");
    const subs = col.subcollections?.length
      ? `\n  Subcollections: ${col.subcollections.join(", ")}`
      : "";
    return `COLLECTION: ${col.collectionId}\n${col.description}${subs}\nFields:\n${fieldList}`;
  }).join("\n\n");
}

// ─── Query execution ──────────────────────────────────────────────────────────

export interface FirestoreQuery {
  collection: string;           // e.g. "enrollments"
  parentDoc?: string;           // e.g. "course_python_ml" (for subcollections)
  parentCollection?: string;    // e.g. "courses" (for subcollections)
  where?: Array<{
    field: string;
    op: FirebaseFirestore.WhereFilterOp;
    value: unknown;
  }>;
  orderBy?: Array<{ field: string; direction?: "asc" | "desc" }>;
  limit?: number;
  collectionGroup?: boolean;    // true = search across ALL subcollections with this name
}

export async function executeQuery(query: FirestoreQuery): Promise<QueryResult> {
  const limit = Math.min(query.limit ?? 50, 200);

  let ref: FirebaseFirestore.Query;

  if (query.collectionGroup) {
    // Collection group query — searches across all subcollections with this name
    ref = db.collectionGroup(query.collection);
  } else if (query.parentCollection && query.parentDoc) {
    // Subcollection query
    ref = db
      .collection(query.parentCollection)
      .doc(query.parentDoc)
      .collection(query.collection);
  } else {
    // Top-level collection query
    ref = db.collection(query.collection);
  }

  // Apply where clauses
  for (const w of query.where ?? []) {
    ref = ref.where(w.field, w.op, w.value);
  }

  // Apply orderBy
  for (const o of query.orderBy ?? []) {
    ref = ref.orderBy(o.field, o.direction ?? "asc");
  }

  ref = ref.limit(limit);

  const snapshot = await ref.get();
  const docs = snapshot.docs.map(doc => {
    const data = doc.data();
    // Convert Timestamps to ISO strings for readability
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === "object" && "toDate" in val) {
        (data as Record<string, unknown>)[key] = (val as Timestamp).toDate().toISOString().split("T")[0];
      }
    }
    return { id: doc.id, ...data };
  });

  const collectionPath = query.parentCollection && query.parentDoc
    ? `${query.parentCollection}/${query.parentDoc}/${query.collection}`
    : query.collection;

  return { docs, totalCount: docs.length, collectionPath };
}

// ─── Write execution ──────────────────────────────────────────────────────────

export async function executeWrite(
  collectionPath: string,
  docId: string,
  fields: Record<string, unknown>,
  merge = true
): Promise<WriteResult> {
  const validation = validateWrite(collectionPath, fields);
  if (!validation.safe) {
    return { success: false, error: validation.reason };
  }

  // Auto-stamp updatedAt
  fields.updatedAt = FieldValue.serverTimestamp();

  try {
    const ref = db.doc(`${collectionPath}/${docId}`);
    await ref.set(fields, { merge });
    return { success: true, docId, updatedFields: Object.keys(fields) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
