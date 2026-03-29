import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Camera, X, ScanLine, Search, Plus, Video, Circle, StopCircle } from 'lucide-react';
import { TMDB_POSTER_URL } from '../../utils/format.js';
import './ScanShelfModal.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function diffFrames(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i += 32) diff += Math.abs(a[i] - b[i]);
  return (diff / (a.length / 32)) / 255;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScanShelfModal({ library, addItems, onClose }) {
  // Shared state
  const [scanMode, setScanMode] = useState('upload'); // 'upload' | 'live'
  const [step, setStep] = useState('capture');        // 'capture' | 'results' | 'confirm'

  // Upload mode state
  const [preview, setPreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Live scan state
  const [streaming, setStreaming] = useState(false);
  const [liveScanning, setLiveScanning] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ done: 0, total: 0, titles: 0 });
  const [rateLimitHit, setRateLimitHit] = useState(false);

  // Results state (shared between modes)
  const [titles, setTitles] = useState([]);
  const [checked, setChecked] = useState({});
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [adding, setAdding] = useState(false);

  // Refs
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const videoRef = useRef();
  const streamRef = useRef(null);
  const diffCanvasRef = useRef();
  const fullCanvasRef = useRef();
  const lastDiffDataRef = useRef(null);

  // Owned titles lookup
  const ownedTitles = new Set([
    ...library.movies.map(m => m.title.toLowerCase()),
    ...library.shows.map(s => s.title.toLowerCase()),
  ]);

  // ── Camera cleanup on unmount ──
  useEffect(() => () => stopCamera(), []);

  // ── Scan progress animation (upload mode) ──
  useEffect(() => {
    if (!scanning) { setScanProgress(0); return; }
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(p => p < 85 ? p + (85 - p) * 0.06 : p);
    }, 200);
    return () => clearInterval(interval);
  }, [scanning]);

  // ── Frame capture loop (live mode) ──
  useEffect(() => {
    if (!liveScanning) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      const diffCanvas = diffCanvasRef.current;
      if (!video || !diffCanvas || video.readyState < 2) return;

      const ctx = diffCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 320, 180);
      const frameData = ctx.getImageData(0, 0, 320, 180).data;

      const score = lastDiffDataRef.current ? diffFrames(frameData, lastDiffDataRef.current) : 1;
      if (score < 0.07) return;

      lastDiffDataRef.current = new Uint8ClampedArray(frameData); // copy, not reference

      const full = fullCanvasRef.current;
      full.width = video.videoWidth;
      full.height = video.videoHeight;
      full.getContext('2d').drawImage(video, 0, 0);

      const b64 = full.toDataURL('image/jpeg', 0.85).split(',')[1];
      setCapturedFrames(prev => [...prev, b64]);
    }, 500);

    return () => clearInterval(interval);
  }, [liveScanning]);

  // ── Camera functions ──

  async function startCamera() {
    try {
      // iOS-safe: enumerate devices to find rear camera by label
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const rear = videoDevices.find(d => /back|rear|environment/i.test(d.label));
      const constraints = rear
        ? { video: { deviceId: { exact: rear.deviceId }, width: { ideal: 1280 } } }
        : { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setStreaming(true);
    } catch (err) {
      alert('Camera access denied or unavailable: ' + err.message);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
    setLiveScanning(false);
  }

  // ── Upload mode handlers ──

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
      setScanProgress(100);
      await new Promise(r => setTimeout(r, 350));
      applyResults(detected);
    } catch (err) {
      alert(err.message);
    } finally {
      setScanning(false);
    }
  }

  // ── Live mode handlers ──

  async function handleDone() {
    stopCamera();
    if (capturedFrames.length === 0) return;

    setProcessing(true);
    setProcessProgress({ done: 0, total: capturedFrames.length, titles: 0 });

    const allTitles = new Set();

    for (let i = 0; i < capturedFrames.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 6000)); // 10 RPM = 6s between calls

      try {
        const res = await fetch('/api/scan-shelf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: capturedFrames[i] }),
        });

        if (res.status === 429) {
          setRateLimitHit(true);
          break;
        }

        const data = await res.json();
        if (data.titles) data.titles.forEach(t => allTitles.add(t));
      } catch {
        // skip failed frame, continue
      }

      setProcessProgress({ done: i + 1, total: capturedFrames.length, titles: allTitles.size });
    }

    setProcessing(false);
    applyResults([...allTitles]);
  }

  // ── Shared results logic ──

  function applyResults(detected) {
    setTitles(detected);
    const init = {};
    detected.forEach(t => { init[t] = !ownedTitles.has(t.toLowerCase()); });
    setChecked(init);
    setStep('results');
  }

  // ── TMDB + confirm logic ──

  const selectedCount = titles.filter(t => checked[t]).length;

  async function handleFindOnTmdb() {
    const selected = titles.filter(t => checked[t]);
    if (selected.length === 0) return;
    setSearching(true);

    const batched = [];
    for (let i = 0; i < selected.length; i += 5) batched.push(selected.slice(i, i + 5));

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="scan-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="scan-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <button className="scan-close" onClick={onClose} aria-label="Close"><X size={16} /></button>

        {/* ── STEP: CAPTURE ── */}
        {step === 'capture' && (
          <>
            <div className="scan-title">
              <ScanLine size={18} />
              Scan Shelf
            </div>

            {/* Tab switcher */}
            <div className="scan-tabs">
              <button
                className={`scan-tab ${scanMode === 'upload' ? 'active' : ''}`}
                onClick={() => { setScanMode('upload'); stopCamera(); }}
              >
                <Upload size={14} /> Upload Photo
              </button>
              <button
                className={`scan-tab ${scanMode === 'live' ? 'active' : ''}`}
                onClick={() => { setScanMode('live'); if (!streaming) startCamera(); }}
              >
                <Video size={14} /> Live Scan
              </button>
            </div>

            {/* ── UPLOAD MODE ── */}
            {scanMode === 'upload' && (
              <>
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

                {scanning && (
                  <div className="scan-progress-wrap">
                    <div className="scan-progress-bar">
                      <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }} />
                    </div>
                    <span className="scan-progress-label">Scanning shelf...</span>
                  </div>
                )}

                <div className="scan-capture-actions">
                  <button
                    className="scan-camera-btn"
                    onClick={() => cameraInputRef.current.click()}
                    disabled={scanning}
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

            {/* ── LIVE SCAN MODE ── */}
            {scanMode === 'live' && (
              <>
                <p className="scan-subtitle">Pan your camera across the shelf, then tap Done</p>

                <div className="scan-viewfinder-wrap">
                  <video ref={videoRef} autoPlay playsInline muted className="scan-viewfinder" />
                  {liveScanning && (
                    <div className="scan-live-indicator">
                      <span className="scan-live-dot" />
                      <span>{capturedFrames.length} frame{capturedFrames.length !== 1 ? 's' : ''} captured</span>
                    </div>
                  )}
                </div>

                {/* Hidden canvases for frame processing */}
                <canvas ref={diffCanvasRef} width={320} height={180} style={{ display: 'none' }} />
                <canvas ref={fullCanvasRef} style={{ display: 'none' }} />

                {processing && (
                  <div className="scan-progress-wrap">
                    <div className="scan-progress-bar">
                      <div
                        className="scan-progress-fill"
                        style={{ width: `${processProgress.total ? (processProgress.done / processProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="scan-progress-label">
                      Processing frame {processProgress.done} of {processProgress.total} — {processProgress.titles} titles found
                    </span>
                  </div>
                )}

                {rateLimitHit && (
                  <div className="scan-rate-limit-msg">
                    Daily limit reached after {processProgress.done} frames. {processProgress.titles} titles found — showing results below.
                  </div>
                )}

                <div className="scan-capture-actions">
                  {!liveScanning ? (
                    <button
                      className="scan-btn-primary"
                      onClick={() => { lastDiffDataRef.current = null; setCapturedFrames([]); setLiveScanning(true); }}
                      disabled={!streaming || processing}
                    >
                      <Circle size={14} />
                      Start Scanning
                    </button>
                  ) : (
                    <button
                      className="scan-camera-btn"
                      onClick={() => setLiveScanning(false)}
                    >
                      <StopCircle size={14} />
                      Stop
                    </button>
                  )}
                  <button
                    className="scan-btn-primary"
                    onClick={handleDone}
                    disabled={capturedFrames.length === 0 || processing}
                  >
                    Done ({capturedFrames.length} frame{capturedFrames.length !== 1 ? 's' : ''}) →
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── STEP: RESULTS ── */}
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

        {/* ── STEP: CONFIRM ── */}
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
