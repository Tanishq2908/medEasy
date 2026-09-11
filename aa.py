# direct_test.py (Saved in your doctor-ai folder)
import cv2
import PIL.Image
import app

print("Loading model...")
model_obj = app.load_pkl_safe(app.KIDNEY_MODEL_PATH)
print(f"Model type: {type(model_obj)}")
if isinstance(model_obj, dict):
    print(f"Dict keys: {list(model_obj.keys())}")
class_names = ['Normal', 'Kidney Stone']

def test_image(image_path):
    print(f"\nAnalyzing: {image_path}")
    cv_img = cv2.imread(image_path)
    
    cv_img_rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    pil_img = PIL.Image.fromarray(cv_img_rgb)
    
    # Run the exact inference pipeline from app.py
    predicted, conf = app.infer_model(model_obj, class_names, pil_img)
    
    print(f" -> Interpreted As     : {predicted}")
    print(f" -> Confidence         : {conf*100:.1f}%")

test_image("C:/Users/Tashu/Downloads/images (1).jpg")
test_image("C:/Users/Tashu/Downloads/Ultrasound-for-Kidney-Stone-min-1024x576.webp")
