import pickle
import io
import os

# Custom Unpickler to handle Keras compatibility
class BrainUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        # Handle namespace shifts if any
        if module == 'keras.src.layers.core.dense':
            return super().find_class('keras.layers', 'Dense')
        return super().find_class(module, name)

def fix_pickle(path):
    print(f"Reading {path}...")
    with open(path, 'rb') as f:
        # We need to monkey-patch Dense BEFORE loading if it's a direct pickle of the object
        import keras
        from keras import layers
        orig_init = layers.Dense.__init__
        def patched_init(self, *args, **kwargs):
            kwargs.pop('quantization_config', None)
            return orig_init(self, *args, **kwargs)
        layers.Dense.__init__ = patched_init
        
        try:
            model_obj = pickle.load(f)
            print("Successfully loaded model object!")
            
            # Save it back - this should save it WITHOUT the quantization_config if Keras 3 stripped it
            new_path = path.replace('.pkl', '_fixed.pkl')
            with open(new_path, 'wb') as f_out:
                pickle.dump(model_obj, f_out)
            print(f"Saved fixed model to {new_path}")
            
            # Replace original
            os.replace(new_path, path)
            print("Replaced original model.pkl with fixed version.")
            return True
        except Exception as e:
            print(f"Failed to fix: {e}")
            return False

if __name__ == "__main__":
    target = r"c:\Users\Tashu\OneDrive\Desktop\doctor-ai\modelsPred\model.pkl"
    if os.path.exists(target):
        fix_pickle(target)
    else:
        print(f"Target not found: {target}")
