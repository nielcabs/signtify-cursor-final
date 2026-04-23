# All Algorithms Found in Signtify Codebase

This document catalogs all algorithms, data structures, and computational techniques used throughout the project.

---

## 1. Machine Learning Algorithms

### 1.1 GRU (Gated Recurrent Unit) Neural Network
**Location:** `app.py` lines 22, 29, 33, 37, 63, 136  
**Type:** Deep Learning / Recurrent Neural Network  
**Purpose:** Sequence modeling for sign language recognition

```python
# Three-layer GRU architecture
x = GRU(128, return_sequences=True, activation='relu')(input_layer)
x = GRU(256, return_sequences=True, activation='relu')(x)
x = GRU(128, return_sequences=False, activation='relu')(x)
```

**Characteristics:**
- Handles temporal sequences (30 frames of gestures)
- Captures long-term dependencies in sign language
- Uses ReLU activation function

---

### 1.2 Softmax Classification
**Location:** `app.py` line 46  
**Type:** Activation Function / Classification Algorithm  
**Purpose:** Multi-class probability distribution

```python
output_layer = Dense(6, activation='softmax', name='dense_8')(x)
```

**Characteristics:**
- Converts raw scores to probabilities
- Ensures probabilities sum to 1
- Used for 6-class classification (nothing, hello, thanks, iloveyou, yes, no)

---

### 1.3 Argmax (Maximum Index Finding)
**Location:** `app.py` line 139  
**Type:** Optimization Algorithm  
**Purpose:** Find the class with highest probability

```python
prediction_index = np.argmax(res)
```

**Characteristics:**
- O(n) time complexity
- Returns index of maximum value
- Used to select predicted sign language class

---

### 1.4 Batch Normalization
**Location:** `app.py` lines 30, 34, 38  
**Type:** Normalization Algorithm  
**Purpose:** Stabilize training and improve convergence

```python
x = BatchNormalization(name='batch_normalization')(x)
```

**Characteristics:**
- Normalizes activations across batches
- Reduces internal covariate shift
- Speeds up training

---

### 1.5 Dropout Regularization
**Location:** `app.py` lines 31, 35, 39, 43, 45  
**Type:** Regularization Algorithm  
**Purpose:** Prevent overfitting

```python
x = Dropout(0.3, name='dropout')(x)
x = Dropout(0.4, name='dropout_3')(x)
```

**Characteristics:**
- Randomly sets neurons to zero during training
- Dropout rates: 0.3 (GRU layers), 0.4 (Dense layers)
- Reduces model complexity

---

## 2. Computer Vision Algorithms

### 2.1 MediaPipe Holistic
**Location:** `src/pages/LiveTranslate.jsx`  
**Type:** Pose Estimation / Hand Tracking Algorithm  
**Purpose:** Extract body, face, and hand landmarks from video

**Characteristics:**
- Detects 33 pose landmarks
- Detects 468 face landmarks
- Detects 21 landmarks per hand (left + right)
- Real-time processing

---

### 2.2 Keypoint Extraction Algorithm
**Location:** `src/pages/LiveTranslate.jsx` lines 28-51  
**Type:** Feature Extraction Algorithm  
**Purpose:** Convert MediaPipe landmarks to feature vector

```javascript
const extractKeypoints = (results) => {
  const pose = results.poseLandmarks.map(res => [res.x, res.y, res.z, res.visibility]).flat();
  const face = results.faceLandmarks.map(res => [res.x, res.y, res.z]).flat();
  const lh = results.leftHandLandmarks.map(res => [res.x, res.y, res.z]).flat();
  const rh = results.rightHandLandmarks.map(res => [res.x, res.y, res.z]).flat();
  return [...pose, ...face, ...lh, ...rh]; // 1662 features total
}
```

**Characteristics:**
- Flattens multi-dimensional landmark data
- Combines pose (132), face (1404), left hand (63), right hand (63)
- Output: 1662-dimensional feature vector per frame

---

## 3. Data Structure Algorithms

