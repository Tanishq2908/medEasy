import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(read('medeasy-user')) || null; } catch { return null; }
  });

  const signIn = useCallback((u, token) => {
    write('medeasy-token', token);
    write('medeasy-user', JSON.stringify(u));
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    write('medeasy-token', null);
    write('medeasy-user', null);
    setUser(null);
  }, []);

  // Validate a stored session on load (server secret may have rotated).
  useEffect(() => {
    if (!read('medeasy-token')) return;
    api('/api/auth/me').then((d) => setUser(d.user)).catch((e) => { if (e.status === 401) signOut(); });
  }, [signOut]);

  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
