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
