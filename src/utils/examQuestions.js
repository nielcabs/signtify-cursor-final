/**
 * Firestore may return `questions` as a true array or (in edge cases) a map-like object.
 * Camera exams need a correct answer label; optional extra "options" are stored but do not change scoring.
 */
export function normalizeExamQuestions(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((q) => q != null && typeof q === 'object');
  }
  if (typeof raw === 'object') {
    return Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k])
      .filter((q) => q != null && typeof q === 'object');
  }
  return [];
}

const normLabel = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

export function isValidExamQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  const ans = String(q.answer ?? '').trim();
  if (!ans) return false;
  const opts = Array.isArray(q.options)
    ? q.options.map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (opts.length < 1) return false;
  const nAns = normLabel(ans);
  return opts.some((o) => normLabel(o) === nAns);
}

export function getValidExamQuestions(raw) {
  return normalizeExamQuestions(raw).filter(isValidExamQuestion);
}
