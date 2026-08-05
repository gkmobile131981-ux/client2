import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, ScanLine, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const SCANNER_ELEMENT_ID = 'imei-barcode-scanner';

interface ImeiScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (imei: string) => void;
}

// Extract a valid 15-digit IMEI (Luhn check) from decoded barcode text.
// Handles common label formats such as "IMEI: 356938035643809" or "356938-03-564380-9".
export function extractImeiFromText(text: string): string | null {
  const normalized = text.replace(/\s+/g, '');
  const candidates = normalized.match(/\d{14,17}/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/[^\d]/g, '');
    if (digits.length === 15 && isValidImei(digits)) {
      return digits;
    }
  }
  return null;
}

export function isValidImei(imei: string): boolean {
  const digits = imei.replace(/[^\d]/g, '');
  if (digits.length !== 15) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (doubleDigit) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export const ImeiScannerModal: React.FC<ImeiScannerModalProps> = ({ isOpen, onClose, onScan }) => {
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastHint, setLastHint] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);

  // Stop the camera and tear down the scanner.
  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      if (scanningRef.current) {
        await scannerRef.current.stop();
      }
      scannerRef.current.clear();
    } catch (err) {
      // Ignore stop/clear errors — the stream may already be closed.
    }
    scannerRef.current = null;
    scanningRef.current = false;
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setStatus('idle');
      setErrorMessage('');
      setLastHint('');
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      // Give the modal DOM a moment to render the video container.
      if (!document.getElementById(SCANNER_ELEMENT_ID)) return;

      setStatus('starting');
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A
        ]
      });
      scannerRef.current = scanner;
      scanningRef.current = true;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 }
          },
          (decodedText) => {
            const imei = extractImeiFromText(decodedText);
            if (!imei) {
              setLastHint('Scanned code is not a valid IMEI. Keep the label centered or enter it manually.');
              return;
            }
            // Debounce: ignore duplicates fired while the modal is closing.
            if (!scanningRef.current) return;
            void (async () => {
              await stopScanner();
              if (cancelled) return;
              setStatus('idle');
              toast.success(`IMEI captured: ${imei}`);
              onScan(imei);
            })();
          },
          () => {
            // Per-frame decode noise; scanning continues in the background.
          }
        );
        if (cancelled) {
          await stopScanner();
          return;
        }
        setStatus('scanning');
        setErrorMessage('');
      } catch (err: any) {
        if (cancelled) return;
        scanningRef.current = false;
        setStatus('error');
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('permission') || msg.includes('notallowed')) {
          setErrorMessage('Camera permission was denied. Please allow camera access in your browser settings, or enter the IMEI manually.');
        } else if (msg.includes('not supported') || msg.includes('nosupport')) {
          setErrorMessage('Camera scanning is not supported on this browser/device. Please enter the IMEI manually.');
        } else if (msg.includes('notfound') || msg.includes('no camera')) {
          setErrorMessage('No camera was found on this device. Please enter the IMEI manually.');
        } else {
          setErrorMessage(`Could not start the camera (${err?.message || 'unknown error'}). Please enter the IMEI manually.`);
        }
      }
    };

    const timer = window.setTimeout(startScanner, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 light text-foreground">
      <div className="bg-card border border-border w-[94%] sm:w-full max-w-md rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
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
          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
              <Camera className="h-7 w-7 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Starting camera...</span>
            </div>
          )}
          {status === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="absolute inset-x-8 inset-y-1/3 border-2 border-dashed border-primary/80 rounded-lg" />
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 p-4 text-center">
              <AlertTriangle className="h-7 w-7 text-amber-400" />
              <span className="text-xs font-semibold">{errorMessage}</span>
            </div>
          )}
          <div id={SCANNER_ELEMENT_ID} className={status === 'starting' || status === 'scanning' ? 'w-full h-full' : 'hidden'} />
        </div>

        {status === 'scanning' && (
          <p className="text-[11px] text-muted-foreground font-semibold text-center">
            Point the camera at the IMEI barcode/QR code on the device box or phone settings.
          </p>
        )}
        {lastHint && (
          <p className="text-[11px] text-amber-600 font-semibold text-center">{lastHint}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
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
