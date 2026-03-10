/**
 * types/index.ts
 * Shared TypeScript types for the CourseAI Firestore agent.
 */

// ─── Firestore Schema Types ───────────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: "student" | "instructor" | "admin";
  avatarUrl?: string;
  bio?: string;
  location?: string;
  joinedAt: FirebaseFirestore.Timestamp;
  lastLoginAt?: FirebaseFirestore.Timestamp;
  totalCoursesEnrolled: number;
  totalCertificates: number;
}

export interface Instructor {
  userId: string;
  name: string;
  email: string;
  title: string;
  bio: string;
  avatarUrl?: string;
  expertise: string[];
  totalCourses: number;
  totalStudents: number;
  averageRating: number;
  totalReviews: number;
  joinedAt: FirebaseFirestore.Timestamp;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    website?: string;
  };
}

export interface Category {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  totalCourses: number;
  parentId: string | null;
}

export interface Course {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  instructorId: string;
  instructorName: string;
  categoryId: string;
  categoryName: string;
  level: "beginner" | "intermediate" | "advanced";
  language: string;
  priceCents: number;
  originalPriceCents: number;
  currency: string;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  tags: string[];
  requirements: string[];
  whatYouWillLearn: string[];
  totalLessons: number;
  totalDurationMinutes: number;
  totalStudents: number;
  averageRating: number;
  totalReviews: number;
  isPublished: boolean;
  isFeatured: boolean;
  publishedAt?: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Lesson {
  courseId: string;
  title: string;
  description?: string;
  type: "video" | "article" | "quiz";
  order: number;
  durationMinutes: number;
  isPreview: boolean;
  videoUrl?: string;
  articleContent?: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Enrollment {
  userId: string;
  courseId: string;
  courseTitle: string;
  instructorId: string;
  enrolledAt: FirebaseFirestore.Timestamp;
  status: "active" | "completed" | "paused" | "refunded";
  progressPercent: number;
  completedLessons: string[];
  lastAccessedAt?: FirebaseFirestore.Timestamp;
  lastLessonId: string | null;
  paidAmountCents: number;
  currency: string;
  certificateIssued: boolean;
  completedAt?: FirebaseFirestore.Timestamp;
}

export interface Quiz {
  courseId: string;
  title: string;
  description?: string;
  afterLessonId: string;
  passingScore: number;
  timeLimitMinutes: number;
  totalQuestions: number;
  isPublished: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface QuizQuestion {
  quizId: string;
  text: string;
  options: string[];
  correctOption: number;
  explanation?: string;
  points: number;
}

export interface QuizAttempt {
  userId: string;
  quizId: string;
  courseId: string;
  attemptNumber: number;
  score: number;
  passed: boolean;
  answers: Array<{
    questionId: string;
    selectedOption: number;
    correct: boolean;
  }>;
  timeTakenSeconds: number;
  completedAt: FirebaseFirestore.Timestamp;
}

export interface Review {
  userId: string;
  courseId: string;
  instructorId: string;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
  isPublished: boolean;
  helpfulVotes: number;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Certificate {
  userId: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  studentName: string;
  certificateNumber: string;
  issuedAt: FirebaseFirestore.Timestamp;
  verificationUrl: string;
}

// ─── Agent Types ──────────────────────────────────────────────────────────────

/** A description of a Firestore collection for the schema retriever */
export interface CollectionInfo {
  collectionId: string;
  description: string;
  fields: FieldInfo[];
  subcollections?: string[];
  sampleDocId?: string;
  sampleData?: Record<string, unknown>;
}

export interface FieldInfo {
  name: string;
  type: string;
  description: string;
  isArray?: boolean;
  isNested?: boolean;
}

/** RAG context passed to the system prompt builder */
export interface RetrievedContext {
  contextBlock: string;
  collectionNames: string[];
  joinHints: string[];       // how collections relate to each other
  fieldMap: Record<string, string>; // fieldName -> collectionId
}

export interface SearchResult {
  collectionId: string;
  fields: FieldInfo[];
  matchedFields: string[];
  score: number;
  sampleData?: Record<string, unknown>;
}

export interface RelationshipHint {
  fromCollection: string;
  fromField: string;
  toCollection: string;
  toField: string;
  description: string;
}

// ─── Tool types ───────────────────────────────────────────────────────────────

export interface QueryResult {
  docs: Record<string, unknown>[];
  totalCount: number;
  collectionPath: string;
}

export interface WriteResult {
  success: boolean;
  docId?: string;
  updatedFields?: string[];
  error?: string;
}

// ─── Agent result types ───────────────────────────────────────────────────────

export interface AnswerResult {
  type: "answer";
  text: string;
}

export interface AgentResult {
  type: "answer";
  text: string;
}

// ─── Vector store types ───────────────────────────────────────────────────────

export interface CollectionDocument {
  collectionId: string;
  fields: FieldInfo[];
  fieldDetails: string;
  collectionEmbedding: number[];
  fieldDocs: FieldDocument[];
  sampleDoc: Record<string, unknown> | null;
}

export interface FieldDocument {
  collectionId: string;
  fieldName: string;
  text: string;
  embedding: number[];
}

export interface FKHint {
  fromCollection: string;
  fromField: string;
  toCollection: string;
  toField: string;
}
