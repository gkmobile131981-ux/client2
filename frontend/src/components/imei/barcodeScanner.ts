import { prepareZXingModule } from 'barcode-detector/polyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { extractImeiFromText } from './imeiUtils';

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'error';

export interface ScanResult {
  imei: string;
  format: string;
}

export interface ImeiScannerCallbacks {
  onStatusChange?: (status: ScannerStatus) => void;
  onScan?: (result: ScanResult) => void;
  onHint?: (hint: string) => void;
  onError?: (message: string) => void;
}

interface DetectedCode {
  rawValue: string;
  format: string;
}

interface DetectorLike {
  detect(input: ImageBitmapSource): Promise<DetectedCode[]>;
}

type DetectorCtor = (new (options?: { formats?: string[] }) => DetectorLike) & {
  getSupportedFormats(): Promise<string[]>;
};

interface CameraCapabilities {
  torch?: boolean;
  zoom?: { max?: number; min?: number };
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  [key: string]: unknown;
}

const PREFERRED_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'itf',
  'qr_code',
] as const;

const DECODE_INTERVAL_MS = 120;
const MAX_PROCESS_WIDTH = 1280;
const CENTER_CROP_RATIO = 0.62;
const AUTO_ZOOM_AFTER_MS = 2500;

let engineReady = false;

export function ensureBarcodeEngineReady(): void {
  if (engineReady) return;
  engineReady = true;
  try {
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? wasmUrl : prefix + path,
      },
      fireImmediately: true,
    });
  } catch {
    // The module is instantiated lazily on the first detect(); errors surface there.
  }
}

function getDetectorConstructor(): DetectorCtor | null {
  const candidate = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
  return typeof candidate === 'function' ? (candidate as DetectorCtor) : null;
}

async function resolveFormats(constructor: DetectorCtor): Promise<string[]> {
  try {
    const supported = await constructor.getSupportedFormats();
    const filtered = PREFERRED_FORMATS.filter((format) => supported.includes(format));
    return filtered.length > 0 ? filtered : [...supported];
  } catch {
    return [...PREFERRED_FORMATS];
  }
}

export class ScannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScannerError';
  }
}

function mapCameraError(err: unknown): ScannerError {
  const name = (err as { name?: string })?.name ?? '';
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    message.includes('permission') ||
    message.includes('denied')
  ) {
    return new ScannerError(
      'Camera permission was denied. Please allow camera access in your browser settings, or enter the IMEI manually.'
    );
  }
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    message.includes('no camera') ||
    message.includes('notfound') ||
    message.includes('devicesfound')
  ) {
    return new ScannerError(
      'No camera was found on this device. Please enter the IMEI manually.'
    );
  }
  if (
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    message.includes('in use') ||
    message.includes('notreadable') ||
    message.includes('trackstart')
  ) {
    return new ScannerError(
      'The camera is already in use by another app or tab. Close it and try again.'
    );
  }
  if (name === 'SecurityError' || message.includes('insecure')) {
    return new ScannerError(
      'Camera access requires a secure (HTTPS) connection. Please enter the IMEI manually.'
    );
  }
  if (name === 'NotSupportedError' || message.includes('not supported')) {
    return new ScannerError(
      'Barcode scanning could not start on this browser/device. Please enter the IMEI manually.'
    );
  }
  return new ScannerError(
    `Could not start the camera (${err instanceof Error ? err.message : 'unknown error'}). Please enter the IMEI manually.`
  );
}

export class ImeiBarcodeScanner {
  torchSupported = false;
  zoomSupported = false;

  private video: HTMLVideoElement;
  private callbacks: ImeiScannerCallbacks;
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private detector: DetectorLike | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private rafId = 0;
  private lastDecodeAt = 0;
  private decodeInFlight = false;
  private stopped = true;
  private successFired = false;
  private consecutiveFailures = 0;
  private lastHintText = '';
  private startedAt = 0;
  private autoZoomApplied = false;
  private maxZoom = 1;
  private zoomLevel = 1;
  private torchOn = false;

