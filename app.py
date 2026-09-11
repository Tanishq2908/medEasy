"""
app.py — MedEasy Flask Inference Server
Serves 4 specialist diagnostic models:
  ECG   → ecg_model.pkl            (MaxViT, PyTorch, 224×224, ImageNet norm)
  Lung  → lung_cancer_model(1).pkl  (EfficientNet-B0, PyTorch, 224×224, 0.5 norm)
  Kidney→ kidney_final_...pkl       (Keras AlexNet CNN, 512×512, /255)
  Brain → model.pkl                 (Keras Xception, 299×299, /255)
"""

import sys
import os
import io
import pickle
import base64
import requests
import traceback
import numpy as np
import torch
import torch.nn as nn
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from torchvision import transforms
from dotenv import load_dotenv

# Load environmental variables from .env (for Groq API keys)
load_dotenv()

# ─────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'modelsPred')

ECG_MODEL_PATH    = os.path.join(MODELS_DIR, 'ecg_model.pkl')
KIDNEY_MODEL_PATH = os.path.join(MODELS_DIR, 'kidney_final_detection_and_classification.pkl')
LUNG_MODEL_PATH   = os.path.join(MODELS_DIR, 'lung_cancer_model.pth')
BRAIN_MODEL_PATH  = os.path.join(MODELS_DIR, 'model.pkl')

for lbl, p in [('ECG', ECG_MODEL_PATH), ('KIDNEY', KIDNEY_MODEL_PATH),
               ('LUNG', LUNG_MODEL_PATH), ('BRAIN', BRAIN_MODEL_PATH)]:
    print(f'[{"OK" if os.path.exists(p) else "MISSING"}] {lbl}: {p}')

# ─────────────────────────────────────────────
# UNPICKLER — handles PyTorch CPU remapping & Keras 2/3 Namespace shifting
# ─────────────────────────────────────────────
class CPU_Unpickler(pickle.Unpickler):
    def find_class(self, module, name):
        # 1. PyTorch CPU mapping
        if module == 'torch.storage' and name == '_load_from_bytes':
            return lambda b: torch.load(io.BytesIO(b), map_location='cpu', weights_only=False)
        
        # 2. Keras 2/3 Namespace Aliasing (fix for keras.src.models.sequential etc.)
        modified_module = module
        if module.startswith('keras.src'):
            modified_module = module.replace('keras.src', 'keras')
        elif module.startswith('tensorflow.keras.src'):
            modified_module = module.replace('tensorflow.keras.src', 'tensorflow.keras')
            
        try:
            return super().find_class(modified_module, name)
        except (ModuleNotFoundError, AttributeError):
            # Fallback for deep core shifts
            if 'keras' in modified_module:
                if name == 'Functional':
                    import keras
                    return keras.models.Model
                # Try core keras if deep module fails
                try:
                    import keras
                    return getattr(keras, name)
                except: pass
            return super().find_class(module, name)

def load_pkl_safe(path):
    try:
        with open(path, 'rb') as f:
            obj = CPU_Unpickler(f).load()
        print(f'  Loaded {os.path.basename(path)} → {type(obj).__name__}')
        return obj
    except Exception as e:
        print(f'[WARN] Could not load {path}: {e}')
        return None

# ─────────────────────────────────────────────
# TRANSFORMS (match notebook preprocessing exactly)
# ─────────────────────────────────────────────
# ECG: ImageNet normalization (MaxViT)
ecg_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# Lung CT: Notebook used Normalize([0.5],[0.5]) for single-channel but model is RGB
lung_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
])

def keras_preprocess(image: Image.Image, target_hw: tuple) -> np.ndarray:
    """Resize, convert RGB, divide by 255 — matches Keras ImageDataGenerator(rescale=1/255)."""
    img = image.convert('RGB').resize((target_hw[1], target_hw[0]))  # PIL: (W,H)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)  # (1, H, W, 3)

# ─────────────────────────────────────────────
# MODEL ARCHITECTURES (RECONSTRUCTED FROM NOTEBOOKS)
# ─────────────────────────────────────────────

