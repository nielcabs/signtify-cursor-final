export const tutorialSteps = {
  main: [
    {
      id: 'welcome',
      target: null, 
      title: 'Welcome to Signtify!',
      content: 'Learn sign language through interactive lessons, quizzes, and real-time translation. Let\'s take a quick tour to get you started.',
      position: 'center',
      showSkip: true,
      showPrev: false
    },
    {
      id: 'navigation',
      target: '.navbar',
      title: 'Navigation Menu',
      content: 'Access all features from here. You\'ll find Lessons, Quizzes, Exams, Live Translate, and your Profile. Some features unlock as you progress!',
      position: 'bottom'
    },
    {
      id: 'home-features',
      target: '.home-container',
      title: 'Your Learning Hub',
      content: 'This is your home base. See your progress, continue where you left off, and discover new lessons to master.',
      position: 'center'
    },
    {
      id: 'lessons',
      target: '.nav-menu .nav-item:first-child',
      title: 'Start Learning',
      content: 'Begin with the Alphabet lesson to learn A-Z in sign language. Click on "Lessons" in the navigation menu to start. Complete lessons to unlock quizzes and earn points!',
      position: 'bottom',
      fallbackTarget: '.nav-item'
    },
    {
      id: 'quizzes',
      target: '.nav-menu .nav-item:nth-child(2)',
      title: 'Test Your Knowledge',
      content: 'Take quizzes to reinforce what you\'ve learned. Access them from "Mini Quizzes" in the navigation. Pass quizzes to unlock proficiency exams.',
      position: 'bottom',
      fallbackTarget: '.nav-item'
    },
    {
      id: 'proficiency-exams',
      target: '.nav-menu .nav-item:nth-child(3)',
      title: 'Prove Your Skills',
      content: 'Pass proficiency exams with 80% or higher to unlock the Dictionary and advanced features. Find them under "Proficiency Exam" in the navigation. Exams unlock sequentially!',
      position: 'bottom',
      fallbackTarget: '.nav-item'
    },
    {
      id: 'live-translate',
      target: '.nav-menu .nav-item:nth-child(5)',
      title: 'Live Translation',
      content: 'Use your camera to translate sign language in real-time! Click on "Live Translate" in the navigation. The AI recognizes your gestures and provides instant feedback.',
      position: 'bottom',
      fallbackTarget: '.nav-item'
    },
    {
      id: 'profile',
      target: '.user-menu-item, .tutorial-menu-item',
      title: 'Track Your Progress',
      content: 'View your achievements, points, streaks, and learning statistics. Click on your user avatar in the top right to access your profile and settings!',
      position: 'bottom',
      fallbackTarget: '.nav-item:last-child'
    },
    {
      id: 'getting-started',
      target: null,
      title: 'Ready to Start?',
      content: 'Start with the Alphabet lesson to begin your sign language journey. You can always replay this tutorial from your profile settings.',
      position: 'center',
      showNext: false,
      customNextLabel: 'Start Learning!',
      customNextAction: '/lessons/alphabet'
    }
  ],

  lesson: [
    {
      id: 'lesson-intro',
      target: null,
      title: 'Lesson Guide',
      content: 'Learn how to navigate lessons and track your progress through the learning modules.',
      position: 'center',
      showPrev: false
    },
    {
      id: 'lesson-navigation',
      target: '.lesson-nav, .lesson-navigation',
      title: 'Lesson Navigation',
      content: 'Navigate between different signs in the lesson. Complete them in order to maintain your learning streak.',
      position: 'bottom',
      fallbackTarget: '.lesson-container'
    },
    {
      id: 'sign-display',
      target: '.sign-display, .sign-card, .current-sign',
      title: 'Sign Display',
      content: 'Watch the demonstration carefully. Pay attention to hand position, movement, and facial expressions.',
      position: 'top',
      fallbackTarget: '.sign-container'
    },
    {
      id: 'progress-tracking',
      target: '.progress-bar, .lesson-progress',
      title: 'Progress Tracking',
      content: 'See how far you\'ve come in the lesson. Complete all items to finish the lesson and earn 50 points!',
      position: 'bottom',
      fallbackTarget: '.progress-indicator'
    },
    {
      id: 'practice-tip',
      target: null,
      title: 'Practice Makes Perfect',
      content: 'Practice each sign multiple times. Use the Live Translate feature to test your signs in real-time!',
      position: 'center',
      showNext: false,
      customNextLabel: 'Got it!'
    }
  ],

  liveTranslate: [
    {
      id: 'translate-intro',
      target: null,
      title: 'Live Translation',
      content: 'Use AI-powered sign language recognition to translate your gestures in real-time.',
      position: 'center',
      showPrev: false
    },
    {
      id: 'camera-start',
      target: '.camera-button, .start-camera, button:has-text("Start Camera")',
      title: 'Start Your Camera',
      content: 'Click this button to activate your camera. Make sure you\'re in a well-lit area with a clear background.',
      position: 'top',
      fallbackTarget: 'button'
    },
    {
      id: 'camera-view',
      target: '.camera-view, .video-container, video',
      title: 'Position Yourself',
      content: 'Position your hands clearly in the frame. The skeleton overlay helps you see what the AI detects.',
      position: 'top',
      fallbackTarget: '.camera-section'
    },
    {
      id: 'confidence-display',
      target: '.confidence-bar, .confidence-display',
      title: 'Confidence Score',
      content: 'Watch the confidence bar. Higher percentages (70%+) mean more accurate detection. Hold steady for best results!',
      position: 'left',
      fallbackTarget: '.detection-status'
    },
    {
      id: 'translation-history',
      target: '.translation-history, .history-section',
      title: 'Translation History',
      content: 'Your recent translations are saved here. Review them to track your practice sessions.',
      position: 'left',
      fallbackTarget: '.history-panel'
    },
    {
      id: 'tips',
      target: null,
      title: 'Pro Tips',
      content: '1. Good lighting is essential. 2. Keep hands steady for 2-3 seconds. 3. Face the camera directly. 4. Use plain background.',
      position: 'center',
      showNext: false,
      customNextLabel: 'Start Translating!'
    }
  ],

  quiz: [
    {
      id: 'quiz-intro',
      target: null,
      title: 'Quiz Time!',
      content: 'Test your knowledge with interactive quizzes. Pass to unlock proficiency exams!',
      position: 'center',
      showPrev: false
    },
    {
      id: 'quiz-question',
      target: '.quiz-question, .question-card',
      title: 'Answer Questions',
      content: 'Select the correct answer from the options. Read carefully and think about what you learned in the lessons.',
      position: 'center',
      fallbackTarget: '.quiz-container'
    },
    {
      id: 'quiz-progress',
      target: '.quiz-progress, .question-counter',
      title: 'Quiz Progress',
      content: 'Track your progress through the quiz. Take your time - accuracy matters more than speed!',
      position: 'top',
      fallbackTarget: '.progress-indicator'
    },
    {
      id: 'quiz-results',
      target: null,
      title: 'Results & Rewards',
      content: 'After completing the quiz, you\'ll see your score. Pass with any score to complete the quiz requirement for lessons!',
      position: 'center',
      showNext: false,
      customNextLabel: 'Start Quiz!'
    }
  ],

  exam: [
    {
      id: 'exam-intro',
      target: null,
      title: 'Proficiency Exam',
      content: 'Prove your mastery! Pass with 80% or higher to unlock the Dictionary and advanced features.',
      position: 'center',
      showPrev: false
    },
    {
      id: 'exam-requirements',
      target: '.exam-requirements, .unlock-requirements',
      title: 'Exam Requirements',
      content: 'Complete all lesson items and take the associated quiz to unlock this exam. Exams unlock sequentially.',
      position: 'bottom',
      fallbackTarget: '.exam-info'
    },
    {
      id: 'exam-questions',
      target: '.exam-question',
      title: 'Exam Format',
      content: 'Exams are comprehensive tests covering all lesson material. You need 80% to pass and unlock the next level.',
      position: 'center',
      fallbackTarget: '.exam-container'
    },
    {
      id: 'exam-progression',
      target: null,
      title: 'Progressive Unlocking',
      content: 'Pass Exam 1 to unlock Exam 2, and so on. Complete all exams to become a certified sign language expert!',
      position: 'center',
      showNext: false,
      customNextLabel: 'I\'m Ready!'
    }
  ],

  dictionary: [
    {
      id: 'dictionary-intro',
      target: null,
      title: 'Sign Language Dictionary',
      content: 'Browse our comprehensive dictionary of sign language signs. This feature unlocks after passing proficiency exams!',
      position: 'center',
      showPrev: false
    },
    {
      id: 'dictionary-search',
      target: '.search-box, .dictionary-search',
      title: 'Search Signs',
      content: 'Search for specific signs by name or category. Find quick references for signs you want to practice.',
      position: 'bottom',
      fallbackTarget: '.search-section'
    },
    {
      id: 'dictionary-categories',
      target: '.dictionary-categories, .category-tabs',
      title: 'Categories',
      content: 'Browse signs by category. Categories unlock as you pass their corresponding proficiency exams.',
      position: 'top',
      fallbackTarget: '.category-section'
    },
    {
      id: 'sign-details',
      target: '.sign-detail, .sign-entry',
      title: 'Sign Details',
      content: 'Each entry shows the sign demonstration, description, and usage tips. Practice along with the video!',
      position: 'center',
      fallbackTarget: '.dictionary-content'
    }
  ],

  profile: [
    {
      id: 'profile-intro',
      target: null,
      title: 'Your Profile',
      content: 'Track your learning journey, view achievements, and manage your account settings.',
      position: 'center',
      showPrev: false
    },
    {
      id: 'profile-stats',
      target: '.profile-stats, .stats-section',
      title: 'Statistics',
      content: 'View your total points, completed lessons, quizzes taken, and exams passed. Watch your progress grow!',
      position: 'left',
      fallbackTarget: '.stats-grid'
    },
    {
      id: 'achievements',
      target: '.achievements-section, .achievements-grid',
      title: 'Achievements',
      content: 'Earn badges for milestones like first lesson, perfect scores, and exam completions. Collect them all!',
      position: 'left',
      fallbackTarget: '.achievements'
    },
    {
      id: 'progress-tracking',
      target: '.progress-section, .learning-progress',
      title: 'Learning Progress',
      content: 'See which lessons and quizzes you\'ve completed. Track your streak and maintain daily practice!',
      position: 'right',
      fallbackTarget: '.progress-list'
    },
    {
      id: 'settings',
      target: '.settings-section, .profile-settings',
      title: 'Settings',
      content: 'Update your profile, manage tutorial preferences, and control account settings from here.',
      position: 'right',
      fallbackTarget: '.settings'
    }
  ]
};

export const getTourSteps = (tourId) => {
  return tutorialSteps[tourId] || [];
};

export const getStep = (tourId, stepIndex) => {
  const steps = tutorialSteps[tourId];
  return steps ? steps[stepIndex] : null;
};

export const getTourStepCount = (tourId) => {
  return tutorialSteps[tourId]?.length || 0;
};

export const availableTours = [
  { id: 'main', name: 'Main Onboarding Tour', description: 'Complete overview for new users' },
  { id: 'lesson', name: 'Lesson Guide', description: 'How to navigate and complete lessons' },
  { id: 'liveTranslate', name: 'Live Translation', description: 'Using the real-time translation feature' },
  { id: 'quiz', name: 'Quiz Tutorial', description: 'Taking quizzes and earning points' },
  { id: 'exam', name: 'Proficiency Exams', description: 'Exam system and progression' },
  { id: 'dictionary', name: 'Dictionary Guide', description: 'Using the sign language dictionary' },
  { id: 'profile', name: 'Profile Overview', description: 'Understanding your progress and achievements' }
];

export default tutorialSteps;
