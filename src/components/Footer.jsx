import { Heart, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--glass-border)] bg-[var(--bg-main)]/50 backdrop-blur-md text-[var(--text-muted)] py-10 mt-auto transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-[var(--text-main)] font-extrabold text-sm tracking-tight">MedEz</span>
          </div>
          <p className="text-sm max-w-xs leading-relaxed opacity-70">
            AI-powered clinical decision support. Transforming diagnostics into actionable medical intelligence.
          </p>
          <div className="flex items-center gap-1.5 text-xs opacity-50">
            <span>Made with</span>
            <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
            <span>for better health outcomes.</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-[var(--text-main)] font-bold text-xs uppercase tracking-wider">Platform</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-cyan-500 transition-colors opacity-60 hover:opacity-100">Features</a></li>
            <li><a href="#" className="hover:text-cyan-500 transition-colors opacity-60 hover:opacity-100">Security</a></li>
            <li><a href="#" className="hover:text-cyan-500 transition-colors opacity-60 hover:opacity-100">Pricing</a></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-[var(--text-main)] font-bold text-xs uppercase tracking-wider">Company</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-cyan-500 transition-colors opacity-60 hover:opacity-100">About</a></li>
            <li><a href="#" className="hover:text-cyan-500 transition-colors opacity-60 hover:opacity-100">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-cyan-500 transition-colors opacity-60 hover:opacity-100">Terms of Service</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between text-[10px] uppercase tracking-wider opacity-40">
        <p>&copy; {new Date().getFullYear()} MedEz Inc. All rights reserved.</p>
        <p className="mt-1 md:mt-0">HIPAA Compliant &middot; AES-256 Encrypted</p>
      </div>
    </footer>
  );
}
