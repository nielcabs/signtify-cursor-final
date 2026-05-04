/**
 * Canonical Signtify proficiency exam definitions.
 *
 * This module is imported by the Node seed script (`seedExams.cjs`).
 *
 * Schema (matches Firestore `exams/{id}` docs + existing `ExamManagement.jsx`):
 *   id, title, description, category, order, passingScore, timeLimit, questions
 *
 * Each question: { question, answer, options[], imageUrl?, handIcon? }
 */

/**
 * Letters chosen for clear, stable handshapes (local + Fingerpose in the app).
 * Avoids easily confused pairs (e.g. M/N, P/Q) and very folded letters for the camera step.
 */
const ALPHABET_QUESTIONS = [
  { letter: 'A', options: ['A', 'B', 'L', 'O'] },
  { letter: 'B', options: ['A', 'B', 'L', 'Y'] },
  { letter: 'C', options: ['B', 'C', 'O', 'L'] },
  { letter: 'I', options: ['I', 'L', 'Y', 'W'] },
  { letter: 'L', options: ['I', 'L', 'Y', 'O'] },
  { letter: 'O', options: ['O', 'C', 'A', 'U'] },
  { letter: 'U', options: ['U', 'V', 'W', 'I'] },
  { letter: 'V', options: ['U', 'V', 'W', 'Y'] },
  { letter: 'W', options: ['U', 'V', 'W', 'B'] },
  { letter: 'Y', options: ['Y', 'I', 'L', 'A'] },
].map(({ letter, options }) => ({
  question: `What letter is this sign?`,
  answer: letter,
  options,
  handIcon: '✋',
}));

/** Phrases that match in-app camera / Live Translate word detection (motion + shape heuristics). */
const GREETINGS_QUESTIONS = [
  { sign: 'Hello', options: ['Hello', 'Goodbye', 'Thank You', 'Happy Birthday'] },
  { sign: 'Goodbye', options: ['Hello', 'Goodbye', 'Thank You', 'Mama'] },
  { sign: 'Thank You', options: ['Thank You', 'Hello', 'Goodbye', 'Happy Birthday'] },
  { sign: 'Happy Birthday', options: ['Happy Birthday', 'Thank You', 'Hello', 'Mama'] },
  { sign: 'Mama', options: ['Mama', 'Hello', 'Thank You', 'Goodbye'] },
  { sign: 'Yes', options: ['Yes', 'Hello', 'Thank You', 'No'] },
].map(({ sign, options }) => ({
  question: 'What greeting is this sign?',
  answer: sign,
  options,
  handIcon: '👋',
  ...(sign === 'Hello' ? { imageUrl: 'asset:greeting_hello' } : {}),
  ...(sign === 'Goodbye' ? { imageUrl: 'asset:greeting_goodbye_1' } : {}),
  ...(sign === 'Thank You' ? { imageUrl: 'asset:greeting_thank_you_1' } : {}),
  ...(sign === 'Happy Birthday' ? { imageUrl: 'asset:greeting_happy_birthday_1' } : {}),
  ...(sign === 'Mama' ? { imageUrl: 'asset:greeting_mama' } : {}),
  ...(sign === 'Yes' ? { imageUrl: 'asset:daily_yes' } : {}),
}));

/** 1–5 use simple raised-finger counts; easier than thumb-touch 6–9 shapes. */
const NUMBERS_QUESTIONS = [
  { n: '1', options: ['1', '2', '3', '4'] },
  { n: '2', options: ['1', '2', '3', '5'] },
  { n: '3', options: ['2', '3', '4', '5'] },
  { n: '4', options: ['3', '4', '5', '2'] },
  { n: '5', options: ['4', '5', '3', '1'] },
  { n: '10', options: ['5', '10', '1', '2'] },
].map(({ n, options }) => ({
  question: 'What number is this sign?',
  answer: n,
  options,
  handIcon: '🔢',
}));

const DAILY_CONVERSATION_QUESTIONS = [
  { sign: 'Yes', options: ['Yes', 'No', 'Help', 'Thank You'] },
  { sign: 'No', options: ['Yes', 'No', 'Help', 'Thank You'] },
  { sign: 'Help', options: ['Help', 'Yes', 'No', 'Thank You'] },
  { sign: 'Thank You', options: ['Thank You', 'Yes', 'No', 'Help'] },
  { sign: 'Mama', options: ['Mama', 'Thank You', 'Hello', 'Help'] },
  {
    sign: 'I love you',
    question: 'What is the word that you can generate with I, L, Y?',
    options: ['I love you', 'Thank You', 'Help', 'Yes'],
  },
].map(({ sign, options, question }) => ({
  question: question || 'What sign is this?',
  answer: sign,
  options,
  handIcon: '💬',
  ...(sign === 'Yes' ? { imageUrl: 'asset:daily_yes' } : {}),
  ...(sign === 'No' ? { imageUrl: 'asset:daily_no_1' } : {}),
  ...(sign === 'Help' ? { imageUrl: 'asset:daily_help' } : {}),
  ...(sign === 'Thank You' ? { imageUrl: 'asset:greeting_thank_you_1' } : {}),
  ...(sign === 'Mama' ? { imageUrl: 'asset:greeting_mama' } : {}),
}));

const DEFAULT_EXAMS = [
  {
    id: 'exam_alphabet',
    title: 'Proficiency Exam 1: Alphabet',
    description: 'Recognize common ASL letters with clear handshapes. Passing unlocks the next exam.',
    category: 'alphabet',
    order: 1,
    passingScore: 75,
    timeLimit: 12,
    questions: ALPHABET_QUESTIONS,
  },
  {
    id: 'exam_greetings',
    title: 'Proficiency Exam 2: Greetings',
    description: 'Core greetings and short phrases you can practice with the in-app camera.',
    category: 'greetings',
    order: 2,
    passingScore: 75,
    timeLimit: 10,
    questions: GREETINGS_QUESTIONS,
  },
  {
    id: 'exam_numbers',
    title: 'Proficiency Exam 3: Numbers',
    description: 'Recognize signed numbers 1–5 plus 10 (clear thumb and finger patterns).',
    category: 'numbers',
    order: 3,
    passingScore: 75,
    timeLimit: 8,
    questions: NUMBERS_QUESTIONS,
  },
  {
    id: 'exam_daily_conversation',
    title: 'Proficiency Exam 4: Daily Conversation',
    description: 'Essential yes / no / help and thanks—aligned with camera-friendly signs in the app.',
    category: 'daily-conversation',
    order: 4,
    passingScore: 75,
    timeLimit: 8,
    questions: DAILY_CONVERSATION_QUESTIONS,
  },
];

module.exports = { DEFAULT_EXAMS };
