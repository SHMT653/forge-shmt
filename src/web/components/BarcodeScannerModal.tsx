'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ScanLine, Loader, AlertCircle, CheckCircle2, Search, RefreshCw } from 'lucide-react';
import { lookupBarcode, type ScannedProduct } from '@/data/barcode';

type ScanState = 'init' | 'scanning' | 'loading' | 'found' | 'notfound' | 'error' | 'manual';

export function BarcodeScannerModal({
  onLog,
  onClose,
}: {
  onLog: (kcal: number, proteinG: number, name: string, carbsG?: number, fatG?: number) => Promise<void> | void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<ScanState>('init');
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [grams, setGrams] = useState('100');
  const [manualBarcode, setManualBarcode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    void startScanner();
    return () => stopRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScanner() {
    setState('init');
    try {
      // Dynamic import so ZXing is not in the initial JS bundle
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();

      if (!videoRef.current) return;

      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, err, ctl) => {
          if (result) {
            ctl.stop();
            void handleBarcode(result.getText());
          }
          // NotFoundException fires constantly when no barcode visible — ignore silently
          if (err && err.name !== 'NotFoundException') {
            console.warn('[scanner]', err.message);
          }
        },
      );

      stopRef.current = () => controls.stop();
      setState('scanning');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (e.name === 'NotAllowedError') {
        setErrorMsg('Kamerazugriff verweigert. Bitte erlaube die Kamera in den Einstellungen und lade die Seite neu.');
      } else if (e.name === 'NotFoundError') {
        setErrorMsg('Keine Kamera gefunden. Gib den Barcode manuell ein.');
      } else {
        setErrorMsg('Kamera konnte nicht gestartet werden. Gib den Barcode manuell ein.');
      }
      setState('error');
    }
  }

  async function handleBarcode(barcode: string) {
    stopRef.current?.();
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
    await handleBarcode(code);
  }

  function handleRescan() {
    stopRef.current?.();
    setProduct(null);
    setErrorMsg('');
    setManualBarcode('');
    void startScanner();
  }

  async function handleLog() {
    if (!product) return;
    setLogging(true);
    const g = Math.max(1, Number(grams) || 100);
    const f = g / 100;
    await onLog(
      Math.round(product.kcalPer100g * f),
      Math.round(product.proteinPer100g * f * 10) / 10,
      product.brand ? `${product.name} (${product.brand})` : product.name,
      Math.round(product.carbsPer100g * f * 10) / 10,
      Math.round(product.fatPer100g * f * 10) / 10,
    );
    onClose();
  }

  const g = Math.max(1, Number(grams) || 100);
  const kcalNow = product ? Math.round(product.kcalPer100g * g / 100) : 0;
  const proteinNow = product ? Math.round(product.proteinPer100g * g / 100 * 10) / 10 : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#0d0d12',
        display: 'flex', flexDirection: 'column',
        // Respect iOS notch / dynamic island
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScanLine size={20} color="var(--violet)" />
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Barcode scannen</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10, padding: '8px 10px', cursor: 'pointer', color: 'var(--text)',
            touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

        {/* Video always rendered so ref is available */}
        <div style={{
          position: 'relative', width: '100%', maxHeight: 340, overflow: 'hidden',
          display: state === 'scanning' ? 'block' : 'none',
        }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', maxHeight: 340, objectFit: 'cover', display: 'block' }}
          />
          {/* Scan overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ position: 'relative', width: 240, height: 140 }}>
              {(['tl','tr','bl','br'] as const).map((c) => (
                <div key={c} style={{
                  position: 'absolute', width: 22, height: 22, borderRadius: 2,
                  ...(c === 'tl' ? { top: 0, left: 0, borderTop: '3px solid var(--violet)', borderLeft: '3px solid var(--violet)' } : {}),
                  ...(c === 'tr' ? { top: 0, right: 0, borderTop: '3px solid var(--violet)', borderRight: '3px solid var(--violet)' } : {}),
                  ...(c === 'bl' ? { bottom: 0, left: 0, borderBottom: '3px solid var(--violet)', borderLeft: '3px solid var(--violet)' } : {}),
                  ...(c === 'br' ? { bottom: 0, right: 0, borderBottom: '3px solid var(--violet)', borderRight: '3px solid var(--violet)' } : {}),
                }} />
              ))}
              <div style={{ position: 'absolute', left: 4, right: 4, height: 2, background: 'linear-gradient(90deg, transparent, var(--violet), transparent)', animation: 'scanLine 2s ease-in-out infinite' }} />
            </div>
          </div>
        </div>

        {/* Also render video element hidden when in scanning state so we can attach stream */}
        {state !== 'scanning' && (
          <video ref={undefined} muted playsInline style={{ display: 'none' }} />
        )}

        {/* States */}
        <div style={{ padding: '24px 24px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {state === 'init' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <Loader size={32} color="var(--violet)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--subtle)', fontSize: 13 }}>Kamera wird gestartet …</p>
            </div>
          )}

          {state === 'scanning' && (
            <>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--subtle)', textAlign: 'center' }}>
                Halte den Barcode in den Rahmen — scannt automatisch
              </p>
              <button
                type="button"
                onClick={() => { stopRef.current?.(); setState('manual'); }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 16px', color: 'var(--subtle)', fontSize: 12, cursor: 'pointer', touchAction: 'manipulation' }}
              >
                Barcode manuell eingeben
              </button>
            </>
          )}

          {state === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
              <Loader size={32} color="var(--violet)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text)', fontSize: 14 }}>Produkt wird gesucht …</p>
            </div>
          )}

          {state === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
              <AlertCircle size={36} color="var(--danger)" />
              <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>{errorMsg}</p>
              <button type="button" className="button secondary compact" onClick={() => setState('manual')}>Manuell eingeben</button>
              <button type="button" className="button secondary compact" onClick={handleRescan}>Erneut versuchen</button>
            </div>
          )}

          {state === 'manual' && (
            <>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Barcode manuell eingeben</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--subtle)' }}>EAN-13 oder EAN-8 Nummer vom Produkt (Rückseite)</p>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                placeholder="z.B. 4006381333931"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleManualLookup(); }}
                autoFocus
              />
              <button type="button" className="button" onClick={handleManualLookup} disabled={!manualBarcode.trim()}>
                <Search size={16} /> Produkt suchen
              </button>
              <button type="button" className="button secondary compact" onClick={handleRescan}>
                Zurück zur Kamera
              </button>
            </>
          )}

          {state === 'notfound' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
              <AlertCircle size={36} color="var(--gold)" />
              <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>
                Produkt nicht in der Datenbank gefunden.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="button secondary compact" onClick={handleRescan}>
                  <RefreshCw size={14} /> Nochmal scannen
                </button>
                <button type="button" className="button secondary compact" onClick={() => { setManualBarcode(''); setState('manual'); }}>
                  Manuell eingeben
                </button>
              </div>
            </div>
          )}

          {state === 'found' && product && (
            <>
              {/* Product card */}
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.09)' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {product.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt={product.name} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,0.06)' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{product.name}</p>
                    {product.brand && <p style={{ margin: '3px 0 6px', fontSize: 12, color: 'var(--subtle)' }}>{product.brand}</p>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#c9a227', background: 'rgba(201,162,39,0.12)', borderRadius: 6, padding: '2px 7px' }}>{product.kcalPer100g} kcal/100g</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)', background: 'rgba(107,217,173,0.1)', borderRadius: 6, padding: '2px 7px' }}>{product.proteinPer100g}g P/100g</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 0, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', justifyContent: 'space-around', textAlign: 'center' }}>
                  {[
                    { label: 'Kohlenhydrate', val: `${product.carbsPer100g}g` },
                    { label: 'Fett', val: `${product.fatPer100g}g` },
                    { label: 'Protein', val: `${product.proteinPer100g}g` },
                  ].map((m) => (
                    <div key={m.label}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{m.val}</p>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--subtle)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Portion */}
              <div>
                <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Menge (Gramm)</label>
                <input className="input" type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} min="1" />
                {product.servingSizeG && (
                  <button type="button" onClick={() => setGrams(String(product.servingSizeG))} style={{ marginTop: 5, background: 'none', border: 'none', fontSize: 11, color: 'var(--violet)', cursor: 'pointer', padding: 0 }}>
                    Portionsgröße verwenden ({product.servingSizeG} g)
                  </button>
                )}
              </div>

              {/* Live preview */}
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 16px', background: 'rgba(123,92,240,0.09)', borderRadius: 12, border: '1px solid rgba(123,92,240,0.18)' }}>
                {[
                  { label: 'kcal', val: kcalNow, color: '#c9a227' },
                  { label: 'Protein', val: `${proteinNow}g`, color: 'var(--teal)' },
                  { label: 'Menge', val: `${grams || 0}g`, color: 'var(--text)' },
                ].map((item) => (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.val}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>{item.label}</p>
                  </div>
                ))}
              </div>

              <button type="button" className="button" onClick={handleLog} disabled={logging}>
                <CheckCircle2 size={18} /> {logging ? 'Wird eingetragen …' : 'Eintragen'}
              </button>
              <button type="button" className="button secondary compact" onClick={handleRescan}>
                <RefreshCw size={14} /> Anderes Produkt scannen
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom close button — always reachable ─────────────── */}
      <div style={{ flexShrink: 0, padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--subtle)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
          }}
        >
          Abbrechen
        </button>
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
