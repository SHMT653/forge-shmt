'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera, Loader, AlertCircle, CheckCircle2, Search, RefreshCw } from 'lucide-react';
import { lookupBarcode, type ScannedProduct } from '@/data/barcode';

// Minimal BarcodeDetector type declaration
declare global {
  class BarcodeDetector {
    constructor(options?: { formats?: string[] });
    detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
    static getSupportedFormats(): Promise<string[]>;
  }
}

type ScanState = 'init' | 'scanning' | 'loading' | 'found' | 'notfound' | 'error' | 'unsupported' | 'manual';

export function BarcodeScannerModal({
  onLog,
  onClose,
}: {
  onLog: (kcal: number, proteinG: number, name: string, carbsG?: number, fatG?: number) => Promise<void> | void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const detectorRef = useRef<InstanceType<typeof BarcodeDetector> | null>(null);

  const [state, setState] = useState<ScanState>('init');
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [grams, setGrams] = useState('100');
  const [manualBarcode, setManualBarcode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    const supported = 'BarcodeDetector' in window && 'mediaDevices' in navigator;
    if (!supported) {
      setState('unsupported');
      return;
    }
    void startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
      });
      setState('scanning');
      scanningRef.current = true;
      void runScanLoop();
    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Kamerazugriff verweigert. Bitte erlaube den Kamerazugriff in den Browsereinstellungen.'
        : 'Kamera konnte nicht gestartet werden. Bitte gib den Barcode manuell ein.';
      setErrorMsg(msg);
      setState('error');
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function runScanLoop() {
    const detect = async () => {
      if (!scanningRef.current || !videoRef.current || !detectorRef.current) return;
      try {
        if (videoRef.current.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes.length > 0 && codes[0]) {
            scanningRef.current = false;
            stopCamera();
            await handleBarcode(codes[0].rawValue);
            return;
          }
        }
      } catch {
        // detection errors are normal (empty frame, etc.)
      }
      if (scanningRef.current) requestAnimationFrame(detect);
    };
    requestAnimationFrame(detect);
  }

  async function handleBarcode(barcode: string) {
    setState('loading');
    const result = await lookupBarcode(barcode);
    if (result) {
      setProduct(result);
      setGrams(result.servingSizeG ? String(result.servingSizeG) : '100');
      setState('found');
    } else {
      setState('notfound');
    }
  }

  async function handleManualLookup() {
    const code = manualBarcode.trim();
    if (!code) return;
    stopCamera();
    await handleBarcode(code);
  }

  async function handleLog() {
    if (!product) return;
    setLogging(true);
    const g = Math.max(1, Number(grams) || 100);
    const factor = g / 100;
    await onLog(
      Math.round(product.kcalPer100g * factor),
      Math.round(product.proteinPer100g * factor * 10) / 10,
      product.brand ? `${product.name} (${product.brand})` : product.name,
      Math.round(product.carbsPer100g * factor * 10) / 10,
      Math.round(product.fatPer100g * factor * 10) / 10,
    );
    onClose();
  }

  function handleRescan() {
    setProduct(null);
    setErrorMsg('');
    setState('init');
    void startCamera();
  }

  const kcalComputed = product ? Math.round(product.kcalPer100g * (Math.max(1, Number(grams) || 100) / 100)) : 0;
  const proteinComputed = product ? Math.round(product.proteinPer100g * (Math.max(1, Number(grams) || 100) / 100) * 10) / 10 : 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Barcode scannen"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Camera size={20} color="var(--violet)" />
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Barcode scannen</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--text)', touchAction: 'manipulation' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Camera view */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: (state === 'scanning') ? 'block' : 'none',
          }}
        />

        {/* Scan overlay */}
        {state === 'scanning' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {/* Crosshair frame */}
            <div style={{ position: 'relative', width: 260, height: 160 }}>
              {/* Corners */}
              {[
                { top: 0, left: 0, borderTop: '3px solid #7b5cf0', borderLeft: '3px solid #7b5cf0' },
                { top: 0, right: 0, borderTop: '3px solid #7b5cf0', borderRight: '3px solid #7b5cf0' },
                { bottom: 0, left: 0, borderBottom: '3px solid #7b5cf0', borderLeft: '3px solid #7b5cf0' },
                { bottom: 0, right: 0, borderBottom: '3px solid #7b5cf0', borderRight: '3px solid #7b5cf0' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 24, height: 24, borderRadius: 2, ...s }} />
              ))}
              {/* Scan line animation */}
              <div style={{
                position: 'absolute', left: 4, right: 4, height: 2,
                background: 'linear-gradient(90deg, transparent, #7b5cf0, transparent)',
                animation: 'scanLine 2s ease-in-out infinite',
              }} />
            </div>
            <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
              Halte den Barcode in den Rahmen
            </p>
            {/* Manual entry fallback */}
            <button
              type="button"
              onClick={() => { stopCamera(); setState('manual'); }}
              style={{ marginTop: 16, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 18px', color: 'rgba(255,255,255,0.8)', fontSize: 12, cursor: 'pointer' }}
            >
              Barcode manuell eingeben
            </button>
          </div>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40 }}>
            <Loader size={36} color="var(--violet)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text)', fontSize: 14 }}>Produkt wird gesucht …</p>
          </div>
        )}

        {/* Init / unsupported / error */}
        {(state === 'init' || state === 'unsupported' || state === 'error') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40, maxWidth: 320, textAlign: 'center' }}>
            <AlertCircle size={40} color={state === 'init' ? 'var(--subtle)' : 'var(--danger)'} />
            <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>
              {state === 'unsupported'
                ? 'Dein Browser unterstützt keinen Live-Barcode-Scan. Gib den Barcode manuell ein.'
                : state === 'error'
                  ? errorMsg
                  : 'Kamera wird gestartet …'}
            </p>
            {(state === 'unsupported' || state === 'error') && (
              <button
                type="button"
                className="button secondary compact"
                onClick={() => setState('manual')}
              >
                Manuell eingeben
              </button>
            )}
          </div>
        )}

        {/* Manual entry */}
        {state === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 32, width: '100%', maxWidth: 360 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>Barcode eingeben</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--subtle)', textAlign: 'center' }}>EAN-13 oder EAN-8 Nummer vom Produkt</p>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              placeholder="z.B. 4006381333931"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="button"
              onClick={handleManualLookup}
              disabled={!manualBarcode.trim()}
            >
              <Search size={16} /> Produkt suchen
            </button>
            {'BarcodeDetector' in window && 'mediaDevices' in navigator && (
              <button type="button" className="button secondary compact" onClick={handleRescan}>
                <Camera size={14} /> Kamera starten
              </button>
            )}
          </div>
        )}

        {/* Not found */}
        {state === 'notfound' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40, maxWidth: 320, textAlign: 'center' }}>
            <AlertCircle size={36} color="var(--gold)" />
            <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>
              Produkt nicht gefunden. Das Produkt ist möglicherweise noch nicht in der Datenbank.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="button secondary compact" onClick={handleRescan}>
                <RefreshCw size={14} /> Erneut scannen
              </button>
              <button type="button" className="button secondary compact" onClick={() => { setState('manual'); setManualBarcode(''); }}>
                Manuell eingeben
              </button>
            </div>
          </div>
        )}

        {/* Product found */}
        {state === 'found' && product && (
          <div style={{ padding: '20px 20px 32px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Product card */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.name} style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,0.08)' }} />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{product.name}</p>
                  {product.brand && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--subtle)' }}>{product.brand}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#c9a227', background: 'rgba(201,162,39,0.12)', borderRadius: 6, padding: '3px 8px' }}>
                      {product.kcalPer100g} kcal/100g
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)', background: 'rgba(107,217,173,0.1)', borderRadius: 6, padding: '3px 8px' }}>
                      {product.proteinPer100g}g Protein/100g
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, padding: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--subtle)', justifyContent: 'space-around' }}>
                  <span>Kohlenhydrate<br /><b style={{ color: 'var(--text)' }}>{product.carbsPer100g}g</b></span>
                  <span>Fett<br /><b style={{ color: 'var(--text)' }}>{product.fatPer100g}g</b></span>
                  <span>Protein<br /><b style={{ color: 'var(--text)' }}>{product.proteinPer100g}g</b></span>
                </div>
              </div>
            </div>

            {/* Portion size */}
            <div>
              <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Menge (Gramm)</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                min="1"
              />
              {product.servingSizeG && (
                <button
                  type="button"
                  onClick={() => setGrams(String(product.servingSizeG))}
                  style={{ marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: 'var(--violet)', cursor: 'pointer', padding: 0 }}
                >
                  Portionsgröße verwenden ({product.servingSizeG}g)
                </button>
              )}
            </div>

            {/* Live kcal preview */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(123,92,240,0.1)', borderRadius: 10, border: '1px solid rgba(123,92,240,0.2)' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#c9a227' }}>{kcalComputed}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>kcal</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--teal)' }}>{proteinComputed}g</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>Protein</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{grams || 0}g</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>Menge</p>
              </div>
            </div>

            <button
              type="button"
              className="button"
              onClick={handleLog}
              disabled={logging}
              style={{ marginTop: 4 }}
            >
              <CheckCircle2 size={18} /> {logging ? 'Wird eingetragen …' : 'Eintragen'}
            </button>

            <button type="button" className="button secondary compact" onClick={handleRescan}>
              <RefreshCw size={14} /> Anderes Produkt scannen
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 4px; }
          50%  { top: calc(100% - 6px); }
          100% { top: 4px; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
