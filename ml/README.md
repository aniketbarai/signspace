# Training pipeline

This directory turns the existing MediaPipe feature extraction into a trainable ML pipeline.

## What is trained

- **Hand gestures:** normalized 21-point hand landmarks (63 numeric features).
- **Facial expressions:** 24 selected MediaPipe face blendshape values.

MediaPipe remains the feature extractor. The custom model learns the mapping from those features to your project labels. This is much more practical than training a complete hand/face detector from scratch.

## 1. Install training dependencies

```bash
python -m venv .venv-ml
source .venv-ml/bin/activate       # Windows: .venv-ml\\Scripts\\activate
pip install -r ml/requirements.txt
```

## 2. Collect hand data

Run once per label. Start with at least 300 samples per label and repeat with several people, backgrounds, lighting conditions, and hand orientations.

```bash
python ml/collect_hand.py --label PINCH --samples 300
python ml/collect_hand.py --label FIST --samples 300
python ml/collect_hand.py --label OPEN_PALM --samples 300
python ml/collect_hand.py --label POINT --samples 300
python ml/collect_hand.py --label VICTORY --samples 300
python ml/collect_hand.py --label THUMBS_UP --samples 300
```

Press **Space** to capture a sample and **Q** to stop. The script writes normalized features to `ml/data/hand_landmarks.csv`.

## 3. Train the hand model

```bash
python ml/train_classifier.py \
  --input ml/data/hand_landmarks.csv \
  --model ml/models/hand_gesture.joblib \
  --algorithm random_forest
```

The command creates:

- `hand_gesture.joblib` — trained model artifact
- `hand_gesture.metrics.json` — precision, recall, F1, and accuracy
- `hand_gesture.confusion-matrix.png` — visual evaluation artifact

Do not report only accuracy. Check per-class recall and the confusion matrix, especially for similar classes such as `POINT` and `VICTORY`.

## 4. Collect facial-expression data

Download a compatible local MediaPipe `face_landmarker.task` model, then run once per expression label. Use the same people and conditions you expect at runtime, and label **facial expressions**, not a person's internal emotional state.

```bash
python ml/collect_face.py \
  --model path/to/face_landmarker.task \
  --label Happy \
  --samples 300
```

Repeat for `Sad`, `Angry`, `Surprised`, `Fearful`, `Disgusted`, and `Neutral`. The output is `ml/data/facial_blendshapes.csv`.

## 5. Train the expression model

```bash
python ml/train_classifier.py \
  --input ml/data/facial_blendshapes.csv \
  --model ml/models/facial_expression.joblib \
  --algorithm mlp
```

Use a **person-independent split** for a serious evaluation: people in the test set must not also appear in the training set. The generic script uses a stratified row split as a starter baseline; improve the split once a subject ID column is added to the collector.

## 6. Enable trained inference

Copy model artifacts to the machine running the Python service and configure:

```bash
export HAND_GESTURE_MODEL=/absolute/path/to/hand_gesture.joblib
export FACIAL_EXPRESSION_MODEL=/absolute/path/to/facial_expression.joblib
python ai-service/app.py
```

When `HAND_GESTURE_MODEL` is set, `/recognize-gesture` uses the trained model and falls back to the existing heuristic classifier if the artifact cannot be loaded or inference fails.

When `FACIAL_EXPRESSION_MODEL` is set, the service exposes:

```http
POST /predict-expression
Content-Type: application/json

{"blendshapes": {"mouthSmileLeft": 0.8, "mouthSmileRight": 0.8}}
```

The current browser emotion screen still uses its local blendshape formula for low latency. The endpoint is ready for a server-backed trained model integration; moving per-frame expression inference to the server would add network latency, so browser-side model export (ONNX/TensorFlow.js) is the better production optimization.

## Data and privacy

Do not commit camera images, CSVs, or model artifacts containing sensitive biometric information. The repository ignores generated `ml/data/*.csv` and `ml/models/*` files. Obtain consent from every person whose face or hand data is collected and document retention/deletion rules.
