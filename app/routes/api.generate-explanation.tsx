import { db } from "~/db";
import { questions } from "~/db/schema";
import { eq } from "drizzle-orm";
import { generateExplanation } from "~/lib/explanation-generator.server";
import type { Route } from "./+types/api.generate-explanation";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const questionId = parseInt(formData.get("questionId") as string);

    if (isNaN(questionId)) {
      return Response.json({ error: "Invalid question ID" }, { status: 400 });
    }

    // Get the question from the database
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!question) {
      return Response.json({ error: "Question not found" }, { status: 404 });
    }

    // Check if the question already has an explanation
    if (question.explanation) {
      return Response.json({
        success: true,
        explanation: question.explanation,
        cached: true,
      });
    }

    // Generate the explanation using Gemini
    const explanation = await generateExplanation(question);

    // Update the question in the database
    await db
      .update(questions)
      .set({ explanation })
      .where(eq(questions.id, questionId));

    return Response.json({
      success: true,
      explanation,
      cached: false,
    });
  } catch (error) {
    console.error("Error generating explanation:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate explanation",
      },
      { status: 500 }
    );
  }
}
