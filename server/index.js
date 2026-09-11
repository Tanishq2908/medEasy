const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '.env') });

const CITIES = ['Delhi', 'Mumbai', 'Gwalior', 'Kota'];

// ─── USER SCHEMA ───
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    city: { type: String, enum: [...CITIES, ''], default: '' },
    password: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor', 'lab'], default: 'patient' },
    createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
});

const User = mongoose.model('User', UserSchema);

// ─── ZOD SCHEMAS ───
const RegisterSchema = z.object({
    name: z.string().min(2, "Name is too short"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be 6+ characters"),
    role: z.enum(['patient', 'doctor', 'lab']),
    city: z.string().optional()
});

const LoginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required")
});

// ─── APPOINTMENT SCHEMA ───
const AppointmentSchema = new mongoose.Schema({
    // Patient
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    patientName: { type: String, required: true },
    patientEmail: { type: String, required: true },
    // Lab
    labId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    labName: { type: String, required: true },
    city: { type: String, required: true },
    // Appointment details  
    test: { type: String, required: true },
    date: { type: String, required: true },
    slot: { type: String, required: true },
    bid: { type: String, required: true, unique: true },
    // Status
    status: { type: String, enum: ['pending', 'uploaded', 'cancelled'], default: 'pending' },
    reportFile: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});
const Appointment = mongoose.model('Appointment', AppointmentSchema);

// ─── PATIENT DIAGNOSIS SCHEMA (Detailed Health Report) ───
const PatientDiagnosisSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // report, ecg, ct, mri
    title: { type: String, required: true },
    fileName: String,
    summary: String,
    // Detailed clinical markers
    parameters: [{
        name: String,
        value: String,
        status: String, // Normal, Abnormal, Critical
        interpretation: String
    }],
    // Risk assessments
    riskAssessment: {
        cardiovascular: { level: String, reason: String },
        metabolic: { level: String, reason: String },
        organHealth: { level: String, reason: String }
    },
    // Lifestyle directives
    medications: [{ name: String, dosage: String, frequency: String, purpose: String }],
    diet: [{ recommendation: String, reason: String, category: String }],
    exercise: [{ activity: String, duration: String, frequency: String, intensity: String }],
    routine: [{ time: String, activity: String, importance: String }],
    threats: [{ level: String, condition: String, description: String, urgency: String }],
    // Cancer-specific data
    cancerData: {
        cancerDetected: Boolean,
        cancerType: String,
        primarySite: String,
        stage: String, // Stage 0, I, II, III, IV
        grade: String, // G1-G4 or Well/Moderately/Poorly differentiated
        tnm: {
            t: String, // T0-T4, TX
            n: String, // N0-N3, NX
            m: String  // M0-M1, MX
        },
        tumorSize: Number, // in cm
        tumorLocation: String,
        tumorFeatures: [String],
        biomarkers: [{ name: String, value: String, significance: String }],
        geneticMutations: [{ gene: String, mutation: String, therapy: String }],
        metastasisSites: [String],
        followUp: {
            recommendedTests: [String],
            specialistReferral: String,
            timeline: String,
            additionalWorkup: [String]
        }
    },
    // Overall
    overallScore: Number, // 0-100 health score
    date: { type: Date, default: Date.now }
});

const PatientDiagnosis = mongoose.model('PatientDiagnosis', PatientDiagnosisSchema);

// ─── DOCTOR DIAGNOSIS SCHEMA (Clinical Threat Assessment) ───
const DoctorDiagnosisSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    fileName: String,
    // Patient demographics
    patientName: { type: String, required: true },
    patientAge: { type: Number, required: true },
    patientSex: { type: String, required: true },
    // Clinical summary
    summary: String,
    // Clinical markers
    parameters: [{
        name: String,
        value: String,
        status: String,
        interpretation: String
    }],
    // Threat alerts
    threats: [{
        severity: String, // CRITICAL, HIGH, MODERATE, LOW
        condition: String,
        description: String,
        immediateAction: String,
        color: String // red, orange, yellow, green
    }],
    // Clinical verdict
    verdict: String, // STABLE, MONITORING, CRITICAL, EMERGENCY
    verdictReason: String,
    date: { type: Date, default: Date.now }
});

