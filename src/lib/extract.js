import { api, ApiError } from '../api';

// Text extraction. The server handles text PDFs (and photos when GROQ_API_KEY is set).
// Scanned PDFs and photos otherwise fall back to OCR in the browser with Tesseract.js.
export async function extractText(file, onStep = () => {}) {
  onStep('Reading your file…');
  const form = new FormData();
  form.append('file', file);
  try {
    return await api('/api/extract', { method: 'POST', form });
  } catch (e) {
    if (!(e instanceof ApiError) || !e.data?.needs_ocr) throw e;
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const images = isPdf ? await renderPdf(file, onStep) : [file];
  const { default: Tesseract } = await import('tesseract.js');
  const parts = [];
  for (let i = 0; i < images.length; i += 1) {
    onStep(`Recognising text${images.length > 1 ? ` (page ${i + 1} of ${images.length})` : ''}…`);
    const { data } = await Tesseract.recognize(images[i], 'eng');
    parts.push(data.text);
  }
  const text = parts.join('\n');
  if (text.trim().length < 20) throw new Error('Could not read any text from this file. Try a clearer photo, or type the values in.');
  return { text, method: 'browser-ocr', patient: {} };
}

async function renderPdf(file, onStep) {
  onStep('Rendering scanned PDF…');
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 5); n += 1) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    out.push(canvas);
  }
  return out;
}
