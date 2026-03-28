import { useState } from 'react';
import { motion } from 'framer-motion';
import './LoginOverlay.css';

export default function LoginOverlay({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setChecking(true);
    setError('');
    const ok = await onLogin(password);
    if (!ok) {
      setError('Access denied');
      setPassword('');
    }
    setChecking(false);
  };

  return (
    <div className="login-overlay">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="login-title">VAULT</div>
        <div className="login-subtitle">Authorized access only</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="password"
            placeholder="Enter access code"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1rem' }}
          />
          {error && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#cc2200', letterSpacing: '2px', textAlign: 'center', textTransform: 'uppercase' }}>
              {error}
            </div>
          )}
          <button className="login-btn" type="submit" disabled={checking}>
            {checking ? 'Verifying...' : 'Access Vault'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
