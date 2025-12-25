import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Papers table - represents a collection of questions from a specific source
export const papers = pgTable("papers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull(), // e.g., "SK Book", "AA Book"
  questionCount: integer("question_count").notNull().default(0),
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
export const testSessions = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  paperId: integer("paper_id")
    .references(() => papers.id, { onDelete: "cascade" })
    .notNull(),
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

// Relations
export const papersRelations = relations(papers, ({ many }) => ({
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
}));

// Type exports for use in the application
export type Paper = typeof papers.$inferSelect;
export type NewPaper = typeof papers.$inferInsert;

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export type TestSession = typeof testSessions.$inferSelect;
export type NewTestSession = typeof testSessions.$inferInsert;