### 3.1 Sliding Window / Sequence Buffering
**Location:** `src/pages/LiveTranslate.jsx` lines 17, 114  
**Type:** Buffer Management Algorithm  
**Purpose:** Maintain fixed-size sequence of frames

```javascript
sequence.push(keypoints);
sequence = sequence.slice(-sequenceLength); // Keep last 30 frames
```

**Characteristics:**
- Maintains exactly 30 frames
- FIFO (First In, First Out) behavior
- Used for temporal sequence modeling

---

### 3.2 Hash Table / Set Lookup
**Location:** `src/pages/ProficiencyExams.jsx` lines 53-57  
**Type:** Hash-based Data Structure  
**Purpose:** O(1) lookup for passed exams

```javascript
const passedExamIds = new Set(
  passedExams.filter(e => e.passed).map(e => e.examId)
);
```

**Characteristics:**
- O(1) average case lookup
- Prevents duplicate entries
- Used for fast membership testing

---

### 3.3 Map / Dictionary Lookup
**Location:** `src/pages/ProficiencyExams.jsx` lines 60-62  
**Type:** Hash Map Algorithm  
**Purpose:** Fast key-value lookups for exam results

```javascript
const examResultsMap = new Map(
  passedExams.map(e => [e.examId, e])
);
```

**Characteristics:**
- O(1) average case lookup
- Key-value pair storage
- Used for retrieving exam results by ID

---

### 3.4 Array Filtering
**Location:** Multiple files (e.g., `src/pages/Quizzes.jsx`, `src/pages/Lessons.jsx`)  
**Type:** Array Processing Algorithm  
**Purpose:** Select elements matching criteria

```javascript
const filteredQuizzes = selectedCategory === 'All' 
  ? quizzes 
  : quizzes.filter(q => q.category === selectedCategory);
```

**Characteristics:**
- O(n) time complexity
- Creates new array with filtered elements
- Used for category-based filtering

---

### 3.5 Array Mapping
**Location:** Multiple files  
**Type:** Functional Programming Algorithm  
**Purpose:** Transform array elements

```javascript
const categories = ['All', ...new Set(quizzes.map(q => q.category).filter(Boolean))];
```

**Characteristics:**
- O(n) time complexity
- Applies function to each element
- Used for data transformation

---

## 4. Sorting Algorithms

### 4.1 Comparison Sort (JavaScript Native)
**Location:** Multiple files (e.g., `src/pages/Lessons.jsx` line 39, `src/pages/ProficiencyExams.jsx` line 40)  
**Type:** Sorting Algorithm (typically Timsort or Quicksort)  
**Purpose:** Order items by specific criteria

```javascript
lessonsData.sort((a, b) => {
  const orderA = a.order !== undefined ? a.order : 999;
  const orderB = b.order !== undefined ? b.order : 999;
  return orderA - orderB;
});
```

**Characteristics:**
- JavaScript's native sort (Timsort implementation)
- O(n log n) average case
- Stable sort (maintains relative order of equal elements)
- Used for ordering lessons, exams, quizzes

---

### 4.2 Timestamp-based Sorting
**Location:** `src/pages/Profile.jsx` line 323  
**Type:** Sorting Algorithm  
**Purpose:** Sort activities by recency

```javascript
.sort((a, b) => b.timestamp - a.timestamp)
```

**Characteristics:**
- Descending order (newest first)
- Numeric comparison
- Used for activity history

---

## 5. Randomization Algorithms

### 5.1 Fisher-Yates Shuffle (via Math.random)
**Location:** `src/pages/Practice.jsx` lines 78, 82, 93  
**Type:** Randomization Algorithm  
**Purpose:** Randomize question order and answer options

```javascript
const shuffledOthers = otherSigns.sort(() => Math.random() - 0.5);
const options = [...wrongOptions, sign.name].sort(() => Math.random() - 0.5);
setQuestions(generatedQuestions.sort(() => Math.random() - 0.5));
```

**Characteristics:**
- Uses JavaScript's `Math.random()` for shuffling
- Not cryptographically secure
- Used to prevent memorization of question order

