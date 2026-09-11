import os

files = [
    'src/pages/ReportAnalysisPatient.jsx',
    'src/pages/EcgAnalysis.jsx',
    'src/pages/CancerAnalysisPatient.jsx',
    'src/pages/analysis/LungCancerAnalysis.jsx',
    'src/pages/analysis/KidneyAnalysis.jsx',
    'src/pages/analysis/EcgAnalysis.jsx',
    'src/pages/analysis/BrainTumorAnalysis.jsx',
    'src/pages/analysis/BloodTestAnalysis.jsx'
]

for f in files:
    if not os.path.exists(f): continue
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    content = content.replace("import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';\n", "")
    content = content.replace("pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;", "pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;")
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print('PDF Worker CDN patch applied to all files.')
