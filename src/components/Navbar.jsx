import { Link, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { Stethoscope, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-[100] w-full bg-[var(--bg-main)]/70 backdrop-blur-2xl border-b border-[var(--glass-border)] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-[var(--text-main)]">
            Med<span className="text-cyan-500">Ez</span>
          </span>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              <Link
                to={user.role === 'lab' ? '/lab-portal' : '/patient-dashboard'}
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-cyan-500 transition-colors px-4 py-2 rounded-lg hover:bg-cyan-500/5"
              >
                Dashboard
              </Link>
            </>
          )}

          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/10 transition-all border border-transparent hover:border-[var(--glass-border)]"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!user ? (
            <div className="flex items-center gap-2 ml-1">
              <Link to="/login">
                <Button variant="ghost" className="text-[11px] font-bold uppercase tracking-wider h-9 px-4 rounded-xl">Login</Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" className="text-[11px] font-bold uppercase tracking-wider h-9 px-5 rounded-xl shadow-lg shadow-cyan-500/20">Sign Up</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 ml-1">
              <div className="hidden md:block text-right">
                <p className="text-[11px] font-bold text-[var(--text-main)] leading-none">{user.name}</p>
                <p className="text-[9px] text-cyan-500 font-semibold uppercase tracking-wider mt-0.5">
                  {user.role === 'lab' ? 'Lab Technician' : 'Patient'}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all border border-transparent hover:border-rose-500/20"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
