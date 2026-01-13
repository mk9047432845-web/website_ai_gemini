from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import os
import requests
from werkzeug.utils import secure_filename
import tensorflow as tf

# =========================
# APP CONFIG
# =========================
app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp"}

IMG_SIZE = 224
CLASS_LABELS = ["Benign", "Malignant", "Normal"]

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# =========================
# HUGGING FACE MODEL CONFIG
# =========================
MODEL_URL = "https://huggingface.co/mani880740255/skin_care_tflite/resolve/main/skin_model_quantized.tflite"
MODEL_PATH = "skin_model_quantized.tflite"

# =========================
# DOWNLOAD MODEL (ONLY ONCE)
# =========================
def download_model():
    if not os.path.exists(MODEL_PATH):
        print("⬇️ Downloading TFLite model from Hugging Face...")
        r = requests.get(MODEL_URL)
        if r.status_code != 200:
            raise Exception("Failed to download model")
        with open(MODEL_PATH, "wb") as f:
            f.write(r.content)
        print("✅ Model downloaded successfully")

# =========================
# LOAD TFLITE MODEL
# =========================
interpreter = None
input_details = None
output_details = None

print("======================================")
print("Initializing model...")

try:
    download_model()
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    print("🚀 Model loaded successfully")
except Exception as e:
    print("❌ Model load failed:", e)

print("======================================")

# =========================
# HELPERS
# =========================
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def preprocess_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    img = img.astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)
    return img

# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    if interpreter is None:
        return jsonify({"error": "Model not loaded"}), 500

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid image format"}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        img = preprocess_image(filepath)
        os.remove(filepath)

        if img is None:
            return jsonify({"error": "Invalid image"}), 400

        interpreter.set_tensor(input_details[0]["index"], img)
        interpreter.invoke()
        predictions = interpreter.get_tensor(output_details[0]["index"])

        class_index = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][class_index])

        probabilities = {
            CLASS_LABELS[i]: float(predictions[0][i])
            for i in range(len(CLASS_LABELS))
        }

        return jsonify({
            "success": True,
            "prediction": CLASS_LABELS[class_index],
            "confidence": confidence,
            "probabilities": probabilities
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": interpreter is not None
    })

# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
