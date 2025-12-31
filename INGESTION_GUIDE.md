# PDF Ingestion Guide

This guide explains how to extract MCQ questions from scanned PDF books and import them into the Neon PostgreSQL database.

## Prerequisites

1. **Environment Variables** - Create a `.env` file with:

   ```
   DATABASE_URL=postgresql://user:password@host/database
   GEMINI_API_KEY=your-gemini-api-key

   # Optional: for full app functionality
   AUTH_SECRET=your-32-character-random-secret
   AUTH_GOOGLE_ID=your-google-oauth-client-id
   AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
   RESEND_API_KEY=your-resend-api-key
   ```

2. **PDF Files** - Place your PDF files in the `books/` directory (or any accessible path)

3. **Dependencies** - Ensure all packages are installed:
   ```bash
   npm install
   ```

---

## Workflow Overview

```
PDF File → ingest (dry-run) → JSON Output → Review → explain (optional) → import → Neon Database
```

**Recommended approach:**

1. Use `--dry-run` first to preview the extraction
2. Review the JSON output for quality
3. (Optional) Generate AI explanations with `explain`
4. Import the final JSON to the database

---

## Step 1: Ingest Questions from PDF

The `ingest` command extracts MCQ questions from a specific page range in a PDF using Gemini AI for OCR.

### Command Syntax

```bash
npm run ingest -- \
  --file <path-to-pdf> \
  --name "<paper-name>" \
  --source "<source-name>" \
  --start <start-page> \
  --end <end-page> \
  [--dry-run] \
  [--output <output-dir>]
```

### Options

| Option                  | Required | Description                                             |
| ----------------------- | -------- | ------------------------------------------------------- |
| `-f, --file <path>`     | ✅       | Path to PDF file                                        |
| `-n, --name <name>`     | ✅       | Paper name (e.g., "Medicine Paper 1")                   |
| `-s, --source <source>` | ✅       | Source name (e.g., "SK Book Series")                    |
| `--start <page>`        | ✅       | Start page number (PDF page, 1-indexed)                 |
| `--end <page>`          | ✅       | End page number (PDF page, 1-indexed)                   |
| `-d, --dry-run`         | ❌       | Preview extraction, save to JSON instead of database    |
| `-o, --output <dir>`    | ❌       | Output directory for dry-run JSON (default: `./output`) |

### Examples

#### Dry Run (Recommended First Step)

```bash
# Extract questions from pages 1-22 of the PDF, save to JSON for review
npm run ingest -- \
  --file books/SK_19_Vol_1.pdf \
  --name "Medicine 20 August Afternoon" \
  --source "SK 19 Vol 1" \
  --start 1 \
  --end 22 \
  --dry-run
```

Output:

```
✅ Extracted 153 questions
📁 Output saved to: ./output/Medicine_20_August_Afternoon-1766666849619.json

To import this to the database, run:
   npm run import -- --file "./output/Medicine_20_August_Afternoon-1766666849619.json"
```

#### Direct Import (Skip Review)

```bash
# Extract and immediately save to database (no --dry-run flag)
npm run ingest -- \
  --file books/SK_19_Vol_1.pdf \
  --name "Medicine Paper 2" \
  --source "SK 19 Vol 1" \
  --start 23 \
  --end 44
```

---

## Step 2: Review JSON Output

After a dry run, review the generated JSON file in the `output/` directory.

### JSON Structure

```json
{
  "name": "Medicine 20 August Afternoon",
  "source": "SK 19 Vol 1",
  "startPage": 1,
  "endPage": 22,
  "questions": [
    {
      "questionText": "After myocardial injury what biochemical changes...",
      "choices": ["Option A", "Option B", "Option C", "Option D"],
      "correctChoice": 2,
      "orderIndex": 0
    }
  ],
  "stats": {
    "totalQuestions": 153,
    "pagesProcessed": 22,
    "tokensUsed": 61175,
    "estimatedCost": "$0.0348"
  }
}
```

### Things to Check

- `totalQuestions` - Does it match expected count?
- `correctChoice` - `null` means the AI couldn't determine the correct answer
- `choices` - Empty array `[]` means choices couldn't be extracted
- Question text quality - Any OCR errors?

---

## Step 3: Import JSON to Database

The `import` command pushes the extracted questions from a JSON file into the Neon database. Papers are global and can be assigned an access tier (free or premium).

### Command Syntax

```bash
npm run import -- --file <path-to-json> [--tier <tier>] [--skip-existing]
```

### Options

| Option              | Required | Description                                         |
| ------------------- | -------- | --------------------------------------------------- |
| `-f, --file <path>` | ✅       | Path to JSON file (from dry-run output)             |
| `-t, --tier <tier>` | ❌       | Access tier: 'free' or 'premium' (default: premium) |
| `--skip-existing`   | ❌       | Skip if paper with same name already exists         |

### Examples

#### Basic Import (Premium by default)

```bash
npm run import -- \
  --file output/Medicine_20_August_Afternoon-1766666849619.json
```

#### Import as Free Paper

```bash
npm run import -- \
  --file output/Medicine_20_August_Afternoon-1766666849619.json \
  --tier free
```

Output:

```
📥 Import to Database
==================================================
File: /path/to/output/Medicine_20_August_Afternoon-1766666849619.json
Access Tier: premium
==================================================

Paper: Medicine 20 August Afternoon
Source: SK 19 Vol 1
Questions: 153

💾 Saving to database...
   ✓ Created paper: Medicine 20 August Afternoon (ID: 1, Tier: premium)
   ✓ Inserted 153 questions (45 with explanations)

✅ Import complete!
```

