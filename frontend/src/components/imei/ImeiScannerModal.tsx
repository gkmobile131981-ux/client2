import React, { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Check,
  Keyboard,
  RefreshCw,
  ScanLine,
  TriangleAlert,
  Vibrate,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ImeiBarcodeScanner, type ScannerStatus } from './barcodeScanner';
import { getImeiValidation, isValidImei, normalizeImei } from './imeiUtils';

export { extractImeiFromText, isValidImei } from './imeiUtils';

interface ImeiScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (imei: string) => void;
}

export const ImeiScannerModal: React.FC<ImeiScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastHint, setLastHint] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<ImeiBarcodeScanner | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const successHandledRef = useRef(false);

  const playSuccessFeedback = () => {
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(120);
    } catch {
      // Vibration is unsupported on some platforms; ignore.
    }
    try {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextCtor();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.22);
    } catch {
      // Audio feedback is best-effort.
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!isOpen || !video) {
      scannerRef.current?.stop();
      scannerRef.current = null;
      setStatus('idle');
      setErrorMessage('');
      setLastHint('');
      setTorchSupported(false);
      setTorchOn(false);
      setZoomSupported(false);
      setZoomLevel(1);
      setShowManual(false);
      setManualValue('');
      return;
    }

    let cancelled = false;
    successHandledRef.current = false;
    setShowManual(false);
    setManualValue('');

    const scanner = new ImeiBarcodeScanner(video, {
      onStatusChange: (nextStatus) => {
        if (cancelled) return;
        setStatus(nextStatus);
        if (nextStatus === 'scanning') {
          setTorchSupported(scanner.torchSupported);
          setTorchOn(false);
          setZoomSupported(scanner.zoomSupported);
          setZoomLevel(1);
        }
      },
      onScan: ({ imei }) => {
        if (cancelled || successHandledRef.current) return;
        successHandledRef.current = true;
        playSuccessFeedback();
        toast.success(`IMEI captured: ${imei}`);
        onScan(imei);
      },
      onHint: (hint) => {
        if (!cancelled) setLastHint(hint);
      },
      onError: (message) => {
        if (cancelled) return;
        setErrorMessage(message);
        setShowManual(true);
      },
    });
    scannerRef.current = scanner;

    void (async () => {
      try {
        await scanner.start();
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not start the camera.'
        );
        setShowManual(true);
      }
    })();

    return () => {
      cancelled = true;
      scanner.stop();
      scannerRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const manualValidation = getImeiValidation(manualValue);

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const ok = await scanner.toggleTorch();
    if (ok) setTorchOn(!torchOn);
  };

  const changeZoom = async (delta: number) => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    setZoomLevel(await scanner.adjustZoom(delta));
  };

  const useManualImei = () => {
    const digits = normalizeImei(manualValue);
    if (!isValidImei(digits) || successHandledRef.current) return;
    successHandledRef.current = true;
    toast.success(`IMEI entered: ${digits}`);
    onScan(digits);
  };

  const retryCamera = () => {
    setStatus('idle');
    setErrorMessage('');
    setShowManual(false);
    const scanner = scannerRef.current;
    if (scanner) {
      void (async () => {
        try {
          await scanner.start();
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Could not start the camera.'
          );
          setShowManual(true);
        }
      })();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 light text-foreground">
      <div className="bg-card border border-border w-[94%] sm:w-full max-w-md rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <style>{`
          @keyframes imeiScanMove {
            0% { top: 14%; }
            50% { top: 80%; }
            100% { top: 14%; }
          }
          .imei-scan-line {
            animation: imeiScanMove 2.2s ease-in-out infinite;
          }
        `}</style>

        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            Scan IMEI Barcode
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-secondary/40 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative border border-border/80 rounded-xl overflow-hidden bg-slate-950 aspect-[16/10]">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover transition-opacity ${
              status === 'scanning' ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ filter: 'brightness(1.08) contrast(1.04)' }}
          />

          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
              <Camera className="h-7 w-7 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Starting camera...
              </span>
            </div>
          )}

          {status === 'scanning' && (
            <>
              <div className="absolute inset-0 bg-slate-950/30 pointer-events-none" />
              <div className="absolute inset-x-5 top-[18%] bottom-[18%] pointer-events-none">
                <span className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                <span className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                <div className="imei-scan-line absolute left-2 right-2 h-0.5 bg-primary/90 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
              </div>
              <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                <span className="bg-slate-950/70 text-slate-100 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
                  Searching for IMEI...
                </span>
              </div>

              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="absolute top-2 right-2 p-2 rounded-full bg-slate-950/70 text-slate-100 hover:bg-slate-950/90 transition-colors pointer-events-auto"
                  aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                  title="Flashlight"
                >
                  <Zap className={`h-4 w-4 ${torchOn ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              )}

              {zoomSupported && (
                <div className="absolute bottom-2 right-2 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => changeZoom(0.5)}
                    className="p-1.5 rounded-full bg-slate-950/70 text-slate-100 hover:bg-slate-950/90 transition-colors pointer-events-auto"
                    aria-label="Zoom in"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeZoom(-0.5)}
                    className="p-1.5 rounded-full bg-slate-950/70 text-slate-100 hover:bg-slate-950/90 transition-colors pointer-events-auto"
                    aria-label="Zoom out"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-center text-[9px] font-bold text-slate-200 bg-slate-950/70 rounded-full px-1.5 py-0.5">
                    {zoomLevel.toFixed(1)}x
                  </span>
                </div>
              )}
            </>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 p-4 text-center">
              <TriangleAlert className="h-7 w-7 text-amber-400" />
              <span className="text-xs font-semibold">{errorMessage}</span>
              <button
                type="button"
                onClick={retryCamera}
                className="mt-1 flex items-center gap-1.5 bg-secondary/40 hover:bg-secondary/60 text-slate-100 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          )}
        </div>

        {status === 'scanning' && (
          <p className="text-[11px] text-muted-foreground font-semibold text-center">
            Point the camera at the IMEI barcode/QR code on the device box or phone settings.
          </p>
        )}
        {lastHint && status !== 'error' && (
          <p className="text-[11px] text-amber-600 font-semibold text-center flex items-center justify-center gap-1">
            <Vibrate className="h-3.5 w-3.5" />
            {lastHint}
          </p>
        )}

        {showManual && (
          <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/20 p-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" />
              Enter IMEI manually
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={manualValue}
              onChange={(e) =>
                setManualValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 15))
              }
              placeholder="15-digit IMEI"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {manualValue && (
              <p
                className={`text-[11px] font-semibold flex items-center gap-1 ${
                  manualValidation.valid
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}
              >
                {manualValidation.valid ? (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                )}
                {manualValidation.message}
              </p>
            )}
            <button
              type="button"
              disabled={!manualValidation.valid}
              onClick={useManualImei}
              className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none text-primary-foreground py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              <Check className="h-3.5 w-3.5" />
              Use IMEI
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowManual((prev) => !prev)}
            className="flex-1 bg-secondary/55 hover:bg-secondary/75 text-foreground py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
          >
            Enter Manually
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
          >
            Done
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/70 text-center">
          Camera access works best in Chrome/Safari over HTTPS. Scanning is optional — you can always type the IMEI.
        </p>
      </div>
    </div>
  );
};