const DoctorDiagnosis = mongoose.model('DoctorDiagnosis', DoctorDiagnosisSchema);

// ─── LAB REPORT SCHEMA ───
const LabReportSchema = new mongoose.Schema({
    labUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    labName: { type: String, required: true },
    patientEmail: { type: String, required: true, lowercase: true, trim: true },
    patientName: { type: String },
    testType: { type: String, required: true },
    reportTitle: { type: String, required: true },
    notes: { type: String },
    fileBase64: { type: String },
    fileType: { type: String },
    fileName: { type: String },
    aiAnalysis: { type: Object, default: null },
    analysisDate: { type: Date },
    status: { type: String, enum: ['pending', 'viewed', 'analysed'], default: 'pending' },
    uploadedAt: { type: Date, default: Date.now }
});
const LabReport = mongoose.model('LabReport', LabReportSchema);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Connection
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Connected to MongoDB Atlas.');
    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err.message);
    }
};

connectDB();

app.get('/health', (req, res) => res.json({ status: 'Online', cities: CITIES }));

// ─── AUTH ───
app.post('/api/auth/register', async (req, res) => {
    console.log("📥 Registration request received:", req.body);
    
    // 1. Zod Validation
    if (!req.body) return res.status(400).json({ msg: "Request body is missing." });
    
    // Check if lab registration needs city validation
    if (req.body.role === 'lab' && !req.body.city) {
        return res.status(400).json({ errors: { city: "City is required for lab registration" } });
    }

    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
        const errors = {};
        result.error.issues.forEach(issue => {
            errors[issue.path[0]] = issue.message;
        });
        return res.status(400).json({ errors });
    }

    const { name, email, password, role, city } = result.data;
    try {
        console.log("🔍 Checking for existing user...");
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Account already exists.' });
        
        user = new User({ name, email, password, role, city: city || '' });
        await user.save();
        console.log("✅ Registered:", email, role, city || '');

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, city: user.city } });
    } catch (err) {
        console.error("❌ Registration Error:", err.message);
        res.status(500).json({ msg: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    console.log("📥 Login request received:", req.body);
    
    // 1. Zod Validation
    if (!req.body) return res.status(400).json({ msg: "Request body is missing." });

    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
        const errors = {};
        result.error.issues.forEach(issue => {
            errors[issue.path[0]] = issue.message;
        });
        return res.status(400).json({ errors });
    }

    const { email, password } = result.data;
    try {
        console.log("🔍 Checking user credentials...");
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Account not found.' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Incorrect password.' });
        
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, city: user.city } });
    } catch (err) {
        console.error("❌ Login Error:", err.message);
        res.status(500).json({ msg: err.message });
    }
});

// ─── AUTH MIDDLEWARE ───
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'No token provided.' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token invalid.' });
    }
};

// ─── CITY / LAB ENDPOINTS ───
app.get('/api/cities', (req, res) => res.json(CITIES));