  constructor(video: HTMLVideoElement, callbacks: ImeiScannerCallbacks) {
    this.video = video;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.successFired = false;
    this.consecutiveFailures = 0;
    this.lastHintText = '';
    this.autoZoomApplied = false;
    this.releaseStream();
    this.setStatus('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ScannerError(
        'This browser does not support camera access. Please enter the IMEI manually.'
      );
    }

    const constructor = getDetectorConstructor();
    if (!constructor) {
      throw new ScannerError(
        'Barcode detection is not available on this browser. Please enter the IMEI manually.'
      );
    }

    try {
      ensureBarcodeEngineReady();
      const formats = await resolveFormats(constructor);
      this.detector = new constructor({ formats });
    } catch (err) {
      throw mapCameraError(err);
    }

    const stream = await this.acquireStream();
    this.stream = stream;
    this.track = stream.getVideoTracks()[0] ?? null;

    this.video.srcObject = stream;
    this.video.setAttribute('playsinline', 'true');
    this.video.muted = true;
    try {
      await this.video.play();
    } catch {
      // Autoplay may be rejected until the permission prompt is resolved;
      // the decode loop waits for frames regardless.
    }

    if (this.stopped) {
      this.releaseStream();
      return;
    }

    if (this.track) {
      this.inspectCapabilities(this.track);
      void this.applyContinuousFocus(this.track);
    }

    this.prepareCanvas();
    this.setStatus('scanning');
    this.startedAt = performance.now();
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  stop(): void {
    this.stopped = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.releaseStream();
    this.detector = null;
    this.setStatus('idle');
  }

  async toggleTorch(): Promise<boolean> {
    if (!this.track || !this.torchSupported) return false;
    try {
      await this.track.applyConstraints({
        advanced: [{ torch: !this.torchOn }] as unknown as MediaTrackConstraintSet[],
      });
      this.torchOn = !this.torchOn;
      return true;
    } catch {
      return false;
    }
  }

  async adjustZoom(delta: number): Promise<number> {
    if (!this.track || !this.zoomSupported) return this.zoomLevel;
    const target = Math.min(this.maxZoom, Math.max(1, this.zoomLevel + delta));
    try {
      await this.track.applyConstraints({
        advanced: [{ zoom: target }] as unknown as MediaTrackConstraintSet[],
      });
      this.zoomLevel = target;
    } catch {
      // Keep the previous level.
    }
    return this.zoomLevel;
  }

  private setStatus(status: ScannerStatus): void {
    this.callbacks.onStatusChange?.(status);
  }

  private async acquireStream(): Promise<MediaStream> {
    const attempts: Array<MediaTrackConstraints | boolean> = [
      {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'environment' },
      true,
    ];

    let lastError: unknown = null;
    for (const video of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (err) {
        lastError = err;
        const name = (err as { name?: string })?.name ?? '';
        if (
          name === 'OverconstrainedError' ||
          name === 'ConstraintNotSatisfiedError'
        ) {
          continue;
        }
        throw mapCameraError(err);
      }
    }
    throw mapCameraError(lastError);
  }

  private inspectCapabilities(track: MediaStreamTrack): void {
    if (typeof track.getCapabilities !== 'function') return;
    try {
      const caps = track.getCapabilities() as unknown as CameraCapabilities;
      this.torchSupported = Boolean(caps.torch);
      this.zoomSupported = Boolean(caps.zoom);
      this.maxZoom = caps.zoom?.max ?? 1;
    } catch {
      // Non-fatal.
    }
  }

