import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PatientDashboard from './pages/PatientDashboard';
import ReportAnalysisPatient from './pages/ReportAnalysisPatient';
import EcgAnalysis from './pages/EcgAnalysis';
import CancerAnalysisPatient from './pages/CancerAnalysisPatient';
import StitchPremiumUI from './pages/StitchPremiumUI';
import AppointmentBook from './pages/AppointmentBook';
import LabPortal from './pages/LabPortal';
import LabLogin from './pages/LabLogin';
import LabSignup from './pages/LabSignup';
import LabReportView from './pages/LabReportView';
import CompareReports from './pages/CompareReports';
import EcgAnalysisV2 from './pages/analysis/EcgAnalysis';
import BrainTumorAnalysis from './pages/analysis/BrainTumorAnalysis';
import LungCancerAnalysis from './pages/analysis/LungCancerAnalysis';
import KidneyAnalysis from './pages/analysis/KidneyAnalysis';
import BloodTestAnalysis from './pages/analysis/BloodTestAnalysis';
import DNABackground from './components/DNABackground';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

function Layout() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  const isPremiumPage = location.pathname === '/premium';

  return (
    <>
      {!isPremiumPage && <DNABackground isAuthPage={isAuthPage} />}
      <div className="flex flex-col min-h-screen relative z-10 transition-colors duration-300 bg-transparent">
        {!isPremiumPage && <Navbar />}
        <main className="flex-grow flex flex-col">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/premium" element={<StitchPremiumUI />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/patient-dashboard" element={<PatientDashboard />} />
            <Route path="/analyze-patient" element={<ReportAnalysisPatient />} />
            <Route path="/analyze-ecg" element={<EcgAnalysis />} />
            <Route path="/cancer-analysis-patient" element={<CancerAnalysisPatient />} />
            <Route path="/appointments/book" element={<AppointmentBook />} />
            <Route path="/lab-portal" element={<LabPortal />} />
            <Route path="/lab-login" element={<LabLogin />} />
            <Route path="/lab-signup" element={<LabSignup />} />
            <Route path="/lab-report/:id" element={<LabReportView />} />
            <Route path="/compare-reports" element={<CompareReports />} />
            <Route path="/analysis/ecg" element={<EcgAnalysisV2 />} />
            <Route path="/analysis/brain" element={<BrainTumorAnalysis />} />
            <Route path="/analysis/lung" element={<LungCancerAnalysis />} />
            <Route path="/analysis/kidney" element={<KidneyAnalysis />} />
            <Route path="/analysis/blood" element={<BloodTestAnalysis />} />
          </Routes>
        </main>
        {!isAuthPage && !isPremiumPage && <Footer />}
      </div>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Layout />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
