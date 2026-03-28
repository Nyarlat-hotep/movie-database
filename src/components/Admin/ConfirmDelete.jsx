import { motion, AnimatePresence } from 'framer-motion';
import './ConfirmDelete.css';

export default function ConfirmDelete({ item, onConfirm, onCancel }) {
  if (!item) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="confirm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.target === e.currentTarget && onCancel()}
      >
        <motion.div
          className="confirm-card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22 }}
        >
          <div className="confirm-title">Remove Title</div>
          <div className="confirm-body">
            Remove <strong>{item.title}</strong> from the vault?<br />
            This cannot be undone.
          </div>
          <div className="confirm-actions">
            <button className="btn-cancel" onClick={onCancel}>Cancel</button>
            <button className="btn-delete" onClick={() => onConfirm(item)}>Remove</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
