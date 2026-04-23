# `scripts/`

Utilities for Signtify. All scripts are CommonJS and intended to run with plain `node`.

## `seedExams.cjs` — populate proficiency exams

> **Note:** the script is `.cjs` because the repo's `package.json` sets
> `"type": "module"`. Invoke it as shown below.


Seeds the Firestore `exams` collection with 4 default proficiency exams:

| Order | Exam | Category | Questions | Passing | Time |
|---|---|---|---|---|---|
| 1 | Alphabet | `alphabet` | 15 | 80% | 15 min |
| 2 | Greetings | `greetings` | 12 | 80% | 12 min |
| 3 | Numbers | `numbers` | 10 | 80% | 10 min |
| 4 | Daily Conversation | `daily-conversation` | 9 | 80% | 10 min |

### One-time setup

1. Generate a service account key in the Firebase Console:
   **Project Settings → Service accounts → Generate new private key**.
2. Save the JSON somewhere *outside the repo* (it's a secret).
3. Export its path:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
   ```
4. Make sure `firebase-admin` is installed. Two options:
   ```bash
   # (a) Install at repo root as a dev dependency
   npm install --save-dev firebase-admin

   # (b) If you already use the Cloud Functions in functions/, the script
   #     will auto-discover the copy installed there. Just run:
   cd functions && npm install && cd ..
   ```

### Running

```bash
# Preview what would be written
node scripts/seedExams.cjs --dry-run

# Create missing exams only (safe to re-run)
node scripts/seedExams.cjs

# Overwrite existing exam documents with the seed definitions
node scripts/seedExams.cjs --force

# Emit the payload as JSON for inspection or manual import
node scripts/seedExams.cjs --json > exams.json
```

### What gets written

For each exam, a document is created/updated at `exams/{id}` where `id` is
one of `exam_alphabet`, `exam_greetings`, `exam_numbers`,
`exam_daily_conversation`. Each document follows the schema already used by
the app's `ExamManagement.jsx`:

```js
{
  title, description, category, order, passingScore, timeLimit,
  questions: [
    { question, answer, options: string[], imageUrl?, handIcon? },
    …
  ],
  createdAt, updatedAt
}
```

### Notes

- The seed data lives in `scripts/examData.cjs`. Edit that file to adjust
  questions, then re-run with `--force` to push changes.
- Image URLs are intentionally minimal (only `Thank You` has `imageUrl: '/images/TY_1.png'`).
  Attach more images later via **Admin → Exam Management → Edit exam**.
- If you change a category name, also update `src/pages/admin/ExamManagement.jsx`
  (category dropdown) and `src/pages/ProficiencyExams.jsx` (`CATEGORY_ICONS`).
