import os

files = [
    'src/pages/analysis/KidneyAnalysis.jsx',
    'src/pages/analysis/LungCancerAnalysis.jsx',
    'src/pages/analysis/BrainTumorAnalysis.jsx',
    'src/pages/analysis/EcgAnalysis.jsx',
    'src/pages/analysis/BloodTestAnalysis.jsx'
]

for f in files:
    if not os.path.exists(f): continue
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Replace the strict PDF check with a robust one
    content = content.replace("if (report.fileType === 'application/pdf') {", "const isPdf = report?.fileType?.includes('pdf') || report?.fileName?.toLowerCase().endsWith('.pdf');\n      if (isPdf) {")
    
    # ensure it uses application/pdf correctly in drawing
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print('PDF Detection patch successfully applied to analysis pages.')
