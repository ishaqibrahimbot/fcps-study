import { useState } from "react";
import { Form, useActionData, useNavigation, Link } from "react-router";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { extractQuestionsFromPages } from "~/lib/question-extractor";
import { estimateCost, formatCost } from "~/lib/gemini-client";
import { db } from "~/db";
import { papers, questions } from "~/db/schema";
import type { Route } from "./+types/admin.upload";

// Simple password protection via environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const password = formData.get("password") as string;
  const paperName = formData.get("name") as string;
  const source = formData.get("source") as string;
  const startPage = parseInt(formData.get("startPage") as string);
  const endPage = parseInt(formData.get("endPage") as string);
  const file = formData.get("pdf") as File | null;
  const dryRun = formData.get("dryRun") === "true";

  // Validate password
  if (password !== ADMIN_PASSWORD) {
    return { error: "Invalid password", success: false };
  }

  if (!file || !paperName || !source || isNaN(startPage) || isNaN(endPage)) {
    return { error: "Missing required fields", success: false };
  }

  if (startPage < 1 || endPage < startPage) {
    return { error: "Invalid page range", success: false };
  }

  // Save file temporarily
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-upload-"));
  const tempFilePath = path.join(tempDir, "upload.pdf");

  try {
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    // Extract questions
    const result = await extractQuestionsFromPages(
      tempFilePath,
      startPage,
      endPage
    );

    const stats = {
      totalQuestions: result.questions.length,
      pagesProcessed: result.pagesProcessed,
      tokensUsed: result.totalUsage.totalTokens,
      estimatedCost: formatCost(estimateCost(result.totalUsage)),
    };

    if (dryRun) {
      // Return preview data
      return {
        success: true,
        dryRun: true,
        paper: {
          name: paperName,
          source,
          pageRange: `${startPage}-${endPage}`,
          questionCount: result.questions.length,
          sampleQuestion: result.questions[0]?.questionText || null,
        },
        stats,
      };
    }

    // Save to database
    const [insertedPaper] = await db
      .insert(papers)
      .values({
        name: paperName,
        source,
        questionCount: result.questions.length,
      })
      .returning();

    if (result.questions.length > 0) {
      await db.insert(questions).values(
        result.questions.map((q, idx) => ({
          paperId: insertedPaper.id,
          questionText: q.questionText,
          choices: q.choices,
          correctChoice: q.correctChoice ?? 0,
          explanation: null,
          orderIndex: idx,
        }))
      );
    }

    return {
      success: true,
      dryRun: false,
      savedPaper: `${paperName} (${result.questions.length} questions)`,
      stats,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unknown error occurred",
      success: false,
    };
  } finally {
    // Cleanup temp files
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function meta() {
  return [{ title: "Admin - Upload PDF - FCPS Study" }];
}

export default function AdminUpload() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [dryRun, setDryRun] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-white">
                  Admin Upload
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Import a single paper from PDF
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Upload Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6">
          <Form method="post" encType="multipart/form-data">
            <div className="space-y-4">
              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter admin password"
                />
              </div>

              {/* PDF File */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  PDF File
                </label>
                <input
                  type="file"
                  name="pdf"
                  accept=".pdf"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-primary-500 file:text-white file:font-medium"
                />
              </div>

              {/* Paper Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Paper Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Anatomy Paper 1"
                />
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Source
                </label>
                <input
                  type="text"
                  name="source"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., SK Book Series"
                />
              </div>

              {/* Page Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Page (PDF)
                  </label>
                  <input
                    type="number"
                    name="startPage"
                    min="1"
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Page (PDF)
                  </label>
                  <input
                    type="number"
                    name="endPage"
                    min="1"
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 25"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use actual PDF page numbers (not printed book page numbers)
              </p>

              {/* Dry Run Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="dryRun"
                  name="dryRun"
                  value="true"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 text-primary-500 rounded border-slate-300 focus:ring-primary-500"
                />
                <label
                  htmlFor="dryRun"
                  className="text-sm text-slate-700 dark:text-slate-300"
                >
                  Dry run (preview only, don't save to database)
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    {dryRun ? "Preview Extraction" : "Upload & Save"}
                  </>
                )}
              </button>
            </div>
          </Form>
        </div>

        {/* Results */}
        {actionData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            {actionData.error ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-error-100 dark:bg-error-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-error-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Error
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  {actionData.error}
                </p>
              </div>
            ) : actionData.success ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-success-100 dark:bg-success-900/40 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-success-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {actionData.dryRun ? "Preview Complete" : "Upload Complete"}
                  </h3>
                </div>

                {/* Stats */}
                {actionData.stats && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xl font-bold text-primary-500">
                        {actionData.stats.totalQuestions}
                      </p>
                      <p className="text-xs text-slate-500">Questions</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {actionData.stats.pagesProcessed}
                      </p>
                      <p className="text-xs text-slate-500">Pages</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {actionData.stats.estimatedCost}
                      </p>
                      <p className="text-xs text-slate-500">API Cost</p>
                    </div>
                  </div>
                )}

                {/* Paper info */}
                {actionData.paper && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-4">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {actionData.paper.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      Pages {actionData.paper.pageRange} •{" "}
                      {actionData.paper.questionCount} questions
                    </p>
                    {actionData.paper.sampleQuestion && (
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        Sample: "{actionData.paper.sampleQuestion}"
                      </p>
                    )}
                  </div>
                )}

                {actionData.savedPaper && (
                  <p className="text-sm text-success-600 dark:text-success-400">
                    ✓ Saved: {actionData.savedPaper}
                  </p>
                )}

                {actionData.dryRun && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
                    This was a dry run. Uncheck "Dry run" to save to database.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
