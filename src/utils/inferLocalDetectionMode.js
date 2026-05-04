/**
 * Choose letter / number / word local-detection pipeline from what we're trying to recognize.
 * Important for exams: category alone is wrong when an "alphabet" exam includes a number question—
 * we must still run number heuristics for expected "1" … "10".
 */
export function inferLocalDetectionMode(expectedSign, questionText = '') {
  const exp = String(expectedSign || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  const qt = String(questionText || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  if (/^(?:[0-9]|10)$/.test(exp)) return 'numbers';

  if (
    exp.includes('i love you') ||
    /i\s*,\s*l\s*,\s*y/.test(exp) ||
    /i\s*,\s*l\s*,\s*y/.test(qt) ||
    (/converted to/.test(qt) && (/i\s*love\s*you/.test(exp) || /\bily\b/.test(exp)))
  ) {
    return 'words';
  }

  if (/^[a-z]$/.test(exp)) return 'letters';

  return 'words';
}

/**
 * Maps Teacher Dashboard "Category" to what we show in the live preview (letters vs numbers vs words).
 * `comprehensive` / unknown → no mapping (caller falls back to inferLocalDetectionMode).
 */
export function mapExamCategoryToPreviewScope(category) {
  const c = String(category || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
  if (!c || c === 'comprehensive') return null;
  if (c === 'alphabet') return 'letters';
  if (c === 'numbers') return 'numbers';
  if (['greetings', 'daily-conversation', 'common'].includes(c)) return 'words';
  return null;
}

/** Preview follows exam category when set; otherwise the expected sign. */
export function resolvePreviewScope(examCategory, expectedSign, questionText) {
  const mapped = mapExamCategoryToPreviewScope(examCategory);
  if (mapped) return mapped;
  return inferLocalDetectionMode(expectedSign, questionText);
}
