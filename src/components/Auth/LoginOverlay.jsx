import { motion } from 'framer-motion';
import './LoginOverlay.css';

export default function LoginOverlay({ onLogin }) {
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
        <button className="login-btn" onClick={onLogin}>
          Access Vault
        </button>
      </motion.div>
    </div>
  );
}
