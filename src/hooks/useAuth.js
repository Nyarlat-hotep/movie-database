import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const netlifyIdentity = window.netlifyIdentity;
    if (!netlifyIdentity) {
      setLoading(false);
      return;
    }

    netlifyIdentity.on('init', (u) => {
      setUser(u);
      setLoading(false);
    });

    netlifyIdentity.on('login', (u) => {
      setUser(u);
      netlifyIdentity.close();
    });

    netlifyIdentity.on('logout', () => setUser(null));

    netlifyIdentity.init();

    return () => {
      netlifyIdentity.off('init');
      netlifyIdentity.off('login');
      netlifyIdentity.off('logout');
    };
  }, []);

  const login = () => window.netlifyIdentity?.open('login');
  const logout = () => window.netlifyIdentity?.logout();

  return { user, loading, login, logout };
}
