CREATE TABLE "papers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"question_text" text NOT NULL,
	"choices" jsonb NOT NULL,
	"correct_choice" integer NOT NULL,
	"explanation" text,
	"order_index" integer NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" integer,
	"time_remaining" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;