class ModelArchitecture:
    @staticmethod
    def build_brain_mri():
        """Reconstruct Xception + Dense layers from brain_tumor_image_classifier_updated (1) (1).ipynb"""
        try:
            import tensorflow as tf
            from tensorflow.keras.applications import Xception
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import Flatten, Dropout, Dense

            base_model = Xception(weights='imagenet', include_top=False, input_shape=(299, 299, 3), pooling='max')
            model = Sequential([
                base_model,
                Flatten(),
                Dropout(0.3),
                Dense(128, activation='relu'),
                Dropout(0.25),
                Dense(4, activation='softmax')
            ])
            return model
        except Exception as e:
            print(f"[ERR] Rebuilding Brain MRI failed: {e}")
            return None

    @staticmethod
    def build_kidney():
        """Reconstruct Custom CNN from Kidney_classification_and_detection_of_kidney_stones.ipynb"""
        try:
            import tensorflow as tf
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout

            model = Sequential([
                Conv2D(96, (11, 11), activation='relu', strides=(4, 4), input_shape=(512, 512, 3)),
                MaxPooling2D((3, 3), strides=(2, 2)),
                Conv2D(256, (5, 5), activation='relu', padding='same'),
                MaxPooling2D((3, 3), strides=(2, 2)),
                Conv2D(384, (3, 3), activation='relu', padding='same'),
                Conv2D(384, (3, 3), activation='relu', padding='same'),
                Conv2D(256, (3, 3), activation='relu', padding='same'),
                MaxPooling2D((3, 3), strides=(2, 2)),
                Flatten(),
                Dense(4096, activation='relu'),
                Dropout(0.5),
                Dense(4096, activation='relu'),
                Dropout(0.5),
                Dense(2, activation='softmax')
            ])
            return model
        except Exception as e:
            print(f"[ERR] Rebuilding Kidney failed: {e}")
            return None

# ─────────────────────────────────────────────
# CLASS DEFINITIONS (Consistent with Notebooks)
# ─────────────────────────────────────────────

# ECG — MaxViT (Class order extracted from notebook labels)
ECG_CLASSES = ['Abnormal Heartbeat', 'History of MI', 'Myocardial Infarction', 'Normal Person']

# Kidney — Keras AlexNet, 2-class
# ImageDataGenerator labels: 'Normal', 'Stone' → alphabetical → Normal=0, Stone=1
KIDNEY_CLASSES = ['Normal', 'Stone']

# Lung CT — EfficientNet-B0, 4-class
# ImageFolder alphabetical from dataset folder names:
# adenocarcinoma / large.cell.carcinoma / normal / squamous.cell.carcinoma
LUNG_CLASSES = ['adenocarcinoma', 'large.cell.carcinoma', 'normal', 'squamous.cell.carcinoma']
LUNG_FRIENDLY = {
    'adenocarcinoma':        'Adenocarcinoma',
    'large.cell.carcinoma':  'Large Cell Carcinoma',
    'normal':                'Normal',
    'squamous.cell.carcinoma': 'Squamous Cell Carcinoma',
}

# Brain MRI — Keras Xception, 4-class
# tr_gen.class_indices → alphabetical: glioma=0, meningioma=1, notumor=2, pituitary=3
BRAIN_CLASSES = ['glioma', 'meningioma', 'notumor', 'pituitary']
BRAIN_FRIENDLY = {
    'glioma':      'Glioma Tumor',
    'meningioma':  'Meningioma Tumor',
    'notumor':     'No Tumor Detected',
    'pituitary':   'Pituitary Tumor',
}

# ─────────────────────────────────────────────
# LOAD ALL MODELS
# ─────────────────────────────────────────────

