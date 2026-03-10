/**
 * seed-firestore.ts
 * Creates realistic Firestore data for the Course AI Agent (Coursera-like platform).
 * Uses Firebase Admin SDK with a local emulator or service account.
 *
 * Run: npm run seed
 *
 * ── Firestore Collections ──────────────────────────────────────────────────────
 *
 *  users/                          ← students & instructors
 *  instructors/                    ← instructor profiles
 *  categories/                     ← course categories
 *  courses/                        ← course metadata
 *    └── lessons/ (subcollection)  ← individual lessons inside a course
 *  enrollments/                    ← student ↔ course link + progress
 *  quizzes/                        ← quiz definitions (linked to a course)
 *    └── questions/ (subcollection)
 *  quiz_attempts/                  ← student quiz attempt records
 *  reviews/                        ← course reviews from students
 *  certificates/                   ← issued on course completion
 */

import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

// ─── Firebase init ─────────────────────────────────────────────────────────────
const USE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST !== undefined;

if (!getApps().length) {
  if (USE_EMULATOR) {
    // Emulator mode — no credentials needed
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "courseai-demo" });
    console.log("🔧 Using Firestore Emulator at:", process.env.FIRESTORE_EMULATOR_HOST);
  } else {
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!keyPath || !fs.existsSync(keyPath)) {
      console.error(
        "❌ No service account found.\n" +
        "   Set FIRESTORE_EMULATOR_HOST=localhost:8080 to use the emulator, OR\n" +
        "   Set FIREBASE_SERVICE_ACCOUNT_PATH to your serviceAccount.json path."
      );
      process.exit(1);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
    initializeApp({ credential: cert(serviceAccount) });
  }
}

const db = getFirestore();

