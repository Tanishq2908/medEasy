const mongoose = require('mongoose');

const DiagnosisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: String, required: true },
  type: { type: String, enum: ['report', 'ecg', 'ct', 'mri'], required: true },
  title: { type: String, required: true },
  prediction: String,
  confidence: Number,
  summary: String,
  fullResult: mongoose.Schema.Types.Mixed,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Diagnosis', DiagnosisSchema);
