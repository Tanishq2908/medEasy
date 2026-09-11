import requests
import numpy as np
from PIL import Image
import io

# Create a random RGB dummy image string
img = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))
buf = io.BytesIO()
img.save(buf, format='JPEG')
buf.seek(0)
img_bytes = buf.read()

endpoints = ['/analyze-brain', '/analyze-kidney', '/analyze-lung', '/analyze-ecg-signal']
found_errors = False

for ep in endpoints:
    print(f"Testing {ep}...")
    try:
        res = requests.post(f"http://127.0.0.1:5000{ep}", files={'image': ('dummy.jpg', img_bytes, 'image/jpeg')})
        print(f"  Status: {res.status_code}")
        data = res.json()
        print(f"  Confidence: {data.get('confidence', 'MISSING')}")
        print(f"  Prediction: {data.get('prediction', 'MISSING')}")
        print(f"  Fallback Source: {data.get('source', 'None')}")
        if 'error' in data:
            print(f"  ERROR: {data['error']}")
            found_errors = True
        print()
    except Exception as e:
        print(f"  FAIL: {e}")
        found_errors = True

if found_errors:
    print("Some endpoints failed!")
else:
    print("All endpoints OK!")
