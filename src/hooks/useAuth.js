import { useState, useEffect } from 'react';

const STORAGE_KEY = 'vault_auth';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (import.meta.env.DEV) {
      setUser({ authenticated: true });
      setLoading(false);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'authenticated') {
      setUser({ authenticated: true });
    }
    setLoading(false);
  }, []);

  async function login(password) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      localStorage.setItem(STORAGE_KEY, 'authenticated');
      setUser({ authenticated: true });
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return { user, loading, login, logout };
}
