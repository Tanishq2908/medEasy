"""
test_models.py — Doctor-AI Model Health Check
Generates synthetic test images and tests all 4 Flask inference endpoints.
Run with: python test_models.py
"""

import os, sys, io, json, time, random
import requests
from PIL import Image, ImageDraw, ImageFont
import numpy as np

BASE_URL = "http://127.0.0.1:5000"
PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
INFO = "\033[94m[INFO]\033[0m"
WARN = "\033[93m[WARN]\033[0m"


def make_image(mode="ecg", size=(224, 224)):
    """Generate a synthetic medical-looking test image."""
    img = Image.new("RGB", size, color=(10, 10, 30))
    draw = ImageDraw.Draw(img)

    if mode == "ecg":
        # Draw fake ECG waveform
        draw.rectangle([0, 0, size[0], size[1]], fill=(0, 10, 20))
        pts = []
        for x in range(0, size[0], 2):
            t = x / size[0] * 4 * 3.14159
            # PQRST-like waveform
            y = size[1]//2 + int(40 * np.sin(t) + 20 * np.sin(3*t) - 30 * (1 if 40 < x % 60 < 50 else 0))
            pts.append((x, max(10, min(size[1]-10, y))))
        for i in range(len(pts)-1):
            draw.line([pts[i], pts[i+1]], fill=(0, 255, 180), width=2)
        draw.text((10, 10), "ECG", fill=(0, 200, 100))

    elif mode == "kidney":
        # Draw fake ultrasound (grey grainy blob)
        draw.rectangle([0, 0, size[0], size[1]], fill=(15, 15, 15))
        for _ in range(3000):
            x, y = random.randint(0, size[0]-1), random.randint(0, size[1]-1)
            v = random.randint(30, 120)
            draw.point((x, y), fill=(v, v, v))
        # Kidney shaped ellipse
        cx, cy = size[0]//2, size[1]//2
        draw.ellipse([cx-60, cy-40, cx+60, cy+40], outline=(200, 200, 180), width=2)
        # Stone: bright spot
        draw.ellipse([cx+20, cy-10, cx+35, cy+5], fill=(230, 230, 230))
        draw.text((10, 10), "KIDNEY US", fill=(180, 180, 180))

    elif mode == "lung":
        # Dark lung CT appearance
        draw.rectangle([0, 0, size[0], size[1]], fill=(5, 5, 5))
        # Lung outlines
        draw.ellipse([20, 40, 100, size[1]-40], outline=(80, 80, 80), width=2)
        draw.ellipse([size[0]-100, 40, size[0]-20, size[1]-40], outline=(80, 80, 80), width=2)
        # Nodule
        draw.ellipse([70, 80, 90, 100], fill=(140, 140, 140))
        draw.text((10, 10), "CT LUNG", fill=(120, 120, 120))

    elif mode == "brain":
        # MRI-like appearance
        draw.ellipse([20, 20, size[0]-20, size[1]-20], fill=(60, 50, 50), outline=(150, 130, 130), width=3)
        # Brain folds
        for i in range(5):
            x = 30 + i * 35
            draw.arc([x, 50, x+30, size[1]-50], start=0, end=180, fill=(90, 75, 75), width=2)
        # Possible tumor mass
        draw.ellipse([80, 70, 130, 110], fill=(180, 100, 100))
        draw.text((10, 10), "BRAIN MRI", fill=(160, 140, 140))

    # Save to bytes
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    buf.seek(0)
    return buf


def test_endpoint(name, endpoint, image_mode):
    print(f"\n{'='*55}")
    print(f"  Testing: {name}  ->  {endpoint}")
    print(f"{'='*55}")

    img_buf = make_image(mode=image_mode)
    files = {"image": (f"test_{image_mode}.jpg", img_buf, "image/jpeg")}

    t0 = time.time()
    try:
        resp = requests.post(f"{BASE_URL}{endpoint}", files=files, timeout=60)
        elapsed = time.time() - t0

        if resp.status_code == 200:
            data = resp.json()
            print(f"{PASS} HTTP 200 in {elapsed:.2f}s")
            print(f"  Prediction  : {data.get('prediction', 'N/A')}")
            print(f"  Confidence  : {data.get('confidence', 0)*100:.1f}%")
            print(f"  Risk Level  : {data.get('risk_level', 'N/A')}")

            # Extra fields per model
            if "has_tumor" in data:
                print(f"  Has Tumor?  : {data['has_tumor']}")
            if "is_malignant" in data:
                print(f"  Malignant?  : {data['is_malignant']}")
            if "is_abnormal" in data:
                print(f"  Abnormal?   : {data['is_abnormal']}")
            if "reasoning" in data:
                print(f"  Reasoning   : {data['reasoning'][:100]}...")

            return True, data
        else:
            print(f"{FAIL} HTTP {resp.status_code}")
            print(f"  Response: {resp.text[:300]}")
            return False, {}

    except requests.exceptions.ConnectionError:
        print(f"{FAIL} Could not connect to {BASE_URL}. Is Flask running?")
        return False, {}
    except requests.exceptions.Timeout:
        print(f"{FAIL} Request timed out after 60s (model may be loading)")
        return False, {}
    except Exception as e:
        print(f"{FAIL} Unexpected error: {e}")
        return False, {}


def test_health():
    print(f"\n{'='*55}")
    print(f"  Flask Health Check  ->  /health")
    print(f"{'='*55}")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"{PASS} Flask is UP")
            models = data.get("models", {})
            for k, v in models.items():
                status = f"{PASS}" if v else f"{WARN} (fallback mode)"
                print(f"  {k.upper()} model loaded: {status}")
            return True
        else:
            print(f"{FAIL} /health returned {resp.status_code}")
            return False
    except Exception as e:
        print(f"{FAIL} Flask not reachable: {e}")
        return False


def main():
    print("\n" + "="*55)
    print("  DOCTOR-AI MODEL TEST SUITE")
    print("="*55)

    # Step 1: Health check
    if not test_health():
        print(f"\n{FAIL} Flask is not running. Start with: python app.py")
        sys.exit(1)

    results = {}

    # Step 2: Test each model
    tests = [
        ("ECG Analysis",            "/analyze-ecg",    "ecg"),
        ("Kidney Ultrasound",        "/analyze-kidney", "kidney"),
        ("Lung Cancer CT",           "/analyze-lung",   "lung"),
        ("Brain Tumor MRI",          "/analyze-brain",  "brain"),
    ]

    for name, endpoint, mode in tests:
        ok, data = test_endpoint(name, endpoint, mode)
        results[name] = "PASS" if ok else "FAIL"

    # Step 3: Summary
    print(f"\n{'='*55}")
    print("  TEST SUMMARY")
    print("="*55)
    all_pass = True
    for name, result in results.items():
        icon = PASS if result == "PASS" else FAIL
        print(f"  {icon}  {name}")
        if result != "PASS":
            all_pass = False

    if all_pass:
        print(f"\n{PASS} All 4 models responding correctly!")
    else:
        print(f"\n{WARN} Some models failed — check Flask console for details.")

    print()


if __name__ == "__main__":
    main()
