# Rule-Based Algorithm for Exam Unlocking

## Overview

Yes, you **CAN and ARE** using a Rule-Based Algorithm! Your proficiency exam system implements a rule-based approach where exams are unlocked based on specific conditions (rules).

## What is a Rule-Based Algorithm?

A **Rule-Based Algorithm** uses a set of explicit rules (IF-THEN conditions) to make decisions. In your case:

- **IF** user passes Exam 1 with 80%+ **THEN** unlock Exam 2
- **IF** user passes Exam 2 with 80%+ **THEN** unlock Exam 3
- And so on...

## Current Implementation

### Rule-Based Logic Location

**File:** `SigntifyKurt/src/pages/ProficiencyExams.jsx`

**Lines 64-98:** The rule-based unlock algorithm

```javascript
// RULE 1: First exam is always unlocked
if (index === 0) {
  isUnlocked = true;
}

// RULE 2: If exam already passed, always unlocked (for retakes)
else if (isPassed) {
  isUnlocked = true;
}

// RULE 3: Unlock next exam only if previous exam passed
else {
  isUnlocked = previousExamPassed;
}
```

### Current Rules

1. **Rule 1 (Base Case):** First exam (index 0) is always unlocked
2. **Rule 2 (Retake Rule):** Already passed exams remain unlocked
3. **Rule 3 (Sequential Rule):** Next exam unlocks only if previous exam passed

## Issue: 80% Threshold Not Explicitly Checked

**Current Problem:** The code checks if an exam is `passed`, but doesn't explicitly verify the 80% threshold in the unlock logic.

**Location:** `ProficiencyExams.jsx` lines 53-57

```javascript
const passedExamIds = new Set(
  passedExams
    .filter(e => e.passed)  // ⚠️ Only checks 'passed' flag
    .map(e => e.examId)
);
```

**Should be:**
```javascript
const passedExamIds = new Set(
  passedExams
    .filter(e => e.passed && e.percentage >= 80)  // ✅ Explicit 80% check
    .map(e => e.examId)
);
```

## Complete Rule-Based Algorithm Structure

### Rule Definitions

```javascript
// RULE SET FOR EXAM UNLOCKING
const EXAM_UNLOCK_RULES = {
  RULE_1: {
    condition: "examIndex === 0",
    action: "unlock = true",
    description: "First exam is always accessible"
  },
  
  RULE_2: {
    condition: "exam.passed === true && exam.percentage >= 80",
    action: "unlock = true",
    description: "Already passed exams (80%+) remain unlocked for retakes"
  },
  
  RULE_3: {
    condition: "previousExam.passed === true && previousExam.percentage >= 80",
    action: "unlock = true",
    description: "Next exam unlocks only if previous exam passed with 80%+"
  },
  
  RULE_4: {
    condition: "exam.percentage < 80",
    action: "unlock = false",
    description: "Exams with score below 80% do not unlock next exam"
  }
};
```

## Recommended Fix

Update the unlock logic to explicitly check for 80% threshold:

**File:** `SigntifyKurt/src/pages/ProficiencyExams.jsx`

**Change lines 52-57 from:**
```javascript
const passedExamIds = new Set(
  passedExams
    .filter(e => e.passed)
    .map(e => e.examId)
);
```

**To:**
```javascript
// Rule: Only exams passed with 80%+ count for unlocking
const passedExamIds = new Set(
  passedExams
    .filter(e => e.passed && e.percentage >= 80)  // Explicit 80% rule
    .map(e => e.examId)
);
```

**And update lines 88-90:**
```javascript
// Update tracking for next iteration
// Rule: Next exam unlocks only if this one passed with 80%+
previousExamPassed = isPassed && (currentExamResult?.percentage >= 80);
```

## Rule-Based Algorithm Flow Diagram

```
┌─────────────────────────────────────────────────┐
│         EXAM UNLOCK RULE ENGINE                │
└─────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Is First Exam?       │
        │  (index === 0)       │
        └───────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
       YES                     NO
        │                       │
        ▼                       ▼
   ┌─────────┐        ┌─────────────────────┐
   │ UNLOCK  │        │ Already Passed?      │
   │         │        │ (passed && >= 80%)   │
   └─────────┘        └─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                   YES                 NO
                    │                   │
                    ▼                   ▼
              ┌─────────┐      ┌──────────────────┐
              │ UNLOCK  │      │ Previous Passed? │
              │         │      │ (>= 80%)         │
              └─────────┘      └──────────────────┘
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                           YES                 NO
                            │                   │
                            ▼                   ▼
                      ┌─────────┐        ┌──────────┐
                      │ UNLOCK  │        │  LOCK    │
                      │         │        │          │
                      └─────────┘        └──────────┘
```

## Where Rules Are Applied

### 1. Exam Unlocking Logic
**File:** `ProficiencyExams.jsx` (lines 64-98)
- Determines which exams are accessible

### 2. Exam Result Saving
**File:** `firestoreUtils.js` (lines 212-309)
- Applies rule: `percentage >= 80` to mark as passed
- Line 262: `if (percentage >= 80 && !hasAlreadyPassed)`

### 3. Profile Statistics
**File:** `Profile.jsx` (lines 112-122)
- Counts only exams with `percentage >= 80`

## Benefits of Rule-Based Approach

1. ✅ **Transparent:** Rules are explicit and easy to understand
2. ✅ **Maintainable:** Easy to modify rules (e.g., change 80% to 75%)
3. ✅ **Debuggable:** Can trace exactly why an exam is locked/unlocked
4. ✅ **No Training Required:** Unlike ML, rules are deterministic
5. ✅ **Fast:** O(n) complexity for n exams

## Example Rule Execution

**Scenario:** User has 3 exams

```
Exam 1: Score = 85% → PASSED (80%+) → ✅ Unlocks Exam 2
Exam 2: Score = 75% → FAILED (< 80%) → ❌ Does NOT unlock Exam 3
Exam 3: Status = LOCKED (waiting for Exam 2 to pass with 80%+)
```

**After retaking Exam 2:**
```
Exam 1: 85% → ✅ Passed
Exam 2: 82% → ✅ Passed (80%+) → ✅ NOW unlocks Exam 3
Exam 3: Status = UNLOCKED
```

## Summary

- ✅ **You ARE using a Rule-Based Algorithm**
- ✅ **Rules are implemented in `ProficiencyExams.jsx`**
- ⚠️ **Recommendation:** Make the 80% threshold explicit in the unlock logic
- ✅ **This is the correct approach** for sequential exam progression

The rule-based approach is perfect for this use case because:
- The logic is clear and deterministic
- No machine learning needed
- Easy to explain to users
- Simple to maintain and modify









