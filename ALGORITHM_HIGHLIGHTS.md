# Algorithm Highlights: GRU and KNN

## GRU (Gated Recurrent Unit) Algorithm

### Location: `app.py`

The GRU algorithm is implemented in the Flask backend for sign language recognition.

---

### **1. GRU Import Statement**
**File:** `SigntifyKurt/app.py`  
**Lines:** 22

```python
from tensorflow.keras.layers import Input, GRU, Dense, Dropout, BatchNormalization
```
**Explanation:** Imports the GRU layer class from TensorFlow/Keras.

---

### **2. GRU Layer 1 - First Recurrent Layer**
**File:** `SigntifyKurt/app.py`  
**Lines:** 29-31

```python
# GRU layers with BatchNorm and Dropout
x = GRU(128, return_sequences=True, activation='relu', name='gru_6')(input_layer)
x = BatchNormalization(name='batch_normalization')(x)
x = Dropout(0.3, name='dropout')(x)
```

**Explanation:**
- **GRU(128, ...)**: Creates a GRU layer with 128 units (hidden state size)
- **return_sequences=True**: Returns the full sequence output (needed for stacked GRU layers)
- **activation='relu'**: Uses ReLU activation function
- Processes sequences of 30 frames × 1662 features each

---

### **3. GRU Layer 2 - Second Recurrent Layer**
**File:** `SigntifyKurt/app.py`  
**Lines:** 33-35

```python
x = GRU(256, return_sequences=True, activation='relu', name='gru_7')(x)
x = BatchNormalization(name='batch_normalization_1')(x)
x = Dropout(0.3, name='dropout_1')(x)
```

**Explanation:**
- **GRU(256, ...)**: Second GRU layer with 256 units (deeper representation)
- **return_sequences=True**: Still returns sequences for the next layer
- Processes the output from the first GRU layer

---

### **4. GRU Layer 3 - Final Recurrent Layer**
**File:** `SigntifyKurt/app.py`  
**Lines:** 37-39

```python
x = GRU(128, return_sequences=False, activation='relu', name='gru_8')(x)
x = BatchNormalization(name='batch_normalization_2')(x)
x = Dropout(0.3, name='dropout_2')(x)
```

**Explanation:**
- **GRU(128, ...)**: Third GRU layer with 128 units
- **return_sequences=False**: Returns only the final output (not the sequence)
- This converts the sequence into a single feature vector for classification

---

### **5. GRU in Custom Objects (Model Loading)**
**File:** `SigntifyKurt/app.py`  
**Lines:** 62-67

```python
custom_objects = {
    'GRU': GRU,
    'BatchNormalization': BatchNormalization,
    'Dropout': Dropout,
    'Dense': Dense
}
```

**Explanation:** Required when loading a saved model to tell TensorFlow how to reconstruct the GRU layers.

---

### **6. GRU Model Prediction**
**File:** `SigntifyKurt/app.py`  
**Lines:** 136

```python
# Predict
res = model.predict(sequence_input, verbose=0)[0]
```

**Explanation:**
- The `model.predict()` call runs the input through all GRU layers
- Input shape: `(1, 30, 1662)` - 1 sample, 30 time steps, 1662 features per step
- Output: Probability distribution over 6 sign language classes

---

## Complete GRU Architecture Flow

```
Input: (1, 30, 1662)
    ↓
GRU Layer 1 (128 units) → BatchNorm → Dropout(0.3)
    ↓
GRU Layer 2 (256 units) → BatchNorm → Dropout(0.3)
    ↓
GRU Layer 3 (128 units) → BatchNorm → Dropout(0.3)
    ↓
Dense(128) → Dropout(0.4)
    ↓
Dense(64) → Dropout(0.4)
    ↓
Dense(6, softmax) → Output probabilities
```

---

## KNN (K-Nearest Neighbors) Algorithm

### **Status: NOT IMPLEMENTED**

**Result:** There is **NO KNN algorithm** in this codebase.

### Why KNN is Not Present:

1. **No KNN imports**: No `sklearn.neighbors.KNeighborsClassifier` or similar
2. **No distance calculations**: No Euclidean, Manhattan, or other distance metrics
3. **No training data storage**: KNN requires storing all training examples in memory
4. **No neighbor search**: No code that finds k nearest neighbors
5. **No voting mechanism**: KNN uses majority voting from neighbors

### Where KNN Would Be If Implemented:

If KNN were to be implemented, it would typically appear in:

1. **Training Script** (doesn't exist):
   ```python
   from sklearn.neighbors import KNeighborsClassifier
   knn = KNeighborsClassifier(n_neighbors=5)
   knn.fit(X_train, y_train)
   ```

2. **Prediction in `app.py`** (currently uses GRU):
   ```python
   # Instead of: res = model.predict(sequence_input, verbose=0)[0]
   # Would be: prediction = knn.predict(sequence_input)
   ```

3. **Model Storage**: KNN models would need to store training data, typically saved as:
   - Pickle files (`.pkl`)
   - Joblib files (`.joblib`)
   - Or training data in Firestore/database

---

## Algorithm Comparison

| Feature | Current (GRU) | KNN (Not Used) |
|---------|---------------|----------------|
| **Type** | Deep Learning / RNN | Instance-based Learning |
| **Training** | Requires training with backpropagation | No training, stores all data |
| **Prediction Method** | Forward pass through neural network | Find k nearest neighbors |
| **Memory** | Stores learned weights (~few MB) | Stores entire training dataset |
| **Speed** | Fast inference (~milliseconds) | Slower (must compute distances) |
| **Best For** | Sequential/temporal patterns | Simple classification with feature vectors |
| **Location in Code** | `app.py` lines 22, 29, 33, 37, 63 | **Not present** |

---

## Summary

- ✅ **GRU Algorithm**: Fully implemented in `app.py` (lines 22, 29, 33, 37, 63, 136)
- ❌ **KNN Algorithm**: Not implemented anywhere in the codebase

The project uses a **GRU-based deep learning approach** for sign language recognition, which is well-suited for sequential data (video frames of gestures) and provides real-time predictions.










