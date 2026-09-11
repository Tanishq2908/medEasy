import pickle
import io
import sys
import os

# Define the target model path
MODEL_PATH = r'c:\Users\Tashu\OneDrive\Desktop\doctor-ai\modelsPred\model.pkl'

# 1. Alias Keras Namespaces for current session
try:
    import keras
    sys.modules['keras.src'] = keras
    sys.modules['keras.src.models'] = keras.models
    sys.modules['keras.src.layers'] = keras.layers
    sys.modules['keras.src.saving'] = keras.saving
    sys.modules['keras.src.ops'] = keras.ops
except ImportError:
    print("[ERROR] Keras not installed.")
    sys.exit(1)

# 2. Universal Unpickler that maps ALL missing Keras/TF modules
class UniversalUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        # Map keras.src and tensorflow.keras.src to keras
        if 'keras.src' in module:
            module = module.replace('keras.src', 'keras')
        if 'tensorflow.keras.src' in module:
            module = module.replace('tensorflow.keras.src', 'keras')
        if 'tensorflow.python.keras' in module:
            module = module.replace('tensorflow.python.keras', 'keras')
            
        try:
            return super().find_class(module, name)
        except (ModuleNotFoundError, AttributeError):
            # Fallback for deep core shifts
            if 'keras' in module:
                try:
                    import keras
                    return getattr(keras, name)
                except: pass
            return super().find_class(module, name)

# 3. Test the unpickler
if __name__ == "__main__":
    if not os.path.exists(MODEL_PATH):
        print(f"[ERROR] Model file not found: {MODEL_PATH}")
        sys.exit(1)
        
    print(f"[INIT] Testing UniversalUnpickler on {MODEL_PATH}...")
    try:
        with open(MODEL_PATH, 'rb') as f:
            model = UniversalUnpickler(f).load()
        print(f"[SUCCESS] Model loaded: {type(model).__name__}")
        if hasattr(model, 'summary'):
            model.summary()
    except Exception as e:
        print(f"[FAIL] Could not load model: {e}")
        import traceback
        traceback.print_exc()
