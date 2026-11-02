# Training data

Public benchmark datasets used to train the screening models. They are included so
training is reproducible offline (`python -m backend.ml.train`).

| File | Dataset | Original source | Mirror used |
|---|---|---|---|
| `diabetes.csv` | Pima Indians Diabetes Database (NIDDK) | UCI ML Repository / Kaggle `uciml/pima-indians-diabetes-database` | `jbrownlee/Datasets` |
| `liver.csv` | Indian Liver Patient Dataset (ILPD) | UCI ML Repository, dataset 225 | `urgedata/pythondata` |
| `kidney.csv` | Chronic Kidney Disease | UCI ML Repository, dataset 336 | `authman/DAT210x` |
| `thyroid.csv` | Thyroid Disease, hypothyroid subset (Garvan Institute) | UCI ML Repository, dataset 102 | `pentaho/pentaho-data-mining` |

These are research benchmarks. Their populations and base rates differ from the general
population, so model metrics describe benchmark performance, not clinical validation.