// ─── Helper ────────────────────────────────────────────────────────────────────
function ts(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function setDoc(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
  await db.collection(collection).doc(id).set(data);
  process.stdout.write(`  ✓ ${collection}/${id}\n`);
}

async function addSubDoc(
  collection: string,
  parentId: string,
  subCollection: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await db.collection(collection).doc(parentId).collection(subCollection).doc(id).set(data);
  process.stdout.write(`  ✓ ${collection}/${parentId}/${subCollection}/${id}\n`);
}

// ─── SEED ──────────────────────────────────────────────────────────────────────
console.log("\n🌱 Seeding Firestore for CourseAI Platform...\n");

// ── 1. USERS ──────────────────────────────────────────────────────────────────
console.log("\n📁 users/");

await setDoc("users", "user_alice", {
  uid: "user_alice",
  email: "alice@example.com",
  displayName: "Alice Martin",
  firstName: "Alice",
  lastName: "Martin",
  role: "student",
  avatarUrl: "https://example.com/avatars/alice.jpg",
  bio: "Software developer learning ML and data science.",
  location: "New York, USA",
  joinedAt: ts("2023-09-01"),
  lastLoginAt: ts("2024-06-15"),
  totalCoursesEnrolled: 3,
  totalCertificates: 1,
});

await setDoc("users", "user_bob", {
  uid: "user_bob",
  email: "bob@example.com",
  displayName: "Bob Johnson",
  firstName: "Bob",
  lastName: "Johnson",
  role: "student",
  avatarUrl: "https://example.com/avatars/bob.jpg",
  bio: "UX designer transitioning into front-end development.",
  location: "Los Angeles, USA",
  joinedAt: ts("2024-01-10"),
  lastLoginAt: ts("2024-06-10"),
  totalCoursesEnrolled: 2,
  totalCertificates: 0,
});

await setDoc("users", "user_carol", {
  uid: "user_carol",
  email: "carol@example.com",
  displayName: "Carol Williams",
  firstName: "Carol",
  lastName: "Williams",
  role: "student",
  avatarUrl: "https://example.com/avatars/carol.jpg",
  bio: "Data analyst exploring Python and ML.",
  location: "Chicago, USA",
  joinedAt: ts("2023-06-20"),
  lastLoginAt: ts("2024-06-18"),
  totalCoursesEnrolled: 4,
  totalCertificates: 2,
});

await setDoc("users", "user_dave", {
  uid: "user_dave",
  email: "dave@example.com",
  displayName: "Dave Kim",
  firstName: "Dave",
  lastName: "Kim",
  role: "student",
  avatarUrl: "https://example.com/avatars/dave.jpg",
  bio: "Beginner coder, interested in web development.",
  location: "Houston, USA",
  joinedAt: ts("2024-03-05"),
  lastLoginAt: ts("2024-05-30"),
  totalCoursesEnrolled: 1,
  totalCertificates: 0,
});

await setDoc("users", "user_instructor_sarah", {
  uid: "user_instructor_sarah",
  email: "sarah@courseai.com",
  displayName: "Dr. Sarah Chen",
  firstName: "Sarah",
  lastName: "Chen",
  role: "instructor",
  avatarUrl: "https://example.com/avatars/sarah.jpg",
  bio: "AI/ML researcher with 10+ years teaching experience.",
  location: "San Francisco, USA",
  joinedAt: ts("2022-01-15"),
  lastLoginAt: ts("2024-06-19"),
  totalCoursesEnrolled: 0,
  totalCertificates: 0,
});

await setDoc("users", "user_instructor_mike", {
  uid: "user_instructor_mike",
  email: "mike@courseai.com",
  displayName: "Mike Torres",
  firstName: "Mike",
  lastName: "Torres",
  role: "instructor",
  avatarUrl: "https://example.com/avatars/mike.jpg",
  bio: "Full-stack developer and coding bootcamp founder.",
  location: "Austin, USA",
  joinedAt: ts("2022-06-01"),
  lastLoginAt: ts("2024-06-17"),
  totalCoursesEnrolled: 0,
  totalCertificates: 0,
});

// ── 2. INSTRUCTORS ────────────────────────────────────────────────────────────
console.log("\n📁 instructors/");

await setDoc("instructors", "instructor_sarah", {
  userId: "user_instructor_sarah",
  name: "Dr. Sarah Chen",
  email: "sarah@courseai.com",
  title: "AI/ML Researcher & Educator",
  bio: "PhD in Computer Science from Stanford. Published 30+ papers on deep learning. Passionate about making AI accessible to everyone.",
  avatarUrl: "https://example.com/avatars/sarah.jpg",
  expertise: ["Machine Learning", "Deep Learning", "Python", "Data Science", "NLP"],
  totalCourses: 2,
  totalStudents: 4200,
  averageRating: 4.8,
  totalReviews: 312,
  joinedAt: ts("2022-01-15"),
  socialLinks: {
    linkedin: "https://linkedin.com/in/sarahchen",
    github: "https://github.com/sarahchen",
    website: "https://sarahchen.ai",
  },
});

await setDoc("instructors", "instructor_mike", {
  userId: "user_instructor_mike",
  name: "Mike Torres",
  email: "mike@courseai.com",
  title: "Full-Stack Developer & Educator",
  bio: "15 years building web apps. Founded LearnCode bootcamp. Loves turning complex concepts into simple lessons.",
  avatarUrl: "https://example.com/avatars/mike.jpg",
  expertise: ["JavaScript", "React", "Node.js", "TypeScript", "Web Development"],
  totalCourses: 2,
  totalStudents: 6800,
  averageRating: 4.7,
  totalReviews: 489,
  joinedAt: ts("2022-06-01"),
  socialLinks: {
    linkedin: "https://linkedin.com/in/miketorres",
    github: "https://github.com/miketorres",
    website: "https://miketorres.dev",
  },
});

// ── 3. CATEGORIES ─────────────────────────────────────────────────────────────
console.log("\n📁 categories/");

await setDoc("categories", "cat_programming", {
  name: "Programming",
  slug: "programming",
  description: "Learn to code from beginner to expert.",
  iconUrl: "https://example.com/icons/programming.svg",
  totalCourses: 2,
  parentId: null,
});

await setDoc("categories", "cat_data_science", {
  name: "Data Science",
  slug: "data-science",
  description: "Master data analysis, ML, and AI.",
  iconUrl: "https://example.com/icons/data-science.svg",
  totalCourses: 2,
  parentId: null,
});

await setDoc("categories", "cat_web_dev", {
  name: "Web Development",
  slug: "web-development",
  description: "Build modern websites and web apps.",
  iconUrl: "https://example.com/icons/web-dev.svg",
  totalCourses: 1,
  parentId: "cat_programming",
});

await setDoc("categories", "cat_ml", {
  name: "Machine Learning",
  slug: "machine-learning",
  description: "Algorithms, models, and real-world ML projects.",
  iconUrl: "https://example.com/icons/ml.svg",
  totalCourses: 1,
  parentId: "cat_data_science",
});

// ── 4. COURSES ────────────────────────────────────────────────────────────────
console.log("\n📁 courses/");

await setDoc("courses", "course_python_ml", {
  title: "Python for Machine Learning: From Zero to Hero",
  slug: "python-machine-learning",
  description: "A comprehensive course covering Python fundamentals and ML algorithms with hands-on projects using scikit-learn and TensorFlow.",
  shortDescription: "Master Python and ML with real-world projects.",
  instructorId: "instructor_sarah",
  instructorName: "Dr. Sarah Chen",
  categoryId: "cat_ml",
  categoryName: "Machine Learning",
  level: "intermediate",
  language: "English",
  priceCents: 8999,
  originalPriceCents: 19999,
  currency: "USD",
  thumbnailUrl: "https://example.com/thumbnails/python-ml.jpg",
  previewVideoUrl: "https://example.com/previews/python-ml.mp4",
  tags: ["Python", "Machine Learning", "scikit-learn", "TensorFlow", "Data Science"],
  requirements: ["Basic Python knowledge", "High school mathematics"],
  whatYouWillLearn: [
    "Build ML models from scratch",
    "Work with pandas and numpy",
    "Train neural networks with TensorFlow",
    "Deploy models to production",
  ],
  totalLessons: 5,
  totalDurationMinutes: 320,
  totalStudents: 2800,
  averageRating: 4.9,
  totalReviews: 201,
  isPublished: true,
  isFeatured: true,
  publishedAt: ts("2023-03-15"),
  updatedAt: ts("2024-05-01"),
  createdAt: ts("2023-01-10"),
});

await setDoc("courses", "course_react_typescript", {
  title: "React & TypeScript: Build Production-Ready Apps",
  slug: "react-typescript-production",
  description: "Learn React with TypeScript, hooks, state management with Zustand, testing with Vitest, and deployment on Vercel.",
  shortDescription: "Modern React development with TypeScript.",
  instructorId: "instructor_mike",
  instructorName: "Mike Torres",
  categoryId: "cat_web_dev",
  categoryName: "Web Development",
  level: "intermediate",
  language: "English",
  priceCents: 7999,
  originalPriceCents: 14999,
  currency: "USD",
  thumbnailUrl: "https://example.com/thumbnails/react-ts.jpg",
  previewVideoUrl: "https://example.com/previews/react-ts.mp4",
  tags: ["React", "TypeScript", "Hooks", "Zustand", "Vitest", "Frontend"],
  requirements: ["JavaScript basics", "Basic HTML & CSS"],
  whatYouWillLearn: [
    "Build type-safe React apps",
    "Master React hooks and patterns",
    "State management with Zustand",
    "Test components with Vitest",
  ],
  totalLessons: 5,
  totalDurationMinutes: 280,
  totalStudents: 3600,
  averageRating: 4.8,
  totalReviews: 287,
  isPublished: true,
  isFeatured: true,
  publishedAt: ts("2023-07-20"),
  updatedAt: ts("2024-04-15"),
  createdAt: ts("2023-05-10"),
});

await setDoc("courses", "course_data_analysis", {
  title: "Data Analysis with Python & Pandas",
  slug: "data-analysis-pandas",
  description: "Deep dive into data wrangling, analysis, and visualization using pandas, matplotlib, and seaborn with real datasets.",
  shortDescription: "Become a data analyst with Python.",
  instructorId: "instructor_sarah",
  instructorName: "Dr. Sarah Chen",
  categoryId: "cat_data_science",
  categoryName: "Data Science",
  level: "beginner",
  language: "English",
  priceCents: 5999,
  originalPriceCents: 12999,
  currency: "USD",
  thumbnailUrl: "https://example.com/thumbnails/data-analysis.jpg",
  previewVideoUrl: "https://example.com/previews/data-analysis.mp4",
  tags: ["Python", "Pandas", "Matplotlib", "Seaborn", "Data Analysis"],
  requirements: ["No prior coding experience needed"],
  whatYouWillLearn: [
    "Load and clean messy datasets",
    "Analyze data with pandas",
    "Create stunning visualizations",
    "Build a data analyst portfolio",
  ],
  totalLessons: 4,
  totalDurationMinutes: 240,
  totalStudents: 1400,
  averageRating: 4.7,
  totalReviews: 111,
  isPublished: true,
  isFeatured: false,
  publishedAt: ts("2024-01-08"),
  updatedAt: ts("2024-06-01"),
  createdAt: ts("2023-11-20"),
});

await setDoc("courses", "course_node_backend", {
  title: "Node.js Backend Engineering",
  slug: "nodejs-backend-engineering",
  description: "Build scalable REST APIs and microservices with Node.js, Express, PostgreSQL, Redis, and Docker.",
  shortDescription: "Build production Node.js backends.",
  instructorId: "instructor_mike",
  instructorName: "Mike Torres",
  categoryId: "cat_programming",
  categoryName: "Programming",
  level: "advanced",
  language: "English",
  priceCents: 9999,
  originalPriceCents: 24999,
  currency: "USD",
  thumbnailUrl: "https://example.com/thumbnails/node-backend.jpg",
  previewVideoUrl: "https://example.com/previews/node-backend.mp4",
  tags: ["Node.js", "Express", "PostgreSQL", "Redis", "Docker", "Backend"],
  requirements: ["JavaScript proficiency", "Basic understanding of REST APIs"],
  whatYouWillLearn: [
    "Design RESTful API architecture",
    "Work with PostgreSQL and Redis",
    "Containerize with Docker",
    "Deploy to AWS or GCP",
  ],
  totalLessons: 5,
  totalDurationMinutes: 380,
  totalStudents: 3200,
  averageRating: 4.6,
  totalReviews: 202,
  isPublished: true,
  isFeatured: false,
  publishedAt: ts("2023-10-01"),
  updatedAt: ts("2024-05-20"),
  createdAt: ts("2023-08-15"),
});

// ── 4a. LESSONS (subcollections) ──────────────────────────────────────────────
console.log("\n📁 courses/[id]/lessons/");

// Python ML lessons
const pythonLessons = [
  { id: "lesson_01", title: "Python Crash Course for ML", durationMinutes: 45, type: "video", order: 1, isPreview: true, videoUrl: "https://example.com/videos/pml-01.mp4", description: "Quick Python recap covering lists, dicts, and functions." },
  { id: "lesson_02", title: "NumPy and Pandas Fundamentals", durationMinutes: 60, type: "video", order: 2, isPreview: false, videoUrl: "https://example.com/videos/pml-02.mp4", description: "Array operations, DataFrames, and data manipulation." },
  { id: "lesson_03", title: "Your First ML Model with scikit-learn", durationMinutes: 75, type: "video", order: 3, isPreview: false, videoUrl: "https://example.com/videos/pml-03.mp4", description: "Train a linear regression model and evaluate it." },
  { id: "lesson_04", title: "Neural Networks with TensorFlow", durationMinutes: 90, type: "video", order: 4, isPreview: false, videoUrl: "https://example.com/videos/pml-04.mp4", description: "Build and train a deep neural network from scratch." },
  { id: "lesson_05", title: "Deploying ML Models to Production", durationMinutes: 50, type: "video", order: 5, isPreview: false, videoUrl: "https://example.com/videos/pml-05.mp4", description: "Serve your model via FastAPI and containerize with Docker." },
];
for (const lesson of pythonLessons) {
  await addSubDoc("courses", "course_python_ml", "lessons", lesson.id, { ...lesson, courseId: "course_python_ml", createdAt: ts("2023-02-01") });
}

// React TypeScript lessons
const reactLessons = [
  { id: "lesson_01", title: "TypeScript Foundations for React", durationMinutes: 50, type: "video", order: 1, isPreview: true, videoUrl: "https://example.com/videos/rts-01.mp4", description: "Types, interfaces, generics, and utility types." },
  { id: "lesson_02", title: "React Hooks Deep Dive", durationMinutes: 65, type: "video", order: 2, isPreview: false, videoUrl: "https://example.com/videos/rts-02.mp4", description: "useState, useEffect, useCallback, useMemo, and custom hooks." },
  { id: "lesson_03", title: "State Management with Zustand", durationMinutes: 55, type: "video", order: 3, isPreview: false, videoUrl: "https://example.com/videos/rts-03.mp4", description: "Global state, devtools, and slices pattern." },
  { id: "lesson_04", title: "Testing React Components with Vitest", durationMinutes: 60, type: "video", order: 4, isPreview: false, videoUrl: "https://example.com/videos/rts-04.mp4", description: "Unit, integration and snapshot tests." },
  { id: "lesson_05", title: "Deploying to Vercel & CI/CD", durationMinutes: 50, type: "video", order: 5, isPreview: false, videoUrl: "https://example.com/videos/rts-05.mp4", description: "GitHub Actions, preview deploys, and env secrets." },
];
for (const lesson of reactLessons) {
  await addSubDoc("courses", "course_react_typescript", "lessons", lesson.id, { ...lesson, courseId: "course_react_typescript", createdAt: ts("2023-06-01") });
}

// Data Analysis lessons
const dataLessons = [
  { id: "lesson_01", title: "Introduction to Data Analysis", durationMinutes: 40, type: "video", order: 1, isPreview: true, videoUrl: "https://example.com/videos/da-01.mp4", description: "What data analysts do and the tools they use." },
  { id: "lesson_02", title: "Loading and Cleaning Data with Pandas", durationMinutes: 70, type: "video", order: 2, isPreview: false, videoUrl: "https://example.com/videos/da-02.mp4", description: "Read CSVs, handle nulls, fix types, and reshape data." },
  { id: "lesson_03", title: "Exploratory Data Analysis (EDA)", durationMinutes: 65, type: "video", order: 3, isPreview: false, videoUrl: "https://example.com/videos/da-03.mp4", description: "Descriptive stats, correlations, and groupby patterns." },
  { id: "lesson_04", title: "Visualization with Matplotlib & Seaborn", durationMinutes: 65, type: "video", order: 4, isPreview: false, videoUrl: "https://example.com/videos/da-04.mp4", description: "Create charts, heatmaps, and dashboards." },
];
for (const lesson of dataLessons) {
  await addSubDoc("courses", "course_data_analysis", "lessons", lesson.id, { ...lesson, courseId: "course_data_analysis", createdAt: ts("2023-12-01") });
}

// Node backend lessons
const nodeLessons = [
  { id: "lesson_01", title: "Express & REST API Design", durationMinutes: 70, type: "video", order: 1, isPreview: true, videoUrl: "https://example.com/videos/nb-01.mp4", description: "Route structure, middleware, validation with Zod." },
  { id: "lesson_02", title: "PostgreSQL & Prisma ORM", durationMinutes: 80, type: "video", order: 2, isPreview: false, videoUrl: "https://example.com/videos/nb-02.mp4", description: "Schema design, migrations, and complex queries." },
  { id: "lesson_03", title: "Caching with Redis", durationMinutes: 60, type: "video", order: 3, isPreview: false, videoUrl: "https://example.com/videos/nb-03.mp4", description: "Cache strategies, pub/sub, and session storage." },
  { id: "lesson_04", title: "Auth: JWT & OAuth2", durationMinutes: 75, type: "video", order: 4, isPreview: false, videoUrl: "https://example.com/videos/nb-04.mp4", description: "Secure authentication with access/refresh tokens." },
  { id: "lesson_05", title: "Dockerize & Deploy to Cloud", durationMinutes: 95, type: "video", order: 5, isPreview: false, videoUrl: "https://example.com/videos/nb-05.mp4", description: "Multi-stage builds, docker-compose, and GCP Cloud Run." },
];
for (const lesson of nodeLessons) {
  await addSubDoc("courses", "course_node_backend", "lessons", lesson.id, { ...lesson, courseId: "course_node_backend", createdAt: ts("2023-09-01") });
}

// ── 5. ENROLLMENTS ────────────────────────────────────────────────────────────
console.log("\n📁 enrollments/");

await setDoc("enrollments", "enroll_alice_python_ml", {
  userId: "user_alice",
  courseId: "course_python_ml",
  courseTitle: "Python for Machine Learning: From Zero to Hero",
  instructorId: "instructor_sarah",
  enrolledAt: ts("2024-01-15"),
  status: "active",
  progressPercent: 80,
  completedLessons: ["lesson_01", "lesson_02", "lesson_03", "lesson_04"],
  lastAccessedAt: ts("2024-06-14"),
  lastLessonId: "lesson_04",
  paidAmountCents: 8999,
  currency: "USD",
  certificateIssued: false,
});

await setDoc("enrollments", "enroll_alice_react_ts", {
  userId: "user_alice",
  courseId: "course_react_typescript",
  courseTitle: "React & TypeScript: Build Production-Ready Apps",
  instructorId: "instructor_mike",
  enrolledAt: ts("2024-03-10"),
  status: "active",
  progressPercent: 40,
  completedLessons: ["lesson_01", "lesson_02"],
  lastAccessedAt: ts("2024-06-10"),
  lastLessonId: "lesson_02",
  paidAmountCents: 7999,
  currency: "USD",
  certificateIssued: false,
});

await setDoc("enrollments", "enroll_alice_data_analysis", {
  userId: "user_alice",
  courseId: "course_data_analysis",
  courseTitle: "Data Analysis with Python & Pandas",
  instructorId: "instructor_sarah",
  enrolledAt: ts("2023-10-05"),
  status: "completed",
  progressPercent: 100,
  completedLessons: ["lesson_01", "lesson_02", "lesson_03", "lesson_04"],
  lastAccessedAt: ts("2024-02-20"),
  lastLessonId: "lesson_04",
  paidAmountCents: 5999,
  currency: "USD",
  certificateIssued: true,
  completedAt: ts("2024-02-20"),
});

await setDoc("enrollments", "enroll_bob_react_ts", {
  userId: "user_bob",
  courseId: "course_react_typescript",
  courseTitle: "React & TypeScript: Build Production-Ready Apps",
  instructorId: "instructor_mike",
  enrolledAt: ts("2024-02-01"),
  status: "active",
  progressPercent: 60,
  completedLessons: ["lesson_01", "lesson_02", "lesson_03"],
  lastAccessedAt: ts("2024-06-09"),
  lastLessonId: "lesson_03",
  paidAmountCents: 7999,
  currency: "USD",
  certificateIssued: false,
});

await setDoc("enrollments", "enroll_bob_node_backend", {
  userId: "user_bob",
  courseId: "course_node_backend",
  courseTitle: "Node.js Backend Engineering",
  instructorId: "instructor_mike",
  enrolledAt: ts("2024-04-20"),
  status: "active",
  progressPercent: 20,
  completedLessons: ["lesson_01"],
  lastAccessedAt: ts("2024-05-15"),
  lastLessonId: "lesson_01",
  paidAmountCents: 9999,
  currency: "USD",
  certificateIssued: false,
});

await setDoc("enrollments", "enroll_carol_python_ml", {
  userId: "user_carol",
  courseId: "course_python_ml",
  courseTitle: "Python for Machine Learning: From Zero to Hero",
  instructorId: "instructor_sarah",
  enrolledAt: ts("2023-11-01"),
  status: "completed",
  progressPercent: 100,
  completedLessons: ["lesson_01", "lesson_02", "lesson_03", "lesson_04", "lesson_05"],
  lastAccessedAt: ts("2024-03-10"),
  lastLessonId: "lesson_05",
  paidAmountCents: 8999,
  currency: "USD",
  certificateIssued: true,
  completedAt: ts("2024-03-10"),
});

await setDoc("enrollments", "enroll_carol_data_analysis", {
  userId: "user_carol",
  courseId: "course_data_analysis",
  courseTitle: "Data Analysis with Python & Pandas",
  instructorId: "instructor_sarah",
  enrolledAt: ts("2023-07-15"),
  status: "completed",
  progressPercent: 100,
  completedLessons: ["lesson_01", "lesson_02", "lesson_03", "lesson_04"],
  lastAccessedAt: ts("2023-10-01"),
  lastLessonId: "lesson_04",
  paidAmountCents: 5999,
  currency: "USD",
  certificateIssued: true,
  completedAt: ts("2023-10-01"),
});

await setDoc("enrollments", "enroll_carol_react_ts", {
  userId: "user_carol",
  courseId: "course_react_typescript",
  courseTitle: "React & TypeScript: Build Production-Ready Apps",
  instructorId: "instructor_mike",
  enrolledAt: ts("2024-05-01"),
  status: "active",
  progressPercent: 20,
  completedLessons: ["lesson_01"],
  lastAccessedAt: ts("2024-06-01"),
  lastLessonId: "lesson_01",
  paidAmountCents: 7999,
  currency: "USD",
  certificateIssued: false,
});

await setDoc("enrollments", "enroll_carol_node_backend", {
  userId: "user_carol",
  courseId: "course_node_backend",
  courseTitle: "Node.js Backend Engineering",
  instructorId: "instructor_mike",
  enrolledAt: ts("2024-06-01"),
  status: "active",
  progressPercent: 0,
  completedLessons: [],
  lastAccessedAt: ts("2024-06-02"),
  lastLessonId: null,
  paidAmountCents: 9999,
  currency: "USD",
  certificateIssued: false,
});

await setDoc("enrollments", "enroll_dave_data_analysis", {
  userId: "user_dave",
  courseId: "course_data_analysis",
  courseTitle: "Data Analysis with Python & Pandas",
  instructorId: "instructor_sarah",
  enrolledAt: ts("2024-04-01"),
  status: "active",
  progressPercent: 25,
  completedLessons: ["lesson_01"],
  lastAccessedAt: ts("2024-05-20"),
  lastLessonId: "lesson_01",
  paidAmountCents: 5999,
  currency: "USD",
  certificateIssued: false,
});

// ── 6. QUIZZES ────────────────────────────────────────────────────────────────
console.log("\n📁 quizzes/");

await setDoc("quizzes", "quiz_python_ml_basics", {
  courseId: "course_python_ml",
  title: "Python & ML Fundamentals Quiz",
  description: "Test your understanding of Python basics and ML concepts.",
  afterLessonId: "lesson_02",
  passingScore: 70,
  timeLimitMinutes: 20,
  totalQuestions: 4,
  isPublished: true,
  createdAt: ts("2023-03-01"),
});

await setDoc("quizzes", "quiz_react_hooks", {
  courseId: "course_react_typescript",
  title: "React Hooks & TypeScript Quiz",
  description: "Assess your knowledge of React hooks and TypeScript patterns.",
  afterLessonId: "lesson_02",
  passingScore: 75,
  timeLimitMinutes: 15,
  totalQuestions: 4,
  isPublished: true,
  createdAt: ts("2023-07-01"),
});

// ── 6a. QUESTIONS (subcollections) ────────────────────────────────────────────
console.log("\n📁 quizzes/[id]/questions/");

const mlQuestions = [
  {
    id: "q1",
    text: "Which Python library is primarily used for numerical array operations in ML?",
    options: ["pandas", "numpy", "matplotlib", "requests"],
    correctOption: 1,
    explanation: "NumPy provides fast multi-dimensional array operations, which are foundational to ML frameworks.",
    points: 25,
  },
  {
    id: "q2",
    text: "What does a DataFrame in pandas represent?",
    options: ["A single numerical value", "A 1D array", "A 2D tabular data structure", "A neural network layer"],
    correctOption: 2,
    explanation: "A DataFrame is a 2D labeled data structure with rows and columns, similar to a spreadsheet.",
    points: 25,
  },
  {
    id: "q3",
    text: "Which metric is used to evaluate regression models?",
    options: ["Accuracy", "F1 Score", "Mean Squared Error", "AUC-ROC"],
    correctOption: 2,
    explanation: "MSE measures the average squared difference between predictions and actual values — key for regression.",
    points: 25,
  },
  {
    id: "q4",
    text: "What is overfitting in machine learning?",
    options: [
      "Model performs well on training and test data",
      "Model performs well on training data but poorly on new data",
      "Model is too simple to capture patterns",
      "Model has too few parameters",
    ],
    correctOption: 1,
    explanation: "Overfitting happens when the model memorizes training data instead of learning generalizable patterns.",
    points: 25,
  },
];
for (const q of mlQuestions) {
  await addSubDoc("quizzes", "quiz_python_ml_basics", "questions", q.id, { ...q, quizId: "quiz_python_ml_basics" });
}

const reactQuestions = [
  {
    id: "q1",
    text: "Which hook should you use to run a side effect after a component renders?",
    options: ["useState", "useEffect", "useCallback", "useMemo"],
    correctOption: 1,
    explanation: "useEffect runs after every render (or selectively based on dependencies) for side effects like API calls.",
    points: 25,
  },
  {
    id: "q2",
    text: "What does the TypeScript `interface` keyword define?",
    options: ["A class", "A shape for an object type", "A function", "An enum"],
    correctOption: 1,
    explanation: "An interface defines the shape (property names and types) that an object must conform to.",
    points: 25,
  },
  {
    id: "q3",
    text: "Which hook prevents a function from being recreated on every render?",
    options: ["useState", "useEffect", "useCallback", "useRef"],
    correctOption: 2,
    explanation: "useCallback memoizes a function reference so it only changes when its dependencies change.",
    points: 25,
  },
  {
    id: "q4",
    text: "In React, what triggers a component to re-render?",
    options: [
      "A variable changes",
      "State or props change",
      "A function is called",
      "A constant is reassigned",
    ],
    correctOption: 1,
    explanation: "React re-renders a component when its state (via useState/useReducer) or props change.",
    points: 25,
  },
];
for (const q of reactQuestions) {
  await addSubDoc("quizzes", "quiz_react_hooks", "questions", q.id, { ...q, quizId: "quiz_react_hooks" });
}

// ── 7. QUIZ ATTEMPTS ──────────────────────────────────────────────────────────
console.log("\n📁 quiz_attempts/");

await setDoc("quiz_attempts", "attempt_alice_ml_1", {
  userId: "user_alice",
  quizId: "quiz_python_ml_basics",
  courseId: "course_python_ml",
  attemptNumber: 1,
  score: 75,
  passed: true,
  answers: [
    { questionId: "q1", selectedOption: 1, correct: true },
    { questionId: "q2", selectedOption: 2, correct: true },
    { questionId: "q3", selectedOption: 0, correct: false },
    { questionId: "q4", selectedOption: 1, correct: true },
  ],
  timeTakenSeconds: 840,
  completedAt: ts("2024-02-10"),
});

await setDoc("quiz_attempts", "attempt_carol_ml_1", {
  userId: "user_carol",
  quizId: "quiz_python_ml_basics",
  courseId: "course_python_ml",
  attemptNumber: 1,
  score: 100,
  passed: true,
  answers: [
    { questionId: "q1", selectedOption: 1, correct: true },
    { questionId: "q2", selectedOption: 2, correct: true },
    { questionId: "q3", selectedOption: 2, correct: true },
    { questionId: "q4", selectedOption: 1, correct: true },
  ],
  timeTakenSeconds: 610,
  completedAt: ts("2024-01-20"),
});

await setDoc("quiz_attempts", "attempt_bob_react_1", {
  userId: "user_bob",
  quizId: "quiz_react_hooks",
  courseId: "course_react_typescript",
  attemptNumber: 1,
  score: 50,
  passed: false,
  answers: [
    { questionId: "q1", selectedOption: 0, correct: false },
    { questionId: "q2", selectedOption: 1, correct: true },
    { questionId: "q3", selectedOption: 2, correct: true },
    { questionId: "q4", selectedOption: 0, correct: false },
  ],
  timeTakenSeconds: 720,
  completedAt: ts("2024-03-15"),
});

await setDoc("quiz_attempts", "attempt_bob_react_2", {
  userId: "user_bob",
  quizId: "quiz_react_hooks",
  courseId: "course_react_typescript",
  attemptNumber: 2,
  score: 75,
  passed: true,
  answers: [
    { questionId: "q1", selectedOption: 1, correct: true },
    { questionId: "q2", selectedOption: 1, correct: true },
    { questionId: "q3", selectedOption: 2, correct: true },
    { questionId: "q4", selectedOption: 0, correct: false },
  ],
  timeTakenSeconds: 540,
  completedAt: ts("2024-03-20"),
});

// ── 8. REVIEWS ────────────────────────────────────────────────────────────────
console.log("\n📁 reviews/");

await setDoc("reviews", "review_alice_python_ml", {
  userId: "user_alice",
  courseId: "course_python_ml",
  instructorId: "instructor_sarah",
  rating: 5,
  title: "Best ML course I've taken!",
  body: "Dr. Chen explains complex concepts in a very approachable way. The hands-on projects are excellent and the TensorFlow section is gold.",
  isVerifiedPurchase: true,
  isPublished: true,
  helpfulVotes: 42,
  createdAt: ts("2024-05-01"),
});

await setDoc("reviews", "review_carol_python_ml", {
  userId: "user_carol",
  courseId: "course_python_ml",
  instructorId: "instructor_sarah",
  rating: 5,
  title: "Completed and got a job!",
  body: "After finishing this course I landed a junior ML engineer role. The production deployment section was invaluable.",
  isVerifiedPurchase: true,
  isPublished: true,
  helpfulVotes: 89,
  createdAt: ts("2024-04-15"),
});

await setDoc("reviews", "review_bob_react_ts", {
  userId: "user_bob",
  courseId: "course_react_typescript",
  instructorId: "instructor_mike",
  rating: 4,
  title: "Great content, pacing could be better",
  body: "The TypeScript sections are superb. The Zustand module felt a bit rushed. Overall highly recommended for React developers.",
  isVerifiedPurchase: true,
  isPublished: true,
  helpfulVotes: 15,
  createdAt: ts("2024-05-20"),
});

await setDoc("reviews", "review_alice_data_analysis", {
  userId: "user_alice",
  courseId: "course_data_analysis",
  instructorId: "instructor_sarah",
  rating: 5,
  title: "Perfect for beginners",
  body: "I had zero data analysis experience. After this course I'm confidently working with real datasets at my job.",
  isVerifiedPurchase: true,
  isPublished: true,
  helpfulVotes: 31,
  createdAt: ts("2024-03-01"),
});

await setDoc("reviews", "review_carol_data_analysis", {
  userId: "user_carol",
  courseId: "course_data_analysis",
  instructorId: "instructor_sarah",
  rating: 4,
  title: "Solid foundations course",
  body: "Covers all the essential pandas operations. Would love a section on time-series data. Great starting point regardless.",
  isVerifiedPurchase: true,
  isPublished: true,
  helpfulVotes: 22,
  createdAt: ts("2023-11-01"),
});

// ── 9. CERTIFICATES ────────────────────────────────────────────────────────────
console.log("\n📁 certificates/");

await setDoc("certificates", "cert_alice_data_analysis", {
  userId: "user_alice",
  courseId: "course_data_analysis",
  courseTitle: "Data Analysis with Python & Pandas",
  instructorName: "Dr. Sarah Chen",
  studentName: "Alice Martin",
  certificateNumber: "CERT-2024-DA-0041",
  issuedAt: ts("2024-02-20"),
  verificationUrl: "https://courseai.com/verify/CERT-2024-DA-0041",
});

await setDoc("certificates", "cert_carol_python_ml", {
  userId: "user_carol",
  courseId: "course_python_ml",
  courseTitle: "Python for Machine Learning: From Zero to Hero",
  instructorName: "Dr. Sarah Chen",
  studentName: "Carol Williams",
  certificateNumber: "CERT-2024-PML-0022",
  issuedAt: ts("2024-03-10"),
  verificationUrl: "https://courseai.com/verify/CERT-2024-PML-0022",
});

await setDoc("certificates", "cert_carol_data_analysis", {
  userId: "user_carol",
  courseId: "course_data_analysis",
  courseTitle: "Data Analysis with Python & Pandas",
  instructorName: "Dr. Sarah Chen",
  studentName: "Carol Williams",
  certificateNumber: "CERT-2023-DA-0015",
  issuedAt: ts("2023-10-01"),
  verificationUrl: "https://courseai.com/verify/CERT-2023-DA-0015",
});

// ── Summary ────────────────────────────────────────────────────────────────────
console.log("\n✅ Firestore seeded successfully!\n");
console.log("📊 Collections created:");
const summary = [
  ["users",          6],
  ["instructors",    2],
  ["categories",     4],
  ["courses",        4],
  ["  └ lessons",   19],
  ["enrollments",   10],
  ["quizzes",        2],
  ["  └ questions",  8],
  ["quiz_attempts",  4],
  ["reviews",        5],
  ["certificates",   3],
];
for (const [name, count] of summary) {
  console.log(`   ${String(name).padEnd(20)} ${count} documents`);
}
console.log("\n🚀 Ready! Run the agent with:\n   npm start\n");