#### Skip Existing Papers

```bash
# Won't create duplicate if paper already exists for this user
npm run import -- --file output/paper.json --user doctor@example.com --skip-existing
```

> **Note:** The user must already exist in the database. Create an account by signing up through the web app first.

---

## Migrating Existing Data

If you have existing papers/sessions from before authentication was added, use the migration script:

```bash
# Preview what will be migrated (dry run)
npm run migrate-user -- --user doctor@example.com --dry-run

# Actually migrate the data
npm run migrate-user -- --user doctor@example.com
```

This associates any "orphaned" papers and test sessions (those without a userId) with the specified user.

---

## Combining Split Papers

If you had to run the ingest command multiple times for the same paper (e.g., different page ranges), you can combine them:

```bash
npx tsx scripts/combine-papers.ts
```

> **Note:** Edit `scripts/combine-papers.ts` to specify the correct file paths before running.

---

## Step 4: Generate Explanations (Optional)

The `explain` command uses Gemini AI to generate detailed explanations for each question based on the correct answer.

### Command Syntax

```bash
npm run explain -- --file <path-to-json> [options]
```

### Options

| Option                 | Required | Description                                                     |
| ---------------------- | -------- | --------------------------------------------------------------- |
| `-f, --file <path>`    | ✅       | Path to JSON file with questions                                |
| `-o, --output <path>`  | ❌       | Output file path (default: input file with `-explained` suffix) |
| `-b, --batch-size <n>` | ❌       | Questions to process before checkpoint save (default: 10)       |
| `--resume`             | ❌       | Resume from existing output file if it exists                   |
| `--skip-existing`      | ❌       | Skip questions that already have explanations                   |

### Examples

#### Basic Usage

```bash
npm run explain -- --file output/SK_19_Vol_1-combined.json
```

This will:

- Process all questions that have a correct answer
- Save to `output/SK_19_Vol_1-combined-explained.json`
- Create checkpoints every 10 questions

#### Resume After Interruption

```bash
# If the process was interrupted, resume from where it left off
npm run explain -- \
  --file output/SK_19_Vol_1-combined.json \
  --resume \
  --skip-existing
```

#### Custom Output Path

```bash
npm run explain -- \
  --file output/paper.json \
  --output output/paper-with-explanations.json
```

### Output

The script adds an `explanation` field to each question:

```json
{
  "questionText": "After myocardial injury what biochemical changes...",
  "choices": ["Aerobic Glycolysis", "Oxidative Phosphorylation", ...],
  "correctChoice": 2,
  "orderIndex": 0,
  "explanation": "The correct answer is C (Anaerobic Glycolysis + Glycogenesis)..."
}
```

### Notes

- Questions with `correctChoice: null` are skipped (no correct answer to explain)
- Each question takes ~1-2 seconds to process
- Cost is ~$0.001 per question
- Checkpoints are saved every batch to prevent data loss

---

## Tips & Best Practices

### 1. Page Numbers

PDF page numbers may not match printed book page numbers. Open the PDF and note the actual PDF page numbers for each paper.

### 2. Processing Speed

- Each page takes ~2-3 minutes to process (PDF → image → Gemini OCR)
- A 20-page paper takes ~40-60 minutes
- Consider running on a cloud VM for large batches (see `CLOUD_VM_SETUP.md`)

### 3. Cost Management

- Gemini 2.5 Flash pricing: ~$0.002 per page
- A typical paper (20 pages) costs ~$0.04
- Always use `--dry-run` first to avoid wasting API calls

### 4. Error Recovery

If ingestion fails mid-way:

1. Note which page it failed on
2. Re-run with adjusted `--start` page
3. Combine the JSON outputs using the combine script

---

## Troubleshooting

### "GEMINI_API_KEY environment variable is not set"

Make sure your `.env` file contains:

```
GEMINI_API_KEY=your-api-key-here
```

### "DATABASE_URL environment variable is not set"

Make sure your `.env` file contains:

```
DATABASE_URL=postgresql://...
```

### "Invalid start/end page"

Check the total page count of your PDF. Page numbers are 1-indexed.

### Questions have empty choices

The OCR couldn't extract the choices - this usually happens with:

- Poor scan quality
- Unusual formatting
- Choices split across pages

---

## Subscription & Access Management

Papers can be marked as 'free' or 'premium'. Users can be 'free' or 'subscribed'.

### Set User Subscription

```bash
# Upgrade a user to premium
npm run set-subscription -- --email user@example.com --status subscribed

# Downgrade to free
npm run set-subscription -- --email user@example.com --status free
```

### Migrate Existing Data

After updating to the access system, run the migration to set defaults:

```bash
# Preview changes
npm run migrate-access -- --dry-run

# Apply changes
npm run migrate-access

# Optionally upgrade a user during migration
npm run migrate-access -- --upgrade-user admin@example.com
```

---

## File Structure

```
flashcard-app/
├── books/                    # Place PDF files here
│   └── SK_19_Vol_1.pdf
├── output/                   # Dry-run JSON output goes here
│   ├── Paper_Name-timestamp.json
│   └── Paper_Name-explained.json
├── scripts/
│   ├── ingest.ts                  # PDF ingestion script
│   ├── import.ts                  # Database import script
│   ├── generate-explanations.ts   # AI explanation generator
│   ├── combine-papers.ts          # Combine split papers
│   ├── set-subscription.ts        # Manage user subscriptions
│   └── migrate-access-system.ts   # Migrate to access control system
└── .env                     # Environment variables
```