**Note:** While `sort(() => Math.random() - 0.5)` is commonly used, it's not a true Fisher-Yates shuffle and has slight bias. A proper implementation would be:
```javascript
for (let i = array.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [array[i], array[j]] = [array[j], array[i]];
}
```

---

## 6. Statistical Algorithms

### 6.1 Maximum Value Finding
**Location:** `src/pages/Exam.jsx` line 63  
**Type:** Statistical Algorithm  
**Purpose:** Find highest score from attempts

```javascript
const highestScore = Math.max(...examAttempts.map(q => q.percentage));
```

**Characteristics:**
- O(n) time complexity
- Finds maximum value in array
- Used for best score tracking

---

### 6.2 Average Calculation
**Location:** `src/auth/firestoreUtils.js` (implicit in stats)  
**Type:** Statistical Algorithm  
**Purpose:** Calculate average quiz/exam scores

**Characteristics:**
- Sum divided by count
- Used in user statistics

---

### 6.3 Percentage Calculation
**Location:** Multiple files (quiz/exam scoring)  
**Type:** Mathematical Algorithm  
**Purpose:** Calculate score percentages

```javascript
const percentage = Math.round((score / totalQuestions) * 100);
```

**Characteristics:**
- Simple division and multiplication
- Rounded to nearest integer
- Used for score display

---

## 7. State Management Algorithms

### 7.1 Stability Check / State Tracking
**Location:** `src/pages/LiveTranslate.jsx` lines 19, 110-139  
**Type:** State Machine Algorithm  
**Purpose:** Ensure consistent predictions before displaying

```javascript
const lastPredictionRef = useRef({ sign: null, count: 0 });

if (lastPredictionRef.current.sign === predictedSign) {
  lastPredictionRef.current.count++;
} else {
  lastPredictionRef.current = { sign: predictedSign, count: 1 };
}

if (lastPredictionRef.current.count >= STABILITY_FRAMES) {
  // Display prediction
}
```

**Characteristics:**
- Requires same prediction 3 times consecutively
- Prevents flickering/jittery predictions
- State machine pattern

---

### 7.2 Confidence Threshold Filtering
**Location:** `src/pages/LiveTranslate.jsx` lines 24, 108  
**Type:** Threshold Algorithm  
**Purpose:** Filter low-confidence predictions

```javascript
const CONFIDENCE_THRESHOLD = 0.70; // 70% confidence required

if (conf >= CONFIDENCE_THRESHOLD) {
  // Process prediction
}
```

**Characteristics:**
- Simple comparison operation
- Binary decision (accept/reject)
- Reduces false positives

---

## 8. Search Algorithms

### 8.1 Linear Search
**Location:** Multiple files (e.g., `src/pages/Profile.jsx` line 356)  
**Type:** Search Algorithm  
**Purpose:** Find elements in arrays

```javascript
const unlocked = profile.achievements?.find(a => a.id === achievement.id);
```

**Characteristics:**
- O(n) time complexity
- Returns first matching element
- Used for finding specific items

---

### 8.2 Array Includes / Membership Test
**Location:** Multiple files  
**Type:** Search Algorithm  
**Purpose:** Check if element exists in array

```javascript
if (lessonsCompleted.includes(lessonId)) {
  // Already completed
}
```

**Characteristics:**
- O(n) time complexity
- Boolean result
- Used for checking completion status

---

## 9. Aggregation Algorithms

### 9.1 Array Reduction
**Location:** Implicit in various calculations  
**Type:** Functional Programming Algorithm  
**Purpose:** Aggregate array values

**Characteristics:**
- Combines array elements into single value
- Used for summing scores, counting items

---

### 9.2 Array Slicing
**Location:** `src/pages/LiveTranslate.jsx` line 132, `src/pages/Practice.jsx` line 79  
**Type:** Array Manipulation Algorithm  
**Purpose:** Extract subset of array

