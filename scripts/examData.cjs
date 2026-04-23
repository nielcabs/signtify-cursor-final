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

const ALPHABET_QUESTIONS = [
  { letter: 'A', options: ['A', 'B', 'C', 'D'] },
  { letter: 'C', options: ['C', 'D', 'E', 'F'] },
  { letter: 'E', options: ['E', 'F', 'G', 'H'] },
  { letter: 'G', options: ['F', 'G', 'H', 'I'] },
  { letter: 'I', options: ['I', 'J', 'K', 'L'] },
  { letter: 'K', options: ['J', 'K', 'L', 'M'] },
  { letter: 'L', options: ['K', 'L', 'M', 'N'] },
  { letter: 'M', options: ['L', 'M', 'N', 'O'] },
  { letter: 'O', options: ['M', 'N', 'O', 'P'] },
  { letter: 'Q', options: ['P', 'Q', 'R', 'S'] },
  { letter: 'S', options: ['R', 'S', 'T', 'U'] },
  { letter: 'U', options: ['T', 'U', 'V', 'W'] },
  { letter: 'W', options: ['U', 'V', 'W', 'X'] },
  { letter: 'Y', options: ['X', 'Y', 'Z', 'A'] },
  { letter: 'Z', options: ['W', 'X', 'Y', 'Z'] },
].map(({ letter, options }) => ({
  question: `What letter is this sign?`,
  answer: letter,
  options,
  handIcon: '✋',
}));

const GREETINGS_QUESTIONS = [
  { sign: 'Hello',             options: ['Hello', 'Goodbye', 'Thank You', 'Welcome'] },
  { sign: 'Goodbye',           options: ['Hello', 'Goodbye', 'See you later', 'Take care'] },
  { sign: 'Good Morning',      options: ['Good Morning', 'Good Night', 'Good afternoon', 'Goodbye'] },
  { sign: 'Good Night',        options: ['Good Morning', 'Good Night', 'Good afternoon', 'Hello'] },
  { sign: 'Good afternoon',    options: ['Good Morning', 'Good Night', 'Good afternoon', 'Thank You'] },
  { sign: 'How are you?',      options: ['How are you?', 'Nice to meet you', 'See you later', 'Take care'] },
  { sign: 'Nice to meet you',  options: ['How are you?', 'Nice to meet you', 'Welcome', 'Thank You'] },
  { sign: 'See you later',     options: ['Goodbye', 'See you later', 'Take care', 'Hello'] },
  { sign: 'Take care',         options: ['Take care', 'Thank You', 'Goodbye', 'Nice to meet you'] },
  { sign: 'Thank You',         options: ['Welcome', 'Thank You', 'Nice to meet you', 'How are you?'] },
  { sign: 'Welcome',           options: ['Welcome', 'Thank You', 'Hello', 'Good Morning'] },
  { sign: 'Happy Birthday',    options: ['Happy Birthday', 'Thank You', 'Welcome', 'Good Morning'] },
].map(({ sign, options }) => ({
  question: 'What greeting is this sign?',
  answer: sign,
  options,
  handIcon: '👋',
  ...(sign === 'Thank You' ? { imageUrl: '/images/TY_1.png' } : {}),
}));

const NUMBERS_QUESTIONS = [
  { n: '1',  options: ['1', '2', '3', '4']  },
  { n: '2',  options: ['1', '2', '3', '4']  },
  { n: '3',  options: ['2', '3', '4', '5']  },
  { n: '4',  options: ['3', '4', '5', '6']  },
  { n: '5',  options: ['4', '5', '6', '7']  },
  { n: '6',  options: ['5', '6', '7', '8']  },
  { n: '7',  options: ['6', '7', '8', '9']  },
  { n: '8',  options: ['7', '8', '9', '10'] },
  { n: '9',  options: ['6', '8', '9', '10'] },
  { n: '10', options: ['7', '8', '9', '10'] },
].map(({ n, options }) => ({
  question: 'What number is this sign?',
  answer: n,
  options,
  handIcon: '🔢',
}));

const DAILY_CONVERSATION_QUESTIONS = [
  { sign: 'Yes',                 options: ['Yes', 'No', 'Please', 'Sure'] },
  { sign: 'No',                  options: ['Yes', 'No', 'Excuse me', 'Sorry'] },
  { sign: 'Help',                options: ['Help', 'Please', 'Sorry', 'Excuse me'] },
  { sign: 'Please',              options: ['Please', 'Sorry', 'Thank You', 'Help'] },
  { sign: 'Sorry',               options: ['Please', 'Sorry', 'Excuse me', 'Yes'] },
  { sign: 'Excuse me',           options: ['Excuse me', 'Sorry', 'Please', 'Help'] },
  { sign: 'My name is',          options: ['My name is', 'What is your name?', 'Friend', 'Help'] },
  { sign: 'What is your name?',  options: ['My name is', 'What is your name?', 'Friend', 'Sorry'] },
  { sign: 'Friend',              options: ['Friend', 'My name is', 'Help', 'Sorry'] },
].map(({ sign, options }) => ({
  question: 'What sign is this?',
  answer: sign,
  options,
  handIcon: '💬',
}));

const DEFAULT_EXAMS = [
  {
    id: 'exam_alphabet',
    title: 'Proficiency Exam 1: Alphabet',
    description: 'Prove you can recognize the full American Sign Language alphabet. Passing unlocks the next exam.',
    category: 'alphabet',
    order: 1,
    passingScore: 80,
    timeLimit: 15,
    questions: ALPHABET_QUESTIONS,
  },
  {
    id: 'exam_greetings',
    title: 'Proficiency Exam 2: Greetings',
    description: 'Identify the most common ASL greetings and polite phrases.',
    category: 'greetings',
    order: 2,
    passingScore: 80,
    timeLimit: 12,
    questions: GREETINGS_QUESTIONS,
  },
  {
    id: 'exam_numbers',
    title: 'Proficiency Exam 3: Numbers',
    description: 'Recognize signed numbers from 1 to 10.',
    category: 'numbers',
    order: 3,
    passingScore: 80,
    timeLimit: 10,
    questions: NUMBERS_QUESTIONS,
  },
  {
    id: 'exam_daily_conversation',
    title: 'Proficiency Exam 4: Daily Conversation',
    description: 'Identify essential daily-conversation signs used in everyday interactions.',
    category: 'daily-conversation',
    order: 4,
    passingScore: 80,
    timeLimit: 10,
    questions: DAILY_CONVERSATION_QUESTIONS,
  },
];

module.exports = { DEFAULT_EXAMS };
