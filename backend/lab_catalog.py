"""
Catalog of lab analytes recognised in reports.

Each entry gives:
  name, category, unit (canonical)  - what is displayed
  aliases                           - strings matched in report text
  ref                               - (low, high) reference interval, or {"M": (..), "F": (..)}
  critical                          - optional (low, high) values that need urgent attention
  normalize(value, alias)           - converts common alternative units to the canonical unit
  high / low                        - plain-language meaning + precautions when out of range

Reference intervals are typical adult values and differ between laboratories;
the interval printed on the report should always take precedence.
"""

from __future__ import annotations

from typing import Callable, Optional


def _scale_if(pred: Callable[[float], bool], factor: float) -> Callable[[float, str], float]:
    return lambda v, alias: v * factor if pred(v) else v


def _wbc(v: float, alias: str) -> float:
    # 7.8 (x10^3/uL) -> 7800 cells/uL
    return v * 1000 if v < 300 else v


def _platelets(v: float, alias: str) -> float:
    # canonical: x10^3/uL.  2.5 lakh -> 250;  250000 /uL -> 250
    if v > 5000:
        return v / 1000
    if v < 10:
        return v * 100
    return v


def _urea(v: float, alias: str) -> float:
    return v * 2.14 if "bun" in alias.lower() or "nitrogen" in alias.lower() else v