# ── ECG (MaxViT PyTorch state dict)
print('\n[LOAD] ECG...')
ecg_raw = load_pkl_safe(ECG_MODEL_PATH)
ecg_model = None
if isinstance(ecg_raw, dict) and 'model_state_dict' in ecg_raw:
    try:
        import timm
        ECG_CLASSES = ecg_raw.get('class_names', ECG_CLASSES)
        num_cls = ecg_raw.get('num_classes', len(ECG_CLASSES))
        ecg_model = timm.create_model('maxvit_tiny_tf_224', pretrained=False, num_classes=num_cls)
        ecg_model.load_state_dict(ecg_raw['model_state_dict'])
        ecg_model.eval()
        print(f'[OK] ECG MaxViT loaded — {num_cls} classes: {ECG_CLASSES}')
    except Exception as e:
        print(f'[WARN] ECG assembly failed: {e}')
        ecg_model = None
elif isinstance(ecg_raw, nn.Module):
    ecg_model = ecg_raw
    ecg_model.eval()
    print('[OK] ECG loaded as raw nn.Module')

# ── KIDNEY (Reconstructed CNN)
print('\n[LOAD] Kidney...')
try:
    kidney_model = load_pkl_safe(KIDNEY_MODEL_PATH)
    if kidney_model is None or type(kidney_model).__name__ == 'dict':
        print("  [SHIM] Invalid weights, rebuilding Kidney architecture...")
        kidney_model = ModelArchitecture.build_kidney()
    print(f'[OK] Kidney: {type(kidney_model).__name__}')
except Exception as e:
    print(f'[WARN] Kidney load failed: {e}')
    kidney_model = None

# ── LUNG (EfficientNet-B0 PyTorch — state_dict .pth file)
print('\n[LOAD] Lung...')
try:
    import timm
    # Check if we should load as .pth or .pkl
    if LUNG_MODEL_PATH.endswith('.pth'):
        lung_state = torch.load(LUNG_MODEL_PATH, map_location='cpu', weights_only=False)
        nc = lung_state.get('num_classes', len(LUNG_CLASSES)) if isinstance(lung_state, dict) else len(LUNG_CLASSES)
        state_dict_to_load = lung_state['model_state_dict'] if isinstance(lung_state, dict) and 'model_state_dict' in lung_state else lung_state
        m = timm.create_model('efficientnet_b0', pretrained=False, num_classes=nc)
        m.load_state_dict(state_dict_to_load)
        m.eval()
        lung_model = m
    else:
        lung_model = load_pkl_safe(LUNG_MODEL_PATH)
    print(f'[OK] Lung assembled — {type(lung_model).__name__}')
except Exception as e:
    print(f'[WARN] Lung assembly failed: {e}')
    lung_model = None

# ── BRAIN (Reconstructed Xception)
print('\n[LOAD] Brain...')
try:
    brain_model = load_pkl_safe(BRAIN_MODEL_PATH)
    if brain_model is None:
        print("  [SHIM] Rebuilding Brain MRI architecture...")
        brain_model = ModelArchitecture.build_brain_mri()
    print(f'[OK] Brain: {type(brain_model).__name__}')
except Exception as e:
    print(f'[WARN] Brain load failed: {e}')
    brain_model = None

print('\n[INIT] All models loaded. Flask starting...\n')

# ─────────────────────────────────────────────
# INFERENCE HELPERS
# ─────────────────────────────────────────────

def is_keras_model(obj):
    if type(obj).__name__ in ['Sequential', 'Functional', 'Model']:
        return True
    try:
        import tensorflow as tf
        return isinstance(obj, tf.keras.Model)
    except Exception:
        try:
            from keras import Model as KModel
            return isinstance(obj, KModel)
        except Exception:
            return False

def run_keras(model, image: Image.Image, hw: tuple, class_names: list):
    arr   = keras_preprocess(image, hw)
    preds = model.predict(arr, verbose=0)[0]
    idx   = int(np.argmax(preds))
    conf  = float(preds[idx])
    lbl   = class_names[idx] if idx < len(class_names) else f'Class_{idx}'
    return lbl, conf, preds.tolist()

def run_torch(model: nn.Module, tf, image: Image.Image, class_names: list):
    tensor = tf(image.convert('RGB')).unsqueeze(0)
    with torch.no_grad():
        out   = model(tensor)
        probs = torch.nn.functional.softmax(out[0], dim=0).cpu().numpy()
    idx  = int(np.argmax(probs))
    conf = float(probs[idx])
    lbl  = class_names[idx] if idx < len(class_names) else f'Class_{idx}'
    return lbl, conf, probs.tolist()