app.get('/api/labs/by-city/:city', async (req, res) => {
    try {
        const city = req.params.city;
        if (!CITIES.includes(city)) return res.status(400).json({ msg: 'Invalid city.' });
        const labs = await User.find({ role: 'lab', city })
            .select('_id name email city')
            .sort({ name: 1 });
        res.json(labs);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// ─── APPOINTMENT ENDPOINTS ───
app.post('/api/appointments/book', auth, async (req, res) => {
    try {
        const patientUser = await User.findById(req.user.id);
        const { labId, test, date, slot, bid } = req.body;

        if (!labId || !test || !date || !slot || !bid) {
            return res.status(400).json({ msg: 'All appointment fields are required.' });
        }

        const labUser = await User.findById(labId);
        if (!labUser || labUser.role !== 'lab') return res.status(400).json({ msg: 'Lab not found.' });

        const existing = await Appointment.findOne({ bid });
        if (existing) return res.status(400).json({ msg: 'Booking ID conflict. Please try again.' });

        const appointment = new Appointment({
            patientId: req.user.id,
            patientName: patientUser.name,
            patientEmail: patientUser.email,
            labId: labUser._id,
            labName: labUser.name,
            city: labUser.city,
            test, date, slot, bid,
            status: 'pending'
        });
        await appointment.save();
        console.log(`✅ Appointment booked: ${bid} | Patient: ${patientUser.name} | Lab: ${labUser.name}`);
        res.json(appointment);
    } catch (err) {
        console.error("❌ Booking error:", err.message);
        res.status(500).json({ msg: err.message });
    }
});

app.get('/api/appointments/my', auth, async (req, res) => {
    try {
        const appointments = await Appointment.find({ patientId: req.user.id }).sort({ createdAt: -1 });
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

app.patch('/api/appointments/:id/cancel', auth, async (req, res) => {
    try {
        const apt = await Appointment.findOne({ _id: req.params.id, patientId: req.user.id });
        if (!apt) return res.status(404).json({ msg: 'Appointment not found.' });
        apt.status = 'cancelled';
        await apt.save();
        res.json(apt);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

app.get('/api/appointments/lab', auth, async (req, res) => {
    try {
        const appointments = await Appointment.find({ labId: req.user.id }).sort({ createdAt: -1 });
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// ─── PATIENT DIAGNOSIS ENDPOINTS ───
app.post('/api/patient-diagnosis/save', auth, async (req, res) => {
    try {
        console.log("📥 Patient diagnosis save request:", req.body);
        const diag = new PatientDiagnosis({ userId: req.user.id, ...req.body });
        await diag.save();
        console.log("✅ Patient diagnosis saved successfully:", diag._id);
        res.json(diag);
    } catch (err) {
        console.error("❌ Error saving patient diagnosis:", err.message);
        res.status(500).json({ msg: err.message });
    }
});

app.get('/api/patient-diagnosis/history', auth, async (req, res) => {
    try {
        console.log("📥 Fetching patient history for user:", req.user.id);
        const history = await PatientDiagnosis.find({ userId: req.user.id }).sort({ date: -1 });
        console.log(`📊 Found ${history.length} records`);
        res.json(history);
    } catch (err) {
        console.error("❌ Error fetching patient history:", err.message);
        res.status(500).json({ msg: err.message });
    }
});

app.get('/api/patient-diagnosis/compare-recent', auth, async (req, res) => {
    try {
        const history = await PatientDiagnosis.find({ userId: req.user.id }).sort({ date: -1 }).limit(3);
        if (history.length < 2) {
            return res.status(400).json({ msg: 'Not enough history data for comparison. At least 2 reports are required.' });
        }
        
        let report1 = { title: history[0].title, parameters: history[0].parameters };
        let report2 = { title: history[1].title, parameters: history[1].parameters };
        let report3 = history[2] ? { title: history[2].title, parameters: history[2].parameters } : null;

        const comparisonPrompt = `
    ### ROLE
    You are a Senior Medical Data Analyst. Perform a longitudinal analysis of up to three patient lab reports.

    ### INPUT DATA
    - Report 1 (Latest): ${JSON.stringify(report1)}
    - Report 2 (Previous): ${JSON.stringify(report2)}
    - Report 3 (Oldest): ${JSON.stringify(report3)}

    ### OBJECTIVES
    1. **Calculate Deltas**: Compare Report 1 (Latest) against Report 2.
    2. **Trend Analysis**: Evaluate clinical improvement or deterioration.

    ### OUTPUT SCHEMA (STRICT JSON)
    {
      "table_data": [{"parameter": string, "r1": any, "r2": any, "r3": any, "change": string, "percent": string, "trend": string}],
      "health_summary": string
    }
`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-70b-versatile',
                messages: [{ role: 'user', content: comparisonPrompt }],
                response_format: { "type": "json_object" },
                temperature: 0.1
            })
        });

        const result = await response.json();
        const parsedData = JSON.parse(result.choices[0].message.content);
        res.json({ comparison: parsedData, count: history.length });
    } catch (err) {
        console.error("Comparison error:", err);
        res.status(500).json({ msg: err.message });
    }
});

// ─── DOCTOR DIAGNOSIS ENDPOINTS ───
app.post('/api/doctor-diagnosis/save', auth, async (req, res) => {
    try {
        console.log("📥 Received doctor diagnosis save request:", req.body);
        const diag = new DoctorDiagnosis({ userId: req.user.id, ...req.body });
        await diag.save();
        console.log("✅ Diagnosis saved successfully:", diag._id);
        res.json(diag);
    } catch (err) {
        console.error("❌ Error saving diagnosis:", err.message);
        res.status(500).json({ msg: err.message });
    }
});

app.get('/api/doctor-diagnosis/all', auth, async (req, res) => {
    try {
        console.log("📥 Fetching all doctor diagnoses for user:", req.user.id);
        const records = await DoctorDiagnosis.find({ userId: req.user.id }).sort({ date: -1 });
        console.log(`📊 Found ${records.length} records`);
        res.json(records);
    } catch (err) {
        console.error("❌ Error fetching diagnoses:", err.message);
        res.status(500).json({ msg: err.message });
    }
});

// ─── LAB REPORT ENDPOINTS ───
app.post('/api/lab-reports/upload', auth, async (req, res) => {
    try {
        const { patientEmail, patientName, testType, reportTitle, notes, fileBase64, fileType, fileName, appointmentId } = req.body;
        if (!patientEmail || !testType || !reportTitle || !fileBase64) {
            return res.status(400).json({ msg: 'Patient email, test type, title, and file are required.' });
        }
        const labUser = await User.findById(req.user.id);
        const report = new LabReport({
            labUserId: req.user.id, labName: labUser.name,
            patientEmail: patientEmail.toLowerCase().trim(),
            patientName, testType, reportTitle, notes,
            fileBase64, fileType, fileName, status: 'pending'
        });
        await report.save();

        if (appointmentId) {
            const apt = await Appointment.findById(appointmentId);
            if (apt) { apt.status = 'uploaded'; await apt.save(); }
        }

        res.json({ msg: 'Report uploaded successfully.', reportId: report._id });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

app.get('/api/lab-reports/my-uploads', auth, async (req, res) => {
    try {
        const reports = await LabReport.find({ labUserId: req.user.id }).select('-fileBase64').sort({ uploadedAt: -1 });
        res.json(reports);
    } catch (err) { res.status(500).json({ msg: err.message }); }
});

app.get('/api/lab-reports/my-reports', auth, async (req, res) => {
    try {
        const patientUser = await User.findById(req.user.id);
        const reports = await LabReport.find({ patientEmail: patientUser.email.toLowerCase() }).select('-fileBase64').sort({ uploadedAt: -1 });
        res.json(reports);
    } catch (err) { res.status(500).json({ msg: err.message }); }
});

app.get('/api/lab-reports/:id', auth, async (req, res) => {
    try {
        const patientUser = await User.findById(req.user.id);
        const report = await LabReport.findOne({ _id: req.params.id, patientEmail: patientUser.email.toLowerCase() });
        if (!report) return res.status(404).json({ msg: 'Report not found or access denied.' });
        if (report.status === 'pending') { report.status = 'viewed'; await report.save(); }
        res.json(report);
    } catch (err) { res.status(500).json({ msg: err.message }); }
});

app.patch('/api/lab-reports/:id/analysis', auth, async (req, res) => {
    try {
        const patientUser = await User.findById(req.user.id);
        const report = await LabReport.findOne({ _id: req.params.id, patientEmail: patientUser.email.toLowerCase() });
        if (!report) return res.status(404).json({ msg: 'Report not found.' });
        report.aiAnalysis = req.body.analysis;
        report.analysisDate = new Date();
        report.status = 'analysed';
        await report.save();
        res.json({ msg: 'Analysis saved.' });
    } catch (err) { res.status(500).json({ msg: err.message }); }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`🚀 CLINICAL CORE BACKEND ONLINE`);
    console.log(`📡 ADDRESS: http://localhost:${PORT}`);
    console.log(`🏙️  CITIES: ${CITIES.join(', ')}`);
    console.log(`🔐 JWT: ${process.env.JWT_SECRET ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`🗄️ DB: ${process.env.MONGO_URI ? 'URI_LOADED' : 'MISSING_URI'}`);
    console.log(`================================================\n`);
});