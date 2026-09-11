# MedEz: Advanced Clinical AI Diagnostics Platform

**MedEz** is a premium, high-fidelity healthcare ecosystem designed for rapid medical image analysis, clinical reporting, and patient history retrieval through advanced RAG-integrated intelligence.

---

### 🛠️ Tech Stack Used

**Frontend & Logic**
- **Framework**: React.js 18 (Vite)
- **Styling**: Tailwind CSS 4.0 + Custom Glassmorphism UI + matte UI
- **Animations**: Framer Motion (High-performance biotech visuals)
- **Data Visualization**: Recharts (Longitudinal Recovery Projections & Vital Trends)

**Backend Architecture**
- **ML Engine**: Python Flask (Primary diagnostic inference server)
- **API Server**: Node.js / Express (Authentication & History Management)
- **Database**: MongoDB Atlas (Persistent Patient Clinical Records)

**AI Core & Specializations**
- **ECG Vision Layer**: MaxViT Transformer / Wavelet Signal Processing
- **Neuro/Pulm Models**: Xception (Brain MRI Tumor Classification) & EfficientNet-B0 (Lung CT)
- **Clinical Fallback**: Groq LLaMA 3.2 90B Vision (Offline-Resilient Intelligence)
- **RAG Chatbot (JARVIS)**: LLaMA 3.3 70B Orchestrated Retrieval-Augmented Generation

---

### 🌐 GitHub Repository Link
[https://github.com/Tanishqlegion/medEasy](https://github.com/Tanishqlegion/medEasy)

---

### 🚀 How to Run the Project

Follow these steps to initialize the core diagnostic array locally:

#### 1. Remote Initialization
```bash
git clone https://github.com/Tanishqlegion/medEasy.git
cd medEasy
```

#### 2. Dependency Management
Install frontend and background dependencies:
```bash
# Frontend
npm install

# Node Server
cd server
npm install
cd ..

# Python Backend
pip install flask flask-cors tensorflow torch opencv-python pillow groq requests
```

#### 3. Configuration
Create a `.env` in the root directory (and `server/` directory if needed):
```env
VITE_GROQ_API_KEY=your_groq_key_here
MONGODB_URI=your_mongodb_cluster_uri_here
JWT_SECRET=your_secret_key
```

#### 4. Execution Protocol
Launch the three core engines in separate terminals:

**Terminal A: Primary UI**
```bash
npm run dev
```

**Terminal B: Clinical Archive (Node)**
```bash
cd server
node index.js
```

**Terminal C: Neural Engine (Python)**
```bash
python app.py
```

---
*Developed for the Clinical Tech Hackathon 2026. All medical insights are AI-generated.*