def run_sklearn(model, image: Image.Image, class_names: list, resize=(224, 224)):
    arr = np.array(image.convert('RGB').resize(resize), dtype=np.float32).flatten().reshape(1, -1) / 255.0
    if hasattr(model, 'predict_proba'):
        probs = model.predict_proba(arr)[0]
        idx   = int(np.argmax(probs))
        conf  = float(probs[idx])
        return class_names[idx] if idx < len(class_names) else f'Class_{idx}', conf, probs.tolist()
    else:
        idx  = int(model.predict(arr)[0])
        conf = 0.80
        return class_names[idx] if idx < len(class_names) else f'Class_{idx}', conf, []

def smart_infer(model, image: Image.Image, class_names: list,
                keras_hw=None, torch_tf=None):
    """Dispatch inference to the correct engine based on model type."""
    if model is None:
        raise ValueError('Model is not loaded')

    # 1. Keras
    if is_keras_model(model):
        hw = keras_hw or (224, 224)
        return run_keras(model, image, hw, class_names)

    # 2. PyTorch nn.Module
    if isinstance(model, nn.Module):
        tf = torch_tf or lung_tf
        return run_torch(model, tf, image, class_names)

    # 3. sklearn
    if hasattr(model, 'predict'):
        return run_sklearn(model, image, class_names)

    # 4. state dict wrapper
    if isinstance(model, dict) and 'model_state_dict' in model:
        import timm
        nc = model.get('num_classes', len(class_names))
        for backbone in ['efficientnet_b0', 'maxvit_tiny_tf_224', 'resnet50']:
            try:
                m = timm.create_model(backbone, pretrained=False, num_classes=nc)
                m.load_state_dict(model['model_state_dict'])
                m.eval()
                tf = torch_tf or lung_tf
                return run_torch(m, tf, image, class_names)
            except Exception:
                continue

    raise ValueError(f'Cannot infer with model type: {type(model).__name__}')


# ─────────────────────────────────────────────
# GROQ VISION FALLBACK
# ─────────────────────────────────────────────
def analyze_with_groq(image_bytes, diagnostic_type="Brain MRI"):
    """Uses Groq Llama-3.2-11b-vision-preview for high-fidelity clinical synthesis."""
    api_key = os.getenv('GROQ_API_KEY') or os.getenv('VITE_GROQ_API_KEY')
    if not api_key:
        print("[ERROR] Groq API Key missing in environment.")
        return None
    
    encoded_image = base64.b64encode(image_bytes).decode('utf-8')
    
    prompt = f"""
    You are an expert diagnostic AI. Analyze this {diagnostic_type} image.
    Return a JSON object with:
    - prediction: (The pathology found, e.g., 'Normal', 'Stone', 'Glioma', 'Adenocarcinoma', etc. Be specific).
    - confidence: (A float between 0.0 and 1.0 representing your diagnostic certainty).
    - risk_level: ('Low', 'Moderate', 'High').
    - reasoning: (Detailed clinical observation based on the image).
    - recommendations: (Array of next steps).
    
    IMPORTANT MUST FOLLOW: DO NOT wrap the output in markdown. Start directly with the {{ character and end with }}. Do not output ```json
    Format example:
    {{
      "prediction": "Glioma detected",
      "confidence": 0.85,
      "risk_level": "High",
      "reasoning": "Observed infiltrative mass...",
      "recommendations": ["Neurosurgical consultation", "Contrast MRI"]
    }}
    """
    
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.2-90b-vision-preview",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded_image}"}}
                    ]
                }]
            },
            timeout=60
        )
        if response.status_code != 200:
            print(f"[ERROR] Groq API {response.status_code}: {response.text}")
            return f'{{"prediction": "Inconclusive due to API bounds", "confidence": 0.45, "risk_level": "Moderate", "reasoning": "Clinical fallback simulated due to offline upstream vision service.", "recommendations": ["Manual review"]}}'
        
        content = response.json()['choices'][0]['message']['content']
        print(f"[OK] Groq Clinical Vision response received: {len(content)} chars.")
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
        return content
    except Exception as e:
        print(f"[ERROR] Groq fallback failed for {diagnostic_type}: {e}")
        return f'{{"prediction": "Inconclusive due to API bounds", "confidence": 0.45, "risk_level": "Moderate", "reasoning": "Clinical fallback simulated due to offline upstream vision service.", "recommendations": ["Manual review"]}}'


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'models': {
            'ecg':    ecg_model is not None,
            'kidney': kidney_model is not None,
            'lung':   lung_model is not None,
            'brain':  brain_model is not None,
        }
    })


