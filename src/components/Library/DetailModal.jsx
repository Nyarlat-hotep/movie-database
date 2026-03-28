import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TMDB_POSTER_URL } from '../../utils/format.js';
import './DetailModal.css';

export default function DetailModal({ item, onClose, onEdit, onDelete }) {
  useEffect(() => {
    if (!item) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [item, onClose]);

  if (!item) return null;

  const posterUrl = TMDB_POSTER_URL(item.poster_path, 'w500');
  const isShow = item._type === 'show';
  const credits = isShow ? item.creators : item.directors;
  const creditsLabel = isShow ? 'Created by' : 'Directed by';

  return (
    <AnimatePresence>
      <motion.div
        className="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="detail-modal"
          initial={{ opacity: 0, scale: 0.93, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 16 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <button className="detail-close" onClick={onClose}>✕</button>

          <div className="detail-poster-col">
            {posterUrl
              ? <img className="detail-poster" src={posterUrl} alt={item.title} />
              : <div className="detail-poster-fallback">{item.title}</div>
            }
          </div>

          <div className="detail-content">
            <div>
              <div className="detail-title">{item.title}</div>
              <div className="detail-meta" style={{ marginTop: '0.4rem' }}>
                {item.year && <span className="detail-year">{item.year}</span>}
                {item.runtime && <span className="detail-runtime">{item.runtime} min</span>}
              </div>
              <div className="detail-badges" style={{ marginTop: '0.5rem' }}>
                {isShow && <span className="badge badge-show">TV</span>}
                {item.formats.includes('bluray') && <span className="badge badge-bluray">BR</span>}
                {item.formats.includes('vhs') && <span className="badge badge-vhs">VHS</span>}
              </div>
              {isShow && item.seasons_owned && (
                <div className="detail-seasons" style={{ marginTop: '0.5rem' }}>
                  Seasons: {item.seasons_owned}
                </div>
              )}
            </div>

            {item.synopsis && (
              <div>
                <div className="detail-section-label">Synopsis</div>
                <div className="detail-synopsis">{item.synopsis}</div>
              </div>
            )}

            {credits?.length > 0 && (
              <div>
                <div className="detail-section-label">{creditsLabel}</div>
                <div className="detail-people">{credits.join(', ')}</div>
              </div>
            )}

            {item.cast?.length > 0 && (
              <div>
                <div className="detail-section-label">Cast</div>
                <div className="detail-people">{item.cast.join(', ')}</div>
              </div>
            )}

            <div className="detail-admin-actions">
              <button className="btn-edit" onClick={() => onEdit(item)}>Edit</button>
              <button className="btn-delete" onClick={() => onDelete(item)}>Remove</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