ANALYTES: dict[str, dict] = {
    # ── Complete blood count ────────────────────────────────
    "hemoglobin": {
        "name": "Hemoglobin", "category": "Blood Count", "unit": "g/dL",
        "aliases": ["haemoglobin", "hemoglobin", "hgb", "hb"],
        "ref": {"M": (13.0, 17.0), "F": (12.0, 15.5)}, "critical": (7.0, 20.0),
        "normalize": _scale_if(lambda v: v > 30, 0.1),  # g/L -> g/dL
        "low": ("Low hemoglobin suggests anaemia, which reduces oxygen delivery and can cause fatigue and breathlessness.",
                ["Eat iron-rich foods (leafy greens, legumes, lean red meat) with vitamin C to improve absorption.",
                 "Ask your doctor about iron studies, B12 and folate tests to find the cause.",
                 "Avoid tea or coffee within an hour of iron-rich meals."]),
        "high": ("High hemoglobin can reflect dehydration, smoking, living at altitude or, rarely, a bone-marrow disorder.",
                 ["Stay well hydrated and repeat the test.",
                  "Stop smoking if applicable.",
                  "Discuss with a doctor if it stays high."]),
    },
    "hematocrit": {
        "name": "Hematocrit (PCV)", "category": "Blood Count", "unit": "%",
        "aliases": ["hematocrit", "haematocrit", "packed cell volume", "pcv", "hct"],
        "ref": {"M": (40.0, 50.0), "F": (36.0, 46.0)},
        "normalize": _scale_if(lambda v: v < 1, 100),
        "low": ("Low PCV usually accompanies anaemia.", ["Discuss iron, B12 and folate testing with your doctor."]),
        "high": ("High PCV is often due to dehydration.", ["Increase fluid intake and recheck."]),
    },
    "rbc": {
        "name": "RBC Count", "category": "Blood Count", "unit": "million/µL",
        "aliases": ["total rbc count", "rbc count", "red blood cell count", "red blood cells", "rbc", "erythrocytes"],
        "ref": {"M": (4.5, 5.9), "F": (4.0, 5.2)},
        "normalize": _scale_if(lambda v: v > 1000, 1e-6),
        "low": ("A low red-cell count is consistent with anaemia or blood loss.", ["Discuss iron, B12 and folate testing with your doctor."]),
        "high": ("A high red-cell count may reflect dehydration or low oxygen levels.", ["Hydrate well and recheck."]),
    },
    "wbc": {
        "name": "WBC Count", "category": "Blood Count", "unit": "cells/µL",
        "aliases": ["total leucocyte count", "total leukocyte count", "total wbc count", "wbc count",
                    "white blood cell count", "white blood cells", "tlc", "wbc"],
        "ref": (4000, 11000), "critical": (2000, 30000), "normalize": _wbc,
        "low": ("A low white-cell count reduces resistance to infection.",
                ["Practise good hand hygiene and avoid sick contacts.", "Ask your doctor whether a repeat count or differential is needed."]),
        "high": ("A raised white-cell count usually signals infection or inflammation.",
                 ["Watch for fever or other signs of infection.", "Consult a doctor if you feel unwell or it stays high."]),
    },
    "platelets": {
        "name": "Platelet Count", "category": "Blood Count", "unit": "×10³/µL",
        "aliases": ["platelet count", "platelets", "plt"],
        "ref": (150, 450), "critical": (50, 1000), "normalize": _platelets,
        "low": ("Low platelets increase bleeding and bruising risk.",
                ["Avoid aspirin/NSAIDs unless prescribed.", "Avoid contact sports; report unusual bruising or bleeding."]),
        "high": ("High platelets can follow infection, inflammation or iron deficiency.", ["Recheck after any acute illness has settled."]),
    },
    "mcv": {
        "name": "MCV", "category": "Blood Count", "unit": "fL",
        "aliases": ["mean corpuscular volume", "mcv"], "ref": (80, 100),
        "low": ("Small red cells point toward iron deficiency or thalassaemia trait.", ["Ask about iron studies."]),
        "high": ("Large red cells can reflect B12/folate deficiency, alcohol or thyroid issues.", ["Ask about B12 and folate levels; limit alcohol."]),
    },
    "mch": {
        "name": "MCH", "category": "Blood Count", "unit": "pg",
        "aliases": ["mean corpuscular hemoglobin", "mean corpuscular haemoglobin", "mch"], "ref": (27, 33),
        "low": ("Low MCH usually accompanies iron deficiency.", ["Include iron-rich foods."]),
        "high": ("High MCH usually accompanies large red cells.", ["Check B12 and folate."]),
    },
    "mchc": {
        "name": "MCHC", "category": "Blood Count", "unit": "g/dL",
        "aliases": ["mchc"], "ref": (32, 36),
        "low": ("Low MCHC is seen in iron deficiency.", ["Include iron-rich foods."]),
        "high": ("High MCHC is uncommon and may be a sample artefact.", ["Recheck if persistent."]),
    },
    "rdw": {
        "name": "RDW", "category": "Blood Count", "unit": "%",
        "aliases": ["rdw-cv", "rdw"], "ref": (11.5, 14.5),
        "low": ("Low RDW is not clinically significant.", []),
        "high": ("High RDW means red cells vary in size, common in early nutritional deficiency.", ["Check iron, B12 and folate."]),
    },
    "neutrophils": {
        "name": "Neutrophils", "category": "Blood Count", "unit": "%",
        "aliases": ["neutrophils", "polymorphs", "neutrophil"], "ref": (40, 75),
        "low": ("Low neutrophils reduce defence against bacterial infection.", ["Practise good hygiene; consult a doctor if you have fever."]),
        "high": ("High neutrophils usually indicate bacterial infection or stress.", ["Monitor for infection symptoms."]),
    },
    "lymphocytes": {
        "name": "Lymphocytes", "category": "Blood Count", "unit": "%",
        "aliases": ["lymphocytes", "lymphocyte"], "ref": (20, 45),
        "low": ("Low lymphocytes can follow viral illness or stress.", ["Recheck after recovery."]),
        "high": ("High lymphocytes are common during viral infections.", ["Recheck after recovery."]),
    },

    # ── Diabetes / glucose ──────────────────────────────────
    "glucose": {
        "name": "Blood Glucose", "category": "Diabetes", "unit": "mg/dL",
        "aliases": ["fasting blood sugar", "fasting plasma glucose", "fasting glucose", "glucose fasting",
                    "blood sugar fasting", "random blood sugar", "random glucose", "blood glucose",
                    "plasma glucose", "glucose", "fbs", "rbs"],
        "ref": (70, 100), "critical": (50, 400),
        "normalize": _scale_if(lambda v: v < 35, 18.0),  # mmol/L -> mg/dL
        "low": ("Low blood sugar can cause shakiness, sweating and confusion.",
                ["Eat regular meals; carry a fast-acting sugar source.", "Discuss with a doctor, especially if on diabetes medication."]),
        "high": ("Raised glucose indicates prediabetes or diabetes (fasting 100–125 mg/dL = prediabetes, ≥126 = diabetes).",
                 ["Cut down on refined carbohydrates and sugary drinks.",
                  "Aim for 150 minutes of brisk activity per week.",
                  "Get an HbA1c test to confirm, and see a doctor."]),
    },
    "hba1c": {
        "name": "HbA1c", "category": "Diabetes", "unit": "%",
        "aliases": ["glycated haemoglobin", "glycated hemoglobin", "glycosylated hemoglobin", "hba1c", "a1c"],
        "ref": (4.0, 5.6), "critical": (None, 10.0),
        "low": ("Low HbA1c is rarely significant.", []),
        "high": ("HbA1c reflects 3-month average sugar: 5.7–6.4% is prediabetes, ≥6.5% is diabetes.",
                 ["Follow a low-glycaemic diet rich in fibre and vegetables.",
                  "Exercise regularly and aim for healthy weight loss if overweight.",
                  "See a doctor for a diabetes management plan and recheck in 3 months."]),
    },
    "insulin": {
        "name": "Insulin (Fasting)", "category": "Diabetes", "unit": "µU/mL",
        "aliases": ["fasting insulin", "insulin"], "ref": (2, 25),
        "low": ("Low insulin can occur with fasting or reduced pancreatic output.", ["Discuss with your doctor alongside glucose results."]),
        "high": ("High fasting insulin suggests insulin resistance.", ["Reduce refined carbs, increase activity, and manage weight."]),
    },

    # ── Lipid profile ───────────────────────────────────────
    "total_cholesterol": {
        "name": "Total Cholesterol", "category": "Lipid Profile", "unit": "mg/dL",
        "aliases": ["total cholesterol", "cholesterol total", "serum cholesterol", "cholesterol"],
        "ref": (0, 200), "normalize": _scale_if(lambda v: v < 20, 38.67),
        "low": ("Very low cholesterol is uncommon.", []),
        "high": ("High total cholesterol raises cardiovascular risk.",
                 ["Limit saturated and trans fats (fried food, butter, processed meat).",
                  "Add soluble fibre: oats, beans, fruit.", "Exercise at least 30 minutes most days."]),
    },
    "ldl": {
        "name": "LDL Cholesterol", "category": "Lipid Profile", "unit": "mg/dL",
        "aliases": ["ldl cholesterol", "ldl-cholesterol", "ldl-c", "ldl direct", "ldl"],
        "ref": (0, 100), "critical": (None, 190), "normalize": _scale_if(lambda v: v < 15, 38.67),
        "low": ("Low LDL is generally favourable.", []),
        "high": ("High LDL ('bad' cholesterol) builds plaque in arteries.",
                 ["Reduce saturated fat; choose olive oil, nuts and fish.",
                  "Increase fibre and plant sterols.", "Discuss statin therapy with a doctor if very high or you have other risk factors."]),
    },
    "hdl": {
        "name": "HDL Cholesterol", "category": "Lipid Profile", "unit": "mg/dL",
        "aliases": ["hdl cholesterol", "hdl-cholesterol", "hdl-c", "hdl direct", "hdl"],
        "ref": {"M": (40, 100), "F": (50, 100)}, "normalize": _scale_if(lambda v: v < 5, 38.67),
        "low": ("Low HDL ('good' cholesterol) increases heart risk.",
                ["Exercise regularly; aerobic activity raises HDL.", "Stop smoking; include healthy fats like nuts and fish."]),
        "high": ("High HDL is generally protective.", []),
    },
    "triglycerides": {
        "name": "Triglycerides", "category": "Lipid Profile", "unit": "mg/dL",
        "aliases": ["triglycerides", "triglyceride", "tg"],
        "ref": (0, 150), "critical": (None, 500), "normalize": _scale_if(lambda v: v < 15, 88.57),
        "low": ("Low triglycerides are not a concern.", []),
        "high": ("High triglycerides are linked to heart disease and, if very high, pancreatitis.",
                 ["Cut sugar, sweets and refined carbs.", "Limit alcohol.", "Add omega-3 rich foods like fish and flaxseed."]),
    },
    "vldl": {
        "name": "VLDL Cholesterol", "category": "Lipid Profile", "unit": "mg/dL",
        "aliases": ["vldl cholesterol", "vldl"], "ref": (5, 40),
        "low": ("", []), "high": ("High VLDL tracks high triglycerides.", ["Follow the triglyceride guidance."]),
    },

    # ── Liver function ──────────────────────────────────────
    "total_bilirubin": {
        "name": "Total Bilirubin", "category": "Liver Function", "unit": "mg/dL",
        "aliases": ["bilirubin total", "total bilirubin", "serum bilirubin", "bilirubin (total)", "t. bilirubin", "bilirubin"],
        "ref": (0.2, 1.2), "critical": (None, 12),
        "normalize": _scale_if(lambda v: v > 30, 1 / 17.1),  # µmol/L
        "low": ("Low bilirubin is not significant.", []),
        "high": ("Raised bilirubin can cause jaundice and points to liver, bile-duct or red-cell breakdown problems.",
                 ["Avoid alcohol completely until reviewed.", "See a doctor, especially if skin or eyes look yellow."]),
    },
    "direct_bilirubin": {
        "name": "Direct Bilirubin", "category": "Liver Function", "unit": "mg/dL",
        "aliases": ["bilirubin direct", "direct bilirubin", "conjugated bilirubin", "d. bilirubin"],
        "ref": (0.0, 0.3), "normalize": _scale_if(lambda v: v > 20, 1 / 17.1),
        "low": ("", []),
        "high": ("High direct bilirubin suggests impaired bile flow from the liver.", ["Consult a doctor for liver evaluation."]),
    },
    "alt": {
        "name": "ALT (SGPT)", "category": "Liver Function", "unit": "U/L",
        "aliases": ["alanine aminotransferase", "alanine transaminase", "sgpt", "alt"],
        "ref": (7, 56), "critical": (None, 1000),
        "low": ("Low ALT is not significant.", []),
        "high": ("Raised ALT indicates liver cell stress, e.g. fatty liver, alcohol, medication or hepatitis.",
                 ["Avoid alcohol and unnecessary medicines/supplements.", "Lose weight gradually if overweight.",
                  "Ask your doctor about hepatitis screening and a liver ultrasound."]),
    },
    "ast": {
        "name": "AST (SGOT)", "category": "Liver Function", "unit": "U/L",
        "aliases": ["aspartate aminotransferase", "aspartate transaminase", "sgot", "ast"],
        "ref": (10, 40), "critical": (None, 1000),
        "low": ("Low AST is not significant.", []),
        "high": ("Raised AST can come from the liver or muscles.",
                 ["Avoid alcohol and strenuous exercise before retesting.", "Discuss with a doctor."]),
    },
    "alp": {
        "name": "Alkaline Phosphatase", "category": "Liver Function", "unit": "U/L",
        "aliases": ["alkaline phosphatase", "alk. phosphatase", "alk phos", "alp"],
        "ref": (44, 147),
        "low": ("Low ALP can be seen with zinc or magnesium deficiency.", []),
        "high": ("High ALP can indicate bile-duct or bone disorders.", ["Discuss further liver or bone tests with a doctor."]),
    },
    "ggt": {
        "name": "GGT", "category": "Liver Function", "unit": "U/L",
        "aliases": ["gamma glutamyl transferase", "gamma gt", "ggt", "ggtp"], "ref": (0, 55),
        "low": ("", []),
        "high": ("High GGT is a sensitive marker of alcohol use and bile-duct problems.", ["Avoid alcohol; recheck in 4–6 weeks."]),
    },
    "total_protein": {
        "name": "Total Protein", "category": "Liver Function", "unit": "g/dL",
        "aliases": ["total protein", "serum protein", "protein total", "total proteins"],
        "ref": (6.0, 8.3), "normalize": _scale_if(lambda v: v > 20, 0.1),
        "low": ("Low protein can reflect poor nutrition, liver or kidney disease.", ["Ensure adequate dietary protein; discuss with a doctor."]),
        "high": ("High protein may reflect dehydration or chronic inflammation.", ["Hydrate well and recheck."]),
    },
    "albumin": {
        "name": "Albumin", "category": "Liver Function", "unit": "g/dL",
        "aliases": ["serum albumin", "albumin"], "ref": (3.5, 5.0),
        "normalize": _scale_if(lambda v: v > 10, 0.1),
        "low": ("Low albumin can reflect liver disease, kidney protein loss or malnutrition.", ["Eat adequate protein; discuss with a doctor."]),
        "high": ("High albumin is usually due to dehydration.", ["Increase fluid intake."]),
    },
    "ag_ratio": {
        "name": "A/G Ratio", "category": "Liver Function", "unit": "",
        "aliases": ["a/g ratio", "albumin/globulin ratio", "albumin globulin ratio", "a:g ratio"],
        "ref": (1.0, 2.2),
        "low": ("A low A/G ratio may indicate liver disease or chronic inflammation.", ["Discuss with a doctor."]),
        "high": ("", []),
    },

    # ── Kidney function / electrolytes ──────────────────────
    "creatinine": {
        "name": "Creatinine", "category": "Kidney Function", "unit": "mg/dL",
        "aliases": ["serum creatinine", "creatinine"],
        "ref": {"M": (0.7, 1.3), "F": (0.5, 1.1)}, "critical": (None, 5.0),
        "normalize": _scale_if(lambda v: v > 20, 1 / 88.4),  # µmol/L
        "low": ("Low creatinine often reflects low muscle mass.", []),
        "high": ("Raised creatinine means the kidneys are filtering less effectively.",
                 ["Stay hydrated; avoid NSAID painkillers (ibuprofen etc.).",
                  "Limit salt and very high-protein diets.", "Control blood pressure and sugar; see a doctor for eGFR follow-up."]),
    },
    "urea": {
        "name": "Blood Urea", "category": "Kidney Function", "unit": "mg/dL",
        "aliases": ["blood urea nitrogen", "blood urea", "serum urea", "urea", "bun"],
        "ref": (15, 45), "critical": (None, 200), "normalize": _urea,
        "low": ("Low urea can follow low protein intake or liver issues.", []),
        "high": ("High urea suggests reduced kidney function or dehydration.", ["Drink enough water and recheck; consult a doctor."]),
    },
    "uric_acid": {
        "name": "Uric Acid", "category": "Kidney Function", "unit": "mg/dL",
        "aliases": ["serum uric acid", "uric acid"], "ref": {"M": (3.4, 7.0), "F": (2.4, 6.0)},
        "normalize": _scale_if(lambda v: v > 30, 1 / 59.48),
        "low": ("", []),
        "high": ("High uric acid can cause gout and kidney stones.",
                 ["Limit red meat, organ meat, shellfish, beer and sugary drinks.", "Drink plenty of water."]),
    },
    "egfr": {
        "name": "eGFR", "category": "Kidney Function", "unit": "mL/min/1.73m²",
        "aliases": ["egfr", "estimated gfr"], "ref": (90, 200), "critical": (15, None),
        "low": ("Reduced eGFR indicates lower kidney filtration (below 60 for 3 months = chronic kidney disease).",
                ["Avoid NSAIDs; keep blood pressure and sugar under control.", "See a nephrologist if below 60."]),
        "high": ("", []),
    },
    "sodium": {
        "name": "Sodium", "category": "Electrolytes", "unit": "mmol/L",
        "aliases": ["serum sodium", "sodium", "na+"], "ref": (135, 145), "critical": (120, 160),
        "low": ("Low sodium can cause headache, confusion and weakness.", ["Avoid drinking excessive water; consult a doctor."]),
        "high": ("High sodium usually reflects dehydration.", ["Increase water intake."]),
    },
    "potassium": {
        "name": "Potassium", "category": "Electrolytes", "unit": "mmol/L",
        "aliases": ["serum potassium", "potassium", "k+"], "ref": (3.5, 5.1), "critical": (2.8, 6.2),
        "low": ("Low potassium can cause cramps and heart rhythm problems.", ["Eat bananas, oranges, potatoes; consult a doctor."]),
        "high": ("High potassium can affect heart rhythm.", ["Avoid potassium supplements and salt substitutes; seek prompt medical review."]),
    },
    "chloride": {
        "name": "Chloride", "category": "Electrolytes", "unit": "mmol/L",
        "aliases": ["serum chloride", "chloride", "cl-"], "ref": (98, 107),
        "low": ("", ["Discuss with a doctor alongside sodium."]), "high": ("", ["Discuss with a doctor alongside sodium."]),
    },
    "calcium": {
        "name": "Calcium", "category": "Electrolytes", "unit": "mg/dL",
        "aliases": ["serum calcium", "total calcium", "calcium"], "ref": (8.6, 10.3), "critical": (6.5, 13.0),
        "normalize": _scale_if(lambda v: v < 4, 4.008),
        "low": ("Low calcium can cause tingling and cramps.", ["Include dairy or fortified foods; check vitamin D."]),
        "high": ("High calcium needs evaluation (parathyroid, vitamin D excess).", ["Avoid calcium/vitamin D supplements until reviewed."]),
    },
    "urine_sg": {
        "name": "Urine Specific Gravity", "category": "Urinalysis", "unit": "",
        "aliases": ["specific gravity", "sp. gravity", "sp gravity"], "ref": (1.005, 1.030),
        "low": ("Dilute urine; can be normal with high fluid intake.", []),
        "high": ("Concentrated urine often means dehydration.", ["Drink more water."]),
    },
    "urine_albumin": {
        "name": "Urine Albumin (dipstick 0–5)", "category": "Urinalysis", "unit": "grade",
        "aliases": ["urine albumin", "urine protein", "albumin (urine)", "proteinuria"], "ref": (0, 0),
        "low": ("", []),
        "high": ("Protein in urine can be an early sign of kidney damage.",
                 ["Control blood pressure and blood sugar.", "Ask your doctor for a urine albumin-creatinine ratio test."]),
    },

    # ── Thyroid ─────────────────────────────────────────────
    "tsh": {
        "name": "TSH", "category": "Thyroid", "unit": "mIU/L",
        "aliases": ["thyroid stimulating hormone", "tsh ultrasensitive", "tsh"], "ref": (0.4, 4.5), "critical": (0.01, 50),
        "low": ("Low TSH suggests an overactive thyroid (hyperthyroidism).",
                ["Watch for palpitations, weight loss and tremor.", "See a doctor for free T4/T3 testing."]),
        "high": ("High TSH suggests an underactive thyroid (hypothyroidism).",
                 ["Watch for fatigue, weight gain and feeling cold.", "Ensure adequate iodine (iodised salt).",
                  "See a doctor; thyroid hormone replacement may be needed."]),
    },
    "t3": {
        "name": "Total T3", "category": "Thyroid", "unit": "nmol/L",
        "aliases": ["triiodothyronine total", "total t3", "t3 total", "triiodothyronine", "t3"],
        "ref": (1.2, 2.8), "normalize": _scale_if(lambda v: v > 15, 0.01536),  # ng/dL -> nmol/L
        "low": ("Low T3 can accompany hypothyroidism or illness.", ["Interpret together with TSH."]),
        "high": ("High T3 suggests hyperthyroidism.", ["Interpret together with TSH; consult a doctor."]),
    },
    "t4": {
        "name": "Total T4", "category": "Thyroid", "unit": "nmol/L",
        "aliases": ["thyroxine total", "total t4", "t4 total", "thyroxine", "t4"],
        "ref": (60, 150), "normalize": _scale_if(lambda v: v < 30, 12.87),  # µg/dL -> nmol/L
        "low": ("Low T4 supports hypothyroidism.", ["Interpret together with TSH; consult a doctor."]),
        "high": ("High T4 supports hyperthyroidism.", ["Interpret together with TSH; consult a doctor."]),
    },
    "ft4": {
        "name": "Free T4", "category": "Thyroid", "unit": "ng/dL",
        "aliases": ["free thyroxine", "free t4", "ft4"], "ref": (0.8, 1.8),
        "normalize": _scale_if(lambda v: v > 5, 1 / 12.87),  # pmol/L
        "low": ("Low free T4 supports hypothyroidism.", ["Consult a doctor."]),
        "high": ("High free T4 supports hyperthyroidism.", ["Consult a doctor."]),
    },

    # ── Vitamins / iron ─────────────────────────────────────
    "vitamin_d": {
        "name": "Vitamin D (25-OH)", "category": "Vitamins & Iron", "unit": "ng/mL",
        "aliases": ["25-hydroxy vitamin d", "25 hydroxy vitamin d", "25-oh vitamin d", "vitamin d3", "vitamin d", "vit d"],
        "ref": (30, 100),
        "low": ("Low vitamin D affects bone strength, muscles and immunity.",
                ["Get 15–20 minutes of midday sunlight a few times a week.", "Eat oily fish, eggs, fortified milk.",
                 "Ask your doctor about a vitamin D supplement."]),
        "high": ("Very high vitamin D usually results from over-supplementation.", ["Pause supplements and consult a doctor."]),
    },
    "vitamin_b12": {
        "name": "Vitamin B12", "category": "Vitamins & Iron", "unit": "pg/mL",
        "aliases": ["vitamin b12", "vit b12", "cobalamin", "b12"], "ref": (200, 900),
        "low": ("Low B12 can cause anaemia, tingling and memory problems.",
                ["Eat eggs, dairy, fish or meat; vegetarians may need fortified foods or supplements.", "Discuss supplementation with a doctor."]),
        "high": ("High B12 is usually from supplements.", []),
    },
    "ferritin": {
        "name": "Ferritin", "category": "Vitamins & Iron", "unit": "ng/mL",
        "aliases": ["serum ferritin", "ferritin"], "ref": {"M": (30, 400), "F": (15, 150)},
        "low": ("Low ferritin means iron stores are depleted.", ["Increase dietary iron; ask about iron supplements."]),
        "high": ("High ferritin can reflect inflammation, liver disease or iron overload.", ["Avoid iron supplements; consult a doctor."]),
    },
    "iron": {
        "name": "Serum Iron", "category": "Vitamins & Iron", "unit": "µg/dL",
        "aliases": ["serum iron", "iron"], "ref": (60, 170),
        "low": ("Low serum iron suggests iron deficiency.", ["Increase dietary iron."]),
        "high": ("High serum iron can follow supplements or iron overload.", ["Consult a doctor."]),
    },

    # ── Inflammation ────────────────────────────────────────
    "crp": {
        "name": "C-Reactive Protein", "category": "Inflammation", "unit": "mg/L",
        "aliases": ["c-reactive protein", "c reactive protein", "hs-crp", "crp"], "ref": (0, 5),
        "low": ("", []),
        "high": ("Raised CRP indicates inflammation or infection somewhere in the body.", ["Consult a doctor to find the cause."]),
    },
    "esr": {
        "name": "ESR", "category": "Inflammation", "unit": "mm/hr",
        "aliases": ["erythrocyte sedimentation rate", "esr"], "ref": {"M": (0, 15), "F": (0, 20)},
        "low": ("", []),
        "high": ("High ESR is a non-specific sign of inflammation.", ["Discuss with a doctor if persistently raised."]),
    },
}

CATEGORY_ORDER = ["Blood Count", "Diabetes", "Lipid Profile", "Liver Function", "Kidney Function",
                  "Electrolytes", "Urinalysis", "Thyroid", "Vitamins & Iron", "Inflammation"]


def ref_range(key: str, sex: Optional[str]) -> tuple[Optional[float], Optional[float]]:
    ref = ANALYTES[key]["ref"]
    if isinstance(ref, dict):
        s = (sex or "").upper()[:1]
        if s in ref:
            return ref[s]
        # sex unknown: use the widest interval so nothing is flagged on a guess
        return min(ref["M"][0], ref["F"][0]), max(ref["M"][1], ref["F"][1])
    return ref


def normalize(key: str, value: float, alias: str = "") -> float:
    fn = ANALYTES[key].get("normalize")
    return float(fn(value, alias)) if fn else float(value)