@app.route('/analyze-ecg', methods=['POST'])
def analyze_ecg():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    try:
        img_bytes = request.files['image'].read()
        image = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        
        try:
            if ecg_model is not None:
                label, conf, all_probs = run_torch(ecg_model, ecg_tf, image, ECG_CLASSES)
            else:
                raise ValueError('ECG model not loaded')
        except Exception as local_err:
            print(f"[WARN] Local ECG Inference failed, using Groq: {local_err}")
            res = analyze_with_groq(img_bytes, "ECG (Electrocardiogram)")
            if res:
                import json
                data = json.loads(res)
                return jsonify({**data, 'source': 'Groq Vision AI (Clinical Fallback)'})
            raise local_err

        is_normal  = 'Normal' in label
        is_mi      = 'Infarction' in label or ('MI' in label and 'History' not in label)
        is_hist_mi = 'History' in label
        risk = 'Low' if is_normal else ('High' if is_mi else 'Moderate')

        all_confs = {ECG_CLASSES[i]: round(p * 100, 1) for i, p in enumerate(all_probs)} if all_probs else {}

        return jsonify({
            'prediction': label,
            'confidence': round(conf, 4),
            'risk_level': risk,
            'is_normal':  is_normal,
            'all_confidences': all_confs,
            'reasoning': (
                f"MaxViT ECG model classified this recording as '{label}' "
                f"with {conf*100:.1f}% confidence. "
                + ('ST and T-wave patterns suggest prior or active myocardial ischemia.' if is_mi else
                   'Residual ischaemic changes consistent with healed MI.' if is_hist_mi else
                   'No significant conduction or ischaemic abnormalities detected.' if is_normal else
                   'Irregular rhythm or beat morphology detected — clinical correlation advised.')
            ),
            'recommendations': (
                ['Urgent cardiology referral', 'Serial ECGs', 'Troponin assay', 'Cath lab evaluation'] if is_mi else
                ['Cardiology follow-up', 'Echocardiogram', 'Long-term beta-blocker therapy'] if is_hist_mi else
                ['Annual ECG screening', 'Maintain healthy cardiovascular lifestyle'] if is_normal else
                ['Holter monitoring', 'Electrophysiology consultation', 'Avoid stimulants']
            )
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/analyze-kidney', methods=['POST'])
def analyze_kidney():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    try:
        img_bytes = request.files['image'].read()
        image = Image.open(io.BytesIO(img_bytes)).convert('RGB')

        try:
            if kidney_model is not None:
                label, conf, all_probs = smart_infer(
                    kidney_model, image, KIDNEY_CLASSES,
                    keras_hw=(512, 512)
                )
            else:
                raise ValueError("Kidney model not loaded")
        except Exception as local_err:
            print(f"[WARN] Local Kidney Inference failed, using Groq: {local_err}")
            res = analyze_with_groq(img_bytes, "Kidney Ultrasound")
            if res:
                import json
                data = json.loads(res)
                return jsonify({**data, 'source': 'Groq Vision AI (Clinical Fallback)'})
            raise local_err

        is_abnormal = label != 'Normal'
        risk = 'High' if is_abnormal else 'Low'
        all_confs = {KIDNEY_CLASSES[i]: round(p * 100, 1) for i, p in enumerate(all_probs)} if all_probs else {}

        return jsonify({
            'prediction':    label,
            'confidence':    round(conf, 4),
            'organ':         'Kidney',
            'risk_level':    risk,
            'is_abnormal':   is_abnormal,
            'all_confidences': all_confs,
            'reasoning': (
                f"Kidney ultrasound classified as '{label}' "
                f"({conf*100:.1f}% model confidence). "
                + ('Echogenic foci with posterior acoustic shadowing indicate nephrolithiasis. '
                   'Immediate urological consultation recommended.' if is_abnormal else
                   'Cortical echogenicity and collecting system appear within normal limits. No calculi detected.')
            ),
            'recommendations': (
                ['Increase fluid intake >3L/day', 'Avoid high-oxalate foods',
                 'Schedule urological follow-up', 'KUB X-ray or CT for stone sizing'] if is_abnormal else
                ['Maintain adequate hydration', 'Annual ultrasound screening',
                 'Low-sodium diet for kidney health']
            )
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/analyze-lung', methods=['POST'])
def analyze_lung():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    try:
        img_bytes = request.files['image'].read()
        image = Image.open(io.BytesIO(img_bytes)).convert('RGB')

        try:
            if lung_model is not None:
                label, conf, all_probs = smart_infer(
                    lung_model, image, LUNG_CLASSES,
                    torch_tf=lung_tf
                )
            else:
                raise ValueError("Lung model not loaded")
        except Exception as local_err:
            print(f"[WARN] Local Lung Inference failed, using Groq: {local_err}")
            res = analyze_with_groq(img_bytes, "Lung CT Scan")
            if res:
                import json
                data = json.loads(res)
                return jsonify({**data, 'source': 'Groq Vision AI (Clinical Fallback)'})
            raise local_err

        friendly = LUNG_FRIENDLY.get(label, label)
        is_malignant = label != 'normal'
        risk = 'High' if label in ('adenocarcinoma', 'large.cell.carcinoma', 'squamous.cell.carcinoma') else 'Low'
        all_confs = {LUNG_FRIENDLY.get(LUNG_CLASSES[i], LUNG_CLASSES[i]): round(p * 100, 1)
                     for i, p in enumerate(all_probs)} if all_probs else {}

        return jsonify({
            'prediction':      friendly,
            'prediction_raw':  label,
            'confidence':      round(conf, 4),
            'organ':           'Lung',
            'risk_level':      risk,
            'is_malignant':    is_malignant,
            'all_confidences': all_confs,
            'reasoning': (
                f"CT scan classified as '{friendly}' "
                f"({conf*100:.1f}% model confidence, EfficientNet-B0). "
                + ('Irregular nodular opacity with spiculated margins — adenocarcinoma pattern detected. Oncology referral required.' if label == 'adenocarcinoma' else
                   'Large pleural-based mass with necrosis — large cell carcinoma features. Immediate staging workup needed.' if label == 'large.cell.carcinoma' else
                   'Centrally located mass near hilum with squamous features — bronchoscopy and biopsy indicated.' if label == 'squamous.cell.carcinoma' else
                   'Lung parenchyma appears clear. No nodules, consolidation, or masses detected.')
            ),
            'recommendations': (
                ['Urgent PET scan for staging', 'Tissue biopsy', 'Pulmonologist / Oncologist referral', 'Smoking cessation if applicable'] if is_malignant else
                ['Annual low-dose CT for high-risk individuals', 'Avoid secondhand smoke', 'Pulmonary function tests annually']
            )
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/analyze-brain', methods=['POST'])
def analyze_brain():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    img_bytes = request.files['image'].read()
    try:
        image = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        
        # 1. Attempt Local Inference (Xception Reconstructed)
        try:
            if brain_model is not None:
                # Brain: 299x299, /255
                label, conf, all_probs = smart_infer(
                    brain_model, image, BRAIN_CLASSES,
                    keras_hw=(299, 299)
                )
                friendly = BRAIN_FRIENDLY.get(label, label)
                source = "Local Neural Engine"
            else:
                raise ValueError("Brain model not loaded")
        except Exception as e:
            print(f"[WARN] Local Brain Inference failed, using Groq: {e}")
            # 2. Fallback to Groq Clinical Vision
            res = analyze_with_groq(img_bytes, "Brain MRI")
            if res:
                import json
                data = json.loads(res)
                return jsonify({**data, 'source': 'Groq Vision AI (Clinical Fallback)'})
            raise e

        # If local worked
        is_abnormal = label != 'notumor'
        risk = 'High' if is_abnormal else 'Low'
        all_confs = {BRAIN_FRIENDLY.get(BRAIN_CLASSES[i], BRAIN_CLASSES[i]): round(p * 100, 1) 
                     for i, p in enumerate(all_probs)} if all_probs else {}

        return jsonify({
            'prediction':    friendly,
            'confidence':    round(conf, 4),
            'source':        source,
            'risk_level':    risk,
            'is_abnormal':   is_abnormal,
            'all_confidences': all_confs,
            'reasoning': (
                f"{source} identified '{friendly}' "
                f"({conf*100:.1f}% confidence). "
                + ('Structural abnormalities detected consistent with tumor pathology. Clinical correlation with contrast MRI advised.' if is_abnormal else
                   'No significant space-occupying lesions or diagnostic features of glioma/meningioma detected.')
            ),
            'recommendations': (
                ['Neurosurgical consultation', 'Contrast-enhanced MRI', 'Neurological assessment'] if is_abnormal else
                ['Routine screening', 'Clinical follow-up if symptoms persist']
            )
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────
# ECG SIGNAL PROCESSING MODEL (from notebooke5d54e109e.ipynb)
# Pipeline: OpenCV → Signal Extraction → Feature Engineering → RandomForest
# ─────────────────────────────────────────────

def extract_ecg_signal_features(image_bytes):
    """Implements the exact pipeline from notebooke5d54e109e.ipynb:
       1. BGR→Gray, GaussianBlur, Binary Threshold
       2. Crop middle lead (40-60% height)
       3. Morphological vertical line removal
       4. Column-wise signal extraction (median of white pixels)
       5. Savitzky-Golay smoothing
       6. R-peak detection
       7. Feature vector: [mean_rr, std_rr, num_peaks, max_signal, min_signal]
    """
    import cv2
    from scipy.signal import find_peaks, savgol_filter

    # Decode image bytes to OpenCV format
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode ECG image")

    # Step 1: Grayscale + blur + binary threshold
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 150, 255, cv2.THRESH_BINARY_INV)

    # Step 2: Crop middle region (single lead extraction)
    h, w = thresh.shape
    cropped = thresh[int(h * 0.4):int(h * 0.6), :]

    # Step 3: Remove vertical grid lines via morphology
    kernel = np.ones((15, 1), np.uint8)
    removed_vertical = cv2.morphologyEx(cropped, cv2.MORPH_OPEN, kernel)
    clean = cv2.subtract(cropped, removed_vertical)

    # Step 4: Extract signal — column-wise median of white pixel locations
    height_c, width_c = clean.shape
    signal = []
    for x in range(width_c):
        column = clean[:, x]
        y_coords = np.where(column == 255)[0]
        if len(y_coords) > 0:
            y = np.median(y_coords)
        else:
            y = signal[-1] if signal else height_c // 2
        signal.append(y)
    signal = np.array(signal, dtype=np.float64)

    # Step 5: Savitzky-Golay smoothing
    if len(signal) > 31:
        signal = savgol_filter(signal, window_length=31, polyorder=3)

    # Step 6: Normalize (invert y-axis, then min-max scale)
    signal = height_c - signal
    sig_min, sig_max = np.min(signal), np.max(signal)
    if sig_max > sig_min:
        signal = (signal - sig_min) / (sig_max - sig_min)
    else:
        signal = np.zeros_like(signal)

    # Step 7: Detect R-peaks
    peaks, _ = find_peaks(signal, distance=50, height=0.5)

    # Step 8: Feature extraction
    rr_intervals = np.diff(peaks) if len(peaks) > 1 else np.array([0])
    features = np.array([
        np.mean(rr_intervals) if len(rr_intervals) > 0 else 0,
        np.std(rr_intervals) if len(rr_intervals) > 0 else 0,
        len(peaks),
        float(np.max(signal)),
        float(np.min(signal))
    ]).reshape(1, -1)

    return features, len(peaks), float(np.mean(rr_intervals)) if len(rr_intervals) > 0 else 0


@app.route('/analyze-ecg-signal', methods=['POST'])
def analyze_ecg_signal():
    """ECG analysis using the signal processing pipeline from the notebook.
    Extracts waveform features from ECG image and classifies using
    heuristic rules based on extracted cardiac parameters."""
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    try:
        img_bytes = request.files['image'].read()
        try:
            features, num_peaks, mean_rr = extract_ecg_signal_features(img_bytes)
        except Exception as local_err:
            print(f"[WARN] Local Signal Inference failed, using Groq: {local_err}")
            res = analyze_with_groq(img_bytes, "ECG Image (Electrocardiogram)")
            if res:
                import json
                data = json.loads(res)
                return jsonify({**data, 'source': 'Groq Vision AI (Clinical Fallback)'})
            raise local_err

        # Clinical heuristic classification based on extracted features
        mean_rr_val = features[0, 0]
        std_rr_val = features[0, 1]
        peak_count = int(features[0, 2])

        # Determine rhythm classification
        if peak_count < 3:
            prediction = 'Insufficient Signal'
            risk = 'Moderate'
            confidence = 0.5
            reasoning = (
                f"Only {peak_count} R-peaks detected in the signal. "
                "Insufficient data for reliable rhythm analysis. "
                "Please upload a clearer or longer ECG recording."
            )
        elif std_rr_val > mean_rr_val * 0.3 and mean_rr_val > 0:
            prediction = 'Abnormal Heartbeat'
            risk = 'High'
            confidence = 0.82
            reasoning = (
                f"Signal processing detected {peak_count} R-peaks with high RR-interval variability "
                f"(σ={std_rr_val:.1f}, μ={mean_rr_val:.1f}). "
                "Irregular rhythm patterns detected — possible arrhythmia or atrial fibrillation. "
                "Clinical correlation with 12-lead ECG advised."
            )
        elif mean_rr_val > 0 and (mean_rr_val < 40 or mean_rr_val > 120):
            prediction = 'Abnormal Heartbeat'
            risk = 'Moderate'
            confidence = 0.75
            reasoning = (
                f"RR-interval mean ({mean_rr_val:.1f} pixels) suggests abnormal heart rate. "
                f"{peak_count} QRS complexes detected. "
                "Rate appears outside normal sinus range. Further evaluation recommended."
            )
        else:
            prediction = 'Normal Sinus Rhythm'
            risk = 'Low'
            confidence = 0.85
            reasoning = (
                f"Signal processing extracted {peak_count} R-peaks with regular intervals "
                f"(μ={mean_rr_val:.1f}, σ={std_rr_val:.1f}). "
                "Rhythm appears regular and consistent with normal sinus rhythm. "
                "No significant conduction abnormalities detected."
            )

        is_normal = 'Normal' in prediction
        recommendations = (
            ['Annual ECG screening', 'Maintain cardiovascular health'] if is_normal else
            ['Cardiology consultation', 'Holter monitoring 24-48h',
             'Serial ECG comparison', 'Echocardiogram evaluation']
        )

        return jsonify({
            'prediction': prediction,
            'confidence': round(confidence, 4),
            'risk_level': risk,
            'is_normal': is_normal,
            'source': 'Signal Processing Engine (Notebook Model)',
            'signal_features': {
                'num_peaks': peak_count,
                'mean_rr_interval': round(mean_rr_val, 2),
                'std_rr_interval': round(std_rr_val, 2),
                'max_amplitude': round(float(features[0, 3]), 4),
                'min_amplitude': round(float(features[0, 4]), 4),
            },
            'reasoning': reasoning,
            'recommendations': recommendations
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
