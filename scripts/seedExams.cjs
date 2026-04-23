#!/usr/bin/env node
/**
 * Seed Signtify's proficiency exams into Firestore.
 *
 * Usage:
 *   # One-time setup (service account key from Firebase Console)
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"  # PowerShell
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json       # bash
 *
 *   # Preview what would be written (no writes)
 *   node scripts/seedExams.cjs --dry-run
 *
 *   # Write to Firestore (skips existing exams)
 *   node scripts/seedExams.cjs
 *
 *   # Overwrite existing exam documents
 *   node scripts/seedExams.cjs --force
 *
 *   # Dump the payload as JSON (for manual import / inspection)
 *   node scripts/seedExams.cjs --json
 *
 * Dependency:
 *   `firebase-admin` must be importable. If you already deployed the Cloud
 *   Functions in `functions/`, it's installed there. This script will look
 *   for it in the repo root first, then fall back to `functions/node_modules`.
 */

'use strict';

const path = require('path');
const { DEFAULT_EXAMS } = require('./examData.cjs');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
const AS_JSON = args.has('--json');

function loadAdmin() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'firebase-admin'),
    path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'),
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(p);
    } catch (err) {
      /* try next */
    }
  }
  console.error(
    '❌  firebase-admin is not installed.\n' +
      '   Install it with one of:\n' +
      '     npm install --save-dev firebase-admin          (from repo root)\n' +
      '     (cd functions && npm install)                  (if using Cloud Functions)\n',
  );
  process.exit(1);
}

function summarize(exam) {
  return {
    id: exam.id,
    title: exam.title,
    category: exam.category,
    questions: exam.questions.length,
    passingScore: exam.passingScore,
    timeLimit: exam.timeLimit,
  };
}

async function main() {
  if (AS_JSON) {
    process.stdout.write(JSON.stringify(DEFAULT_EXAMS, null, 2) + '\n');
    return;
  }

  console.log(`Signtify exam seed — ${DRY_RUN ? 'DRY RUN' : 'LIVE WRITE'}${FORCE ? ' (--force)' : ''}`);
  console.log('—'.repeat(60));
  DEFAULT_EXAMS.forEach((e) => console.log('•', summarize(e)));
  console.log('—'.repeat(60));

  if (DRY_RUN) {
    console.log(`Would write ${DEFAULT_EXAMS.length} exam document(s). No changes made.`);
    return;
  }

  const admin = loadAdmin();

  if (!admin.apps.length) {
    try {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } catch (err) {
      console.error(
        '❌  Could not initialize firebase-admin with application default credentials.\n' +
          '   Set the GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON.\n\n' +
          '   Original error: ' + (err && err.message ? err.message : err),
      );
      process.exit(1);
    }
  }

  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const exam of DEFAULT_EXAMS) {
    const { id, ...payload } = exam;
    const ref = db.collection('exams').doc(id);
    const snap = await ref.get();
    if (snap.exists && !FORCE) {
      console.log(`⏭️   ${id}: already exists (use --force to overwrite)`);
      skipped += 1;
      continue;
    }

    const data = {
      ...payload,
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    };
    await ref.set(data, { merge: false });
    if (snap.exists) {
      console.log(`♻️   ${id}: overwritten`);
      updated += 1;
    } else {
      console.log(`✅  ${id}: created`);
      created += 1;
    }
  }

  console.log('—'.repeat(60));
  console.log(`Created ${created} · Updated ${updated} · Skipped ${skipped}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