```javascript
return [...prev].slice(0, 10); // Keep last 10 items
const wrongOptions = shuffledOthers.slice(0, 3); // Get first 3
```

**Characteristics:**
- O(k) where k is slice size
- Creates new array
- Used for limiting history size, selecting options

---

## 10. Graph/Tree Algorithms (Implicit)

### 10.1 React Component Tree Traversal
**Location:** React framework (throughout frontend)  
**Type:** Tree Traversal Algorithm  
**Purpose:** Render component hierarchy

**Characteristics:**
- Depth-first traversal
- Virtual DOM diffing algorithm
- Managed by React framework

---

### 10.2 Route Matching Algorithm
**Location:** React Router (throughout frontend)  
**Type:** Pattern Matching Algorithm  
**Purpose:** Match URLs to components

**Characteristics:**
- Pattern matching with parameters
- O(n) where n is number of routes
- Used for navigation

---

## 11. String Algorithms

### 11.1 String Splitting
**Location:** `src/auth/firestoreUtils.js` line 13  
**Type:** String Processing Algorithm  
**Purpose:** Extract username from email

```javascript
displayName: displayName || email.split('@')[0]
```

**Characteristics:**
- O(n) where n is string length
- Divides string by delimiter
- Used for default name generation

---

## 12. Numerical Algorithms

### 12.1 Array Expansion (NumPy)
**Location:** `app.py` line 133  
**Type:** Array Manipulation Algorithm  
**Purpose:** Add batch dimension

```python
sequence_input = np.expand_dims(sequence_array, axis=0)  # (1, 30, 1662)
```

**Characteristics:**
- Adds dimension to array
- Required for batch processing
- Used for model input formatting

---

### 12.2 Type Conversion
**Location:** `app.py` line 132, 141  
**Type:** Data Type Conversion Algorithm  
**Purpose:** Ensure correct data types

```python
sequence_array = np.array(sequence, dtype=np.float32)
confidence = float(res[prediction_index])
```

**Characteristics:**
- Type casting operations
- Ensures numerical precision
- Used for model compatibility

---

## Summary Table

| Algorithm Category | Algorithms Found | Count |
|-------------------|------------------|-------|
| Machine Learning | GRU, Softmax, Argmax, BatchNorm, Dropout | 5 |
| Computer Vision | MediaPipe Holistic, Keypoint Extraction | 2 |
| Data Structures | Sliding Window, Hash Table, Map, Filter, Map | 5 |
| Sorting | Comparison Sort, Timestamp Sort | 2 |
| Randomization | Fisher-Yates (via Math.random) | 1 |
| Statistics | Max, Average, Percentage | 3 |
| State Management | Stability Check, Threshold Filtering | 2 |
| Search | Linear Search, Includes | 2 |
| Aggregation | Reduce, Slice | 2 |
| String Processing | Split | 1 |
| Numerical | Expand Dims, Type Conversion | 2 |
| **Total** | | **27+** |

---

## Algorithm Complexity Summary

| Algorithm | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| GRU Forward Pass | O(n × h²) | O(n × h) |
| Softmax | O(n) | O(n) |
| Argmax | O(n) | O(1) |
| Sorting (Timsort) | O(n log n) | O(n) |
| Hash Table Lookup | O(1) avg | O(n) |
| Linear Search | O(n) | O(1) |
| Filter/Map | O(n) | O(n) |
| Sliding Window | O(1) per operation | O(k) |

Where:
- n = number of elements
- h = hidden units in GRU
- k = window size (30 frames)

---

## Notes

1. **No KNN Algorithm**: Despite being asked about, KNN is not implemented in this codebase.

2. **Most Complex Algorithm**: The GRU neural network with O(n × h²) complexity for sequence processing.

3. **Most Used Algorithm**: Array operations (filter, map, sort) are used extensively throughout the frontend.

4. **Real-time Algorithms**: MediaPipe Holistic and keypoint extraction run in real-time for live translation.

5. **Framework Algorithms**: React's virtual DOM diffing and React Router's matching algorithms are used but not directly implemented in the codebase.

