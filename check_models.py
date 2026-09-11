import pickle
import os

models_dir = r"c:\Users\Tashu\OneDrive\Desktop\doctor-ai\modelsPred"

for file in os.listdir(models_dir):
    if file.endswith('.pkl'):
        path = os.path.join(models_dir, file)
        try:
            with open(path, 'rb') as f:
                obj = pickle.load(f)
            print(f"{file}: {type(obj)}")
            if isinstance(obj, dict):
                print(f"  Keys: {list(obj.keys())[:5]}")  # first 5 keys
        except Exception as e:
            print(f"{file}: Error - {e}")