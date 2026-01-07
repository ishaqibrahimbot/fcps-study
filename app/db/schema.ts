import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// OAuth account types
type AccountType = "oauth" | "oidc" | "email" | "credentials";

// ============================================
// AUTH TABLES (Auth.js / NextAuth)
// ============================================

// Users table - stores user accounts
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"), // null for OAuth-only users
  // Subscription fields
  subscriptionStatus: text("subscription_status")
    .$type<"free" | "subscribed">()
    .default("free")
    .notNull(),
  subscribedAt: timestamp("subscribed_at", { mode: "date" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Accounts table - OAuth provider accounts linked to users
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

// Sessions table - active user sessions
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// Verification tokens - for email verification
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

// Password reset tokens - for password reset flow
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// APPLICATION TABLES
// ============================================

// Books table - top-level collection (e.g., "AA Notes 3rd Edition", "SK Book Series")
// Access control is at the paper level, not book level
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  coverImage: text("cover_image"), // URL to cover image
  orderIndex: integer("order_index").notNull().default(0), // For ordering books in UI
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chapters table - chapters within a book (e.g., "Anatomy", "Physiology")
export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .references(() => books.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0), // For ordering chapters within book
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Papers table - represents a collection of questions (section within a chapter)
// Papers are global (shared across all users), access is controlled by accessTier
export const papers = pgTable("papers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull(), // e.g., "SK Book", "AA Book"
  // Hierarchical structure (nullable for backward compatibility)
  bookId: integer("book_id").references(() => books.id, {
    onDelete: "cascade",
  }),
  chapterId: integer("chapter_id").references(() => chapters.id, {
    onDelete: "cascade",
  }),
  orderIndex: integer("order_index").notNull().default(0), // For ordering within chapter
  questionCount: integer("question_count").notNull().default(0),
  accessTier: text("access_tier")
    .$type<"free" | "premium">()
    .default("premium")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Questions table - individual MCQ questions
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  paperId: integer("paper_id")
    .references(() => papers.id, { onDelete: "cascade" })
    .notNull(),
  questionText: text("question_text").notNull(),
  choices: jsonb("choices").$type<string[]>().notNull(), // Array of choice strings
  correctChoice: integer("correct_choice").notNull(), // Index of correct choice (0-based)
  explanation: text("explanation"), // Can be null if not available
  orderIndex: integer("order_index").notNull(), // Order within the paper
  flagged: boolean("flagged").default(false).notNull(), // Flagged as inaccurate by user
});

// Test sessions - tracks user progress through papers
// Sessions are per-user to track individual progress
export const testSessions = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  paperId: integer("paper_id")
    .references(() => papers.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // nullable for legacy data
  mode: text("mode").notNull().$type<"test" | "learning">(),
  status: text("status").notNull().$type<"in_progress" | "completed">(),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  answers: jsonb("answers")
    .$type<Record<number, number>>()
    .notNull()
    .default({}), // questionId -> selectedChoice
  score: integer("score"), // null until completed
  timeRemaining: integer("time_remaining"), // in seconds, for test mode
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ============================================
// RELATIONS
// ============================================

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  testSessions: many(testSessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Application relations
export const booksRelations = relations(books, ({ many }) => ({
  chapters: many(chapters),
  papers: many(papers),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id],
  }),
  papers: many(papers),
}));

export const papersRelations = relations(papers, ({ one, many }) => ({
  book: one(books, {
    fields: [papers.bookId],
    references: [books.id],
  }),
  chapter: one(chapters, {
    fields: [papers.chapterId],
    references: [chapters.id],
  }),
  questions: many(questions),
  testSessions: many(testSessions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  paper: one(papers, {
    fields: [questions.paperId],
    references: [papers.id],
  }),
}));

export const testSessionsRelations = relations(testSessions, ({ one }) => ({
  paper: one(papers, {
    fields: [testSessions.paperId],
    references: [papers.id],
  }),
  user: one(users, {
    fields: [testSessions.userId],
    references: [users.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;

export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;

export type Paper = typeof papers.$inferSelect;
export type NewPaper = typeof papers.$inferInsert;

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export type TestSession = typeof testSessions.$inferSelect;
export type NewTestSession = typeof testSessions.$inferInsert;
