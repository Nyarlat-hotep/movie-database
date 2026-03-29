import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Camera, X, ScanLine, Search, Plus } from 'lucide-react';
import { TMDB_POSTER_URL } from '../../utils/format.js';
import './ScanShelfModal.css';

async function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1024 / img.width, 1024 / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.85);
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function ScanShelfModal({ library, addItems, onClose }) {
  const [step, setStep] = useState('capture'); // 'capture' | 'results' | 'confirm'
  const [preview, setPreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [titles, setTitles] = useState([]);
  const [checked, setChecked] = useState({});
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // [{ title, tmdbMatch, _type }]
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  // Build lowercase set of owned titles for fast lookup
  const ownedTitles = new Set([
    ...library.movies.map(m => m.title.toLowerCase()),
    ...library.shows.map(s => s.title.toLowerCase()),
  ]);

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setPreview(URL.createObjectURL(file));
    const b64 = await compressImage(file);
    setImageBase64(b64);
  }

  async function handleScan() {
    if (!imageBase64) return;
    setScanning(true);
    try {
      const res = await fetch('/api/scan-shelf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      const detected = data.titles || [];
      setTitles(detected);
      // Check new titles by default, un-check already owned
      const init = {};
      detected.forEach(t => { init[t] = !ownedTitles.has(t.toLowerCase()); });
      setChecked(init);
      setStep('results');
    } catch (err) {
      alert(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleFindOnTmdb() {
    const selected = titles.filter(t => checked[t]);
    if (selected.length === 0) return;
    setSearching(true);

    // Batch in groups of 5
    const batched = [];
    for (let i = 0; i < selected.length; i += 5) {
      batched.push(selected.slice(i, i + 5));
    }

    const allResults = [];
    for (const batch of batched) {
      const batchResults = await Promise.all(
        batch.map(async title => {
          try {
            const res = await fetch('/api/search-tmdb', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: title, type: 'movie' }),
            });
            const data = await res.json();
            const match = Array.isArray(data) ? data[0] : null;
            return { title, tmdbMatch: match || null, _type: 'movie' };
          } catch {
            return { title, tmdbMatch: null, _type: 'movie' };
          }
        })
      );
      allResults.push(...batchResults);
    }

    setResults(allResults);
    setSearching(false);
    setStep('confirm');
  }

  function toggleType(index) {
    setResults(r => r.map((item, i) =>
      i === index ? { ...item, _type: item._type === 'movie' ? 'show' : 'movie' } : item
    ));
  }

  async function handleAdd() {
    setAdding(true);
    const items = results.map(r => ({
      id: uuidv4(),
      _type: r._type,
      title: r.tmdbMatch?.title || r.title,
      year: r.tmdbMatch?.year ? parseInt(r.tmdbMatch.year) : null,
      synopsis: r.tmdbMatch?.synopsis || '',
      poster_path: r.tmdbMatch?.poster_path || null,
      cast: r.tmdbMatch?.cast || [],
      directors: r.tmdbMatch?.directors || [],
      creators: r.tmdbMatch?.creators || [],
      formats: ['dvd'],
      genres: [],
      notes: '',
      tmdb_id: r.tmdbMatch?.tmdb_id || null,
    }));
    await addItems(items);
    setAdding(false);
    onClose();
  }

  const selectedCount = titles.filter(t => checked[t]).length;

  return (
    <div className="scan-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="scan-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <button className="scan-close" onClick={onClose} aria-label="Close"><X size={16} /></button>

        {/* ── STEP 1: CAPTURE ── */}
        {step === 'capture' && (
          <>
            <div className="scan-title">
              <ScanLine size={18} />
              Scan Shelf
            </div>
            <p className="scan-subtitle">Take a photo of a shelf to detect all movie titles</p>

            {!preview ? (
              <div
                className={`scan-drop-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current.click()}
              >
                <Upload size={32} strokeWidth={1.5} />
                <span>Drop a photo here or click to upload</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="scan-preview-wrap">
                <img className="scan-preview" src={preview} alt="shelf preview" />
                <button className="scan-preview-clear" onClick={() => { setPreview(null); setImageBase64(null); }}>
                  <X size={14} /> Change photo
                </button>
              </div>
            )}

            <div className="scan-capture-actions">
              <button
                className="scan-camera-btn"
                onClick={() => cameraInputRef.current.click()}
              >
                <Camera size={16} />
                Take Photo
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])}
                />
              </button>

              <button
                className="scan-btn-primary"
                onClick={handleScan}
                disabled={!imageBase64 || scanning}
              >
                <ScanLine size={16} />
                {scanning ? 'Scanning...' : 'Scan Shelf'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: RESULTS ── */}
        {step === 'results' && (
          <>
            <div className="scan-title">
              <ScanLine size={18} />
              {titles.length} Titles Detected
            </div>
            <p className="scan-subtitle">Uncheck titles you don't want to add</p>

            <div className="scan-list">
              {titles.map(title => {
                const owned = ownedTitles.has(title.toLowerCase());
                return (
                  <label key={title} className={`scan-list-item ${owned ? 'owned' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!checked[title]}
                      onChange={e => setChecked(c => ({ ...c, [title]: e.target.checked }))}
                    />
                    <span className="scan-list-title">{title}</span>
                    {owned && <span className="scan-owned-badge">Owned</span>}
                  </label>
                );
              })}
            </div>

            <div className="scan-actions">
              <button className="scan-btn-secondary" onClick={() => setStep('capture')}>Back</button>
              <button
                className="scan-btn-primary"
                onClick={handleFindOnTmdb}
                disabled={selectedCount === 0 || searching}
              >
                <Search size={16} />
                {searching ? 'Searching...' : `Find on TMDB (${selectedCount})`}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: CONFIRM ── */}
        {step === 'confirm' && (
          <>
            <div className="scan-title">
              <Plus size={18} />
              Add {results.length} Title{results.length !== 1 ? 's' : ''}
            </div>
            <p className="scan-subtitle">Toggle Movie / Show as needed</p>

            <div className="scan-confirm-grid">
              {results.map((item, i) => (
                <div key={i} className="scan-confirm-item">
                  {item.tmdbMatch?.poster_path ? (
                    <img
                      className="scan-confirm-poster"
                      src={TMDB_POSTER_URL(item.tmdbMatch.poster_path, 'w92')}
                      alt={item.title}
                    />
                  ) : (
                    <div className="scan-confirm-no-poster">?</div>
                  )}
                  <div className="scan-confirm-info">
                    <div className="scan-confirm-title">
                      {item.tmdbMatch?.title || item.title}
                      {!item.tmdbMatch && <span className="scan-no-match">No match</span>}
                    </div>
                    {item.tmdbMatch?.year && (
                      <div className="scan-confirm-year">{item.tmdbMatch.year}</div>
                    )}
                    <button
                      className={`scan-type-toggle ${item._type === 'show' ? 'show' : ''}`}
                      onClick={() => toggleType(i)}
                    >
                      {item._type === 'movie' ? 'Movie' : 'Show'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="scan-actions">
              <button className="scan-btn-secondary" onClick={() => setStep('results')}>Back</button>
              <button
                className="scan-btn-primary"
                onClick={handleAdd}
                disabled={adding}
              >
                <Plus size={16} />
                {adding ? 'Adding...' : `Add ${results.length} Title${results.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
