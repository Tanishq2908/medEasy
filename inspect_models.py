import app

print("LUNG:")
obj1 = app.load_pkl_safe(app.LUNG_MODEL_PATH)
print("Type:", type(obj1))
if isinstance(obj1, dict):
    print("Keys:", obj1.keys())
else:
    print("Has .predict:", hasattr(obj1, 'predict'))

print("\nBRAIN:")
obj2 = app.load_pkl_safe(app.BRAIN_MODEL_PATH)
print("Type:", type(obj2))
if isinstance(obj2, dict):
    print("Keys:", obj2.keys())
else:
    print("Has .predict:", hasattr(obj2, 'predict'))
