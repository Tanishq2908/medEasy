import cv2
import PIL.Image
import numpy as np
import app

print("====================================")
print("  DIRECT MODEL INFERENCE TEST")
print("====================================")

# 1. Load the Kidney Model exactly as the backend does
print("Loading model...")
model_obj = app.load_pkl_safe(app.KIDNEY_MODEL_PATH)
class_names = ['Normal', 'Kidney Stone', 'Cyst', 'Tumor']

if not model_obj:
    print("[ERROR] Failed to load kidney model")
    exit(1)

def test_image(image_path):
    import os
    if not os.path.exists(image_path):
        print(f"\n[ERROR] '{image_path}' not found! Please place it in the doctor-ai folder.")
        return

    print(f"\nAnalyzing: {image_path}")
    
    # Read with CV2 as requested, but convert to PIL so it matches app.py exactly
    cv_img = cv2.imread(image_path)
    if cv_img is None:
        print(f"[ERROR] cv2 could not load {image_path}")
        return
        
    # Convert BGR to RGB
    cv_img_rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    pil_img = PIL.Image.fromarray(cv_img_rgb)
    
    # Run the exact inference pipeline from app.py
    idx, conf = app.run_sklearn_inference(model_obj, pil_img)
    predicted = class_names[idx] if idx < len(class_names) else f'Class {idx}'
    
    print(f" -> Output Class Index : {idx}")
    print(f" -> Interpreted As   : {predicted}")
    print(f" -> Confidence       : {conf*100:.1f}%")

# 2. Test both images
test_image("test1.jpg")
test_image("test2.jpg")

print("\nDONE.")
