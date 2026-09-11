import re

for name, path in [('LUNG','modelsPred/lung_cancer_model (1).pkl'), ('BRAIN','modelsPred/model.pkl')]:
    print(f'=== {name} ===')
    with open(path,'rb') as f:
        data = f.read(8000)
    text = data.decode('latin-1', errors='replace')
    modules = set(re.findall(r'(?:keras|tensorflow|torch)[a-zA-Z0-9_.]{2,50}', text))
    for m in sorted(modules)[:25]:
        print(' ', m)
    print()
