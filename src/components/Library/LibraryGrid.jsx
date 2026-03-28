import { motion } from 'framer-motion';
import MovieCard from './MovieCard.jsx';
import './LibraryGrid.css';

export default function LibraryGrid({ items, onSelect }) {
  if (items.length === 0) {
    return (
      <div className="library-grid">
        <div className="library-empty">No titles found</div>
      </div>
    );
  }

  return (
    <div className="library-grid">
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.008, 0.25), duration: 0.25 }}
        >
          <MovieCard item={item} onClick={onSelect} />
        </motion.div>
      ))}
    </div>
  );
}
