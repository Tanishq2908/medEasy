import json, sys

def parse_nb(path, name):
    print(f"\n{'='*60}")
    print(f"  {name}")
    print('='*60)
    with open(path, encoding='utf-8') as f:
        nb = json.load(f)
    keywords = ['class_names','class_indices','classes','label','predict','preprocess',
                'ImageDataGenerator','model.compile','categorical','rescale','target_size',
                'pickle','save','joblib','Dense','Conv2D','flow_from']
    for i, cell in enumerate(nb['cells']):
        src = ''.join(cell['source'])
        if any(k in src for k in keywords):
            print(f"\n--- Cell {i} ---")
            print(src[:2000])

parse_nb(r"ipynb files/CT_Scan (3).ipynb", "CT SCAN / LUNG")
parse_nb(r"ipynb files/Kidney_classification_and_detection_of_kidney_stones.ipynb", "KIDNEY")
parse_nb(r"ipynb files/brain_tumor_image_classifier_updated (1) (1).ipynb", "BRAIN TUMOR")
