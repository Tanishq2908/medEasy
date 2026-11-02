import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FlaskConical, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/analyze', label: 'Analyze report' },
  { to: '/dashboard', label: 'My reports', auth: true },
  { to: '/models', label: 'Model performance' },
];

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const visible = links.filter((l) => !l.auth || user);

  const linkCls = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'text-[var(--ink)] bg-[var(--surface-2)]' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'}`;

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-white"><FlaskConical className="h-4.5 w-4.5" /></span>
          <span className="text-base font-bold tracking-tight">MedEasy</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {visible.map((l) => <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>)}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="btn btn-ghost btn-sm w-9 px-0" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm font-semibold muted">{user.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { signOut(); navigate('/'); }}>
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Create account</Link>
            </div>
          )}
          <button className="btn btn-ghost btn-sm w-9 px-0 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {visible.map((l) => <NavLink key={l.to} to={l.to} className={linkCls} onClick={() => setOpen(false)}>{l.label}</NavLink>)}
            {user ? (
              <button className="btn btn-ghost btn-sm justify-start" onClick={() => { signOut(); setOpen(false); navigate('/'); }}>
                <LogOut className="h-4 w-4" /> Sign out ({user.name})
              </button>
            ) : (
              <div className="mt-2 flex gap-2">
                <Link to="/login" className="btn btn-secondary btn-sm flex-1" onClick={() => setOpen(false)}>Sign in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm flex-1" onClick={() => setOpen(false)}>Create account</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
