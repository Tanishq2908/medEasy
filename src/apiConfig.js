// Centralized API Configuration for MedEasy Frontend
// Uses VITE_API_URL / VITE_FLASK_URL environment variables in production (Render), with local fallbacks.

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/$/, '');
export const FLASK_BASE_URL = (import.meta.env.VITE_FLASK_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
