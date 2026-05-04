/**
 * Firestore may return `questions` as a true array or (in edge cases) a map-like object.
 * Exams are only playable when each row has an answer and at least two options.
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

export function isValidExamQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  const ans = String(q.answer ?? '').trim();
  if (!ans) return false;
  const opts = Array.isArray(q.options)
    ? q.options.map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (opts.length < 2) return false;
  return true;
}

export function getValidExamQuestions(raw) {
  return normalizeExamQuestions(raw).filter(isValidExamQuestion);
}
