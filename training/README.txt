Signtify — retraining Live Translate (HandLandmarker keypoints -> GRU)

QUICK START (words + A–Z from this repo)
  From project root:
    python training/rasterize_alphabet_svgs.py    # SVG -> training/raw/a … z
    python training/bootstrap_word_images.py      # hello, thanks, yes, no from ASL pics
    python training/extract_keypoints.py --image-augments 6
    pip install "protobuf>=6.31.1,<8"   # if TensorFlow import breaks after mediapipe
    python training/train.py --epochs 80 --augment-copies 1 --augment-jitter-std 0.01

AUTO-TRAIN (try multiple configs and keep the best)
  From project root:
    python training/auto_train.py --trials 4 --epochs 90

  Optional full pipeline (prepare data first, then auto-train):
    python training/auto_train.py --prepare-data --trials 4 --epochs 90

  Equivalent npm shortcuts:
    npm run train:auto
    npm run train:auto:prepare

  Auto-train writes trial logs/results under:
    training/artifacts/auto_train/<timestamp>/
  Then it restores the best trial artifacts to:
    model_weights_only.weights.h5
    model_labels.json
    model_metadata.json

  Training writes:
    model_weights_only.weights.h5   (Keras 3 format — required suffix)
    model_labels.json              (only classes that had .npy data; order preserved)

  Restart: python app.py

WHAT YOU NEED
  Sequences must be shape (30, 126): left hand (63) + right hand (63).
  Short MP4 clips per sign work much better than one static PNG per letter.

1) training/raw/<label>/  — videos and/or images
2) training/label_map.json — full wish-list of class names in softmax order
3) python training/extract_keypoints.py
4) python training/train.py

WEIGHT FILE
  Flask loads model_weights_only.weights.h5 first, then model_weights_only.h5 for old checkpoints.

PARTIAL CLASSES
  train.py only trains labels that have at least one file under training/processed/<label>/.
  Missing folders are skipped; model_labels.json lists the trained subset only.

IMPROVE ACCURACY
  - Record yourself: 3–10 short clips per sign, good lighting, similar framing to Live Translate.
  - Add clips under training/raw/<label>/, re-run extract_keypoints.py and train.py.
  - New trainer defaults now include mirror augmentation, keypoint jitter, LR reduction on plateau, and label smoothing.
  - Extractor now generates multiple synthetic sequences per source image (`--image-augments`) so static datasets are less sparse.
  - Try: python training/train.py --epochs 100 --batch-size 32 --augment-copies 2
