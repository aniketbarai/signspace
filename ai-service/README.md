# SignSpace DeepFace service

This service keeps the existing FastAPI contract and replaces the previous `face_recognition`/dlib implementation with DeepFace.

## Preserved API contract

`POST /generate-embedding` still accepts:

```json
{"image":"<base64 image or data URL>"}
```

and returns either:

```json
{"success":true,"embedding":[0.01,0.02]}
```

or a safe message such as `No face detected`, `Multiple faces detected`, `Invalid image`, or `Face embedding generation failed`.

The Node API does not need a frontend or route change. The embedding length changes because DeepFace uses the configured model, so existing users enrolled with the old dlib/face_recognition 128-value representation should re-enroll after this migration; old and new embedding formats must not be compared.

## Windows PowerShell installation

From the `ai-service` folder:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The requirements include `tf-keras`, which is required by DeepFace's RetinaFace integration when TensorFlow 2.21 or another Keras 3-enabled TensorFlow release is installed. If an existing virtual environment was installed from an older ZIP, repair it with:

```powershell
python -m pip install --upgrade tf-keras
```

Then restart `python app.py`.

The requirements intentionally remove `face-recognition` and `dlib`. DeepFace uses its supported dependencies and the OpenCV detector by default, avoiding dlib for this service.

If PowerShell blocks activation for the current terminal, run PowerShell as the current user and then retry:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Environment variables

Optional values are read by `face_service.py`:

```powershell
$env:PORT="8000"
$env:DEEPFACE_MODEL="Facenet512"
$env:DEEPFACE_DETECTOR_BACKEND="opencv"
$env:TF_USE_LEGACY_KERAS="1"
```

The default model is `Facenet512` and the default detector is `opencv`. On first use, DeepFace may download the model weights into its local cache. If the DeepFace detector itself throws a Windows runtime error, the service uses OpenCV's bundled Haar cascade as a detection fallback and still sends the detected crop through DeepFace for the embedding. No raw face image or embedding is logged by this service.

If the API returns `Face detection failed` during local development, restart the service with diagnostic logging enabled and retry once:

```powershell
$env:DEBUG="true"
$env:TF_USE_LEGACY_KERAS="1"
python app.py
```

The terminal will show the detector exception without logging the image or embedding. In production, keep `DEBUG` unset or set it to `false`.

## Start the service

```powershell
.\.venv\Scripts\Activate.ps1
python app.py
```

It listens on `http://127.0.0.1:8000` by default. The Node project should use:

```env
PYTHON_AI_URL=http://127.0.0.1:8000
```

## Test health

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

## Test embedding generation

Convert a local image to base64 and call the unchanged endpoint:

```powershell
$imageBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\one-face.jpg"))
$body = @{ image = $imageBase64 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/generate-embedding -ContentType "application/json" -Body $body
```

Use an image containing exactly one clear face. Images with no face, multiple faces, invalid base64, or an extremely small face are rejected.

## Security and limitations

The service validates the base64 payload and image decode, rejects ambiguous multiple-face input, normalizes the returned numerical embedding, and returns safe errors without stack traces. Liveness/anti-spoofing is not implemented; it remains a future enhancement. Do not treat a valid face embedding as proof of liveness.