  private async applyContinuousFocus(track: MediaStreamTrack): Promise<void> {
    if (typeof track.applyConstraints !== 'function') return;
    try {
      const caps = track.getCapabilities() as unknown as CameraCapabilities;
      const advanced: Array<Record<string, unknown>> = [];
      if (caps.focusMode?.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (caps.exposureMode?.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }
      if (caps.whiteBalanceMode?.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }
      if (advanced.length > 0) {
        await track.applyConstraints({
          advanced: advanced as unknown as MediaTrackConstraintSet[],
        });
      }
    } catch {
      // Non-fatal.
    }
  }

  private prepareCanvas(): void {
    if (!this.canvas) {
      const canvas = document.createElement('canvas');
      this.canvas = canvas;
      this.canvasContext = canvas.getContext('2d', { willReadFrequently: true });
    }
    const canvas = this.canvas;
    const context = this.canvasContext;
    if (!canvas || !context) return;

    const videoWidth = this.video.videoWidth || 1280;
    const videoHeight = this.video.videoHeight || 720;
    const scale = Math.min(1, MAX_PROCESS_WIDTH / Math.max(videoWidth, videoHeight));
    canvas.width = Math.max(2, Math.round(videoWidth * scale));
    canvas.height = Math.max(2, Math.round(videoHeight * scale));
  }

  private tick = (): void => {
    if (this.stopped) return;
    this.rafId = requestAnimationFrame(this.tick);
    if (this.decodeInFlight) return;
    const now = performance.now();
    if (now - this.lastDecodeAt < DECODE_INTERVAL_MS) return;
    this.lastDecodeAt = now;
    this.maybeApplyAutoZoom();
    void this.runDecodePass();
  };

  private maybeApplyAutoZoom(): void {
    if (this.autoZoomApplied || !this.zoomSupported || this.maxZoom <= 1) return;
    if (performance.now() - this.startedAt < AUTO_ZOOM_AFTER_MS) return;
    if (this.consecutiveFailures < 15) return;
    this.autoZoomApplied = true;
    void this.adjustZoom(0.6);
  }

  private async runDecodePass(): Promise<void> {
    if (this.stopped || this.successFired || this.decodeInFlight) return;
    this.decodeInFlight = true;
    try {
      await this.decodeFrame();
    } finally {
      this.decodeInFlight = false;
    }
  }

  private async decodeFrame(): Promise<void> {
    if (this.stopped || this.successFired) return;
    const video = this.video;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const canvas = this.canvas;
    const context = this.canvasContext;
    if (!canvas || !context || !this.detector) return;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const outWidth = canvas.width;
    const outHeight = canvas.height;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (this.consecutiveFailures > 8) {
      sw = Math.round(sourceWidth * CENTER_CROP_RATIO);
      sh = Math.round(sourceHeight * CENTER_CROP_RATIO);
      sx = Math.round((sourceWidth - sw) / 2);
      sy = Math.round((sourceHeight - sh) / 2);
    }

    const previousFilter = context.filter;
    if (this.consecutiveFailures > 14) {
      context.filter = 'brightness(1.12) contrast(1.06)';
    }

    context.imageSmoothingEnabled = true;
    context.drawImage(video, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
    context.filter = previousFilter;

    let imageData: ImageData;
    try {
      imageData = context.getImageData(0, 0, outWidth, outHeight);
    } catch {
      return;
    }

    let results: DetectedCode[] = [];
    try {
      results = await this.detector.detect(imageData);
    } catch {
      this.handleEngineFailure();
      return;
    }

    if (this.stopped || this.successFired) return;

    if (results.length === 0) {
      this.consecutiveFailures += 1;
      return;
    }

    for (const code of results) {
      const imei = extractImeiFromText(code.rawValue);
      if (imei) {
        this.handleSuccess(imei, code.format);
        return;
      }
      this.emitHintForCode(code);
    }
    this.consecutiveFailures += 1;
  }

  private emitHintForCode(code: DetectedCode): void {
    const hint = `Scanned a ${code.format || 'barcode'} that is not a valid IMEI. Keep the IMEI label centered or enter it manually.`;
    if (hint === this.lastHintText) return;
    this.lastHintText = hint;
    this.callbacks.onHint?.(hint);
  }

  private handleEngineFailure(): void {
    if (this.stopped) return;
    this.stop();
    this.setStatus('error');
    this.callbacks.onError?.(
      'Barcode detection engine failed to start. Please enter the IMEI manually.'
    );
  }

  private handleSuccess(imei: string, format: string): void {
    if (this.successFired || this.stopped) return;
    this.successFired = true;
    this.stop();
    this.callbacks.onScan?.({ imei, format });
  }

  private releaseStream(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.track = null;
    if (this.video.srcObject) {
      this.video.srcObject = null;
    }
  }
}
