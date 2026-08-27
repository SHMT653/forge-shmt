/**
 * barcodeCamera.ts
 *
 * Getting a camera for the barcode scanner. Two goals:
 *
 * 1. Ask for permission once, not once per attempt. The previous version fired
 *    up to four getUserMedia calls per open (device probe → tuned → untuned →
 *    rear re-request). Every one of those is a chance for the browser to prompt
 *    again, and the tuned `advanced` constraints made phones reject the request
 *    outright instead of just ignoring the hint.
 * 2. Fail with a message that says what to do. "Kamera konnte nicht gestartet
 *    werden" covers a blocked permission, a missing camera and plain http alike.
 *
 * The old code also refused every camera whose label looked like a front camera.
 * On a laptop (single "FaceTime HD Camera") that meant the scanner never
 * started at all.
 */

export type CameraErrorKind =
  | 'insecure'
  | 'unsupported'
  | 'denied'
  | 'notfound'
  | 'busy'
  | 'unknown';

export class CameraError extends Error {
  readonly kind: CameraErrorKind;

  constructor(kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
    this.kind = kind;
  }
}

type ExtendedMediaTrackConstraintSet = MediaTrackConstraintSet & {
  focusMode?: 'continuous';
  exposureMode?: 'continuous';
  whiteBalanceMode?: 'continuous';
  torch?: boolean;
};

type ExtendedMediaTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
};

/**
 * Applied to the track *after* the stream exists. Passing these to
 * getUserMedia makes some phones fail the whole request.
 */
const CAMERA_TUNING: ExtendedMediaTrackConstraintSet[] = [
  { focusMode: 'continuous' },
  { exposureMode: 'continuous' },
  { whiteBalanceMode: 'continuous' },
];

const DEVICE_MEMORY_KEY = 'forge.barcode.camera-device';

const REAR_LABEL_HINTS = ['back', 'rear', 'environment', 'rück', 'ruck', 'umgebung', 'hinten'];

let cachedStream: MediaStream | null = null;
const tunedStreams = new WeakSet<MediaStream>();

function hasLiveVideoTrack(stream: MediaStream | null): stream is MediaStream {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live'));
}

/**
 * Stopping the camera from the OS (Control Center, iOS status bar) ends the
 * track without telling us. Without this the cache would hand out a dead
 * stream on the next open and the scanner would never come back.
 */
function forgetWhenEnded(stream: MediaStream): void {
  stream.getVideoTracks().forEach((track) => {
    track.addEventListener?.('ended', () => {
      if (cachedStream === stream) cachedStream = null;
    }, { once: true });
  });
}

function setTracksEnabled(stream: MediaStream, enabled: boolean): void {
  stream.getVideoTracks().forEach((track) => {
    track.enabled = enabled;
  });
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function readRememberedDevice(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_MEMORY_KEY);
  } catch {
    return null;
  }
}

function rememberDevice(stream: MediaStream): void {
  const deviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
  try {
    if (deviceId) window.localStorage.setItem(DEVICE_MEMORY_KEY, deviceId);
  } catch {
    // Private mode without storage: we simply probe again next time.
  }
}

function forgetDevice(): void {
  try {
    window.localStorage.removeItem(DEVICE_MEMORY_KEY);
  } catch {
    // ignore
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

export function toCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;

  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new CameraError('denied', 'Camera permission was denied.');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new CameraError('notfound', 'No matching camera found.');
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError('busy', 'Camera is already in use.');
    default:
      return new CameraError('unknown', 'Camera could not be started.');
  }
}

/** German UI text for a failed camera start. */
export function describeCameraError(error: unknown): string {
  switch (toCameraError(error).kind) {
    case 'insecure':
      return 'Die Kamera braucht eine sichere Verbindung (https). Öffne FORGE über die normale Adresse, nicht über die IP.';
    case 'unsupported':
      return 'Dieser Browser gibt die Kamera nicht frei. Nutze „Barcode-Foto lesen" oder tippe die Nummer ein.';
    case 'denied':
      return 'Der Kamerazugriff ist blockiert. Erlaube die Kamera für FORGE in den Browser-Einstellungen und starte den Scanner neu.';
    case 'notfound':
      return 'Keine passende Kamera gefunden. Nutze „Barcode-Foto lesen" oder tippe die Nummer ein.';
    case 'busy':
      return 'Die Kamera wird gerade von einer anderen App benutzt. Schließe sie und starte den Scanner neu.';
    default:
      return 'Scanner konnte nicht gestartet werden. Nutze „Barcode-Foto lesen" oder tippe die Nummer ein.';
  }
}

function assertCameraAvailable(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new CameraError('unsupported', 'No browser environment.');
  }
  // Outside a secure context the browser hides mediaDevices entirely – which is
  // exactly what happens when the phone opens the dev server via http://<ip>.
  if (window.isSecureContext === false) {
    throw new CameraError('insecure', 'Camera needs a secure context.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'getUserMedia is not available.');
  }
}

function requestStream(video: MediaTrackConstraints): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...video },
  });
}

function isRearTrack(track: MediaStreamTrack): boolean {
  if (track.getSettings?.().facingMode === 'environment') return true;
  const label = track.label.toLowerCase();
  return REAR_LABEL_HINTS.some((hint) => label.includes(hint));
}

async function videoInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
  return devices.filter((device) => device.kind === 'videoinput');
}

async function requestRememberedCamera(): Promise<MediaStream | null> {
  const deviceId = readRememberedDevice();
  if (!deviceId) return null;

  try {
    return await requestStream({ deviceId: { exact: deviceId } });
  } catch (error) {
    // A denial must not trigger a second prompt – pass it straight through.
    if (toCameraError(error).kind === 'denied') throw error;
    forgetDevice();
    return null;
  }
}

/**
 * `ideal` instead of `exact`: a device without a rear camera still gets a
 * stream instead of an OverconstrainedError.
 */
function requestEnvironmentCamera(): Promise<MediaStream> {
  return requestStream({ facingMode: { ideal: 'environment' } });
}

/**
 * Device labels only become readable once permission was granted, so this runs
 * after the first successful request – never before, and never as an extra
 * prompt: the permission is already there at this point.
 */
async function preferRearCamera(stream: MediaStream): Promise<MediaStream> {
  const track = stream.getVideoTracks()[0];
  if (!track || isRearTrack(track)) return stream;

  const cameras = await videoInputs();
  if (cameras.length < 2) return stream;

  const rear = cameras.find((device) => {
    const label = device.label.toLowerCase();
    return REAR_LABEL_HINTS.some((hint) => label.includes(hint));
  });
  if (!rear || rear.deviceId === track.getSettings?.().deviceId) return stream;

  const rearStream = await requestStream({ deviceId: { exact: rear.deviceId } }).catch(() => null);
  if (!rearStream) return stream;

  stopMediaStream(stream);
  return rearStream;
}

/**
 * The camera stream for the scanner. Reuses the running stream when there is
 * one, so reopening the scanner never prompts again.
 */
export async function acquireBarcodeStream(): Promise<MediaStream> {
  if (hasLiveVideoTrack(cachedStream)) {
    setTracksEnabled(cachedStream, true);
    return cachedStream;
  }
  cachedStream = null;

  assertCameraAvailable();

  try {
    const initial = (await requestRememberedCamera()) ?? (await requestEnvironmentCamera());
    const stream = await preferRearCamera(initial);
    rememberDevice(stream);
    forgetWhenEnded(stream);
    cachedStream = stream;
    return stream;
  } catch (error) {
    throw toCameraError(error);
  }
}

/**
 * Hands the camera back. Nothing is kept warm: a reserved stream still counts
 * as "camera in use" on macOS and iOS, and a recording indicator that stays on
 * after closing the scanner is worse than one extra getUserMedia call. The
 * permission itself survives in the browser, so reopening does not prompt.
 */
export function releaseBarcodeStream(): void {
  if (!cachedStream) return;
  stopMediaStream(cachedStream);
  cachedStream = null;
}

/**
 * Focus/exposure hints; returns whether the track can drive a torch.
 *
 * Applying constraints makes the camera renegotiate, which shows up as a
 * flicker in the preview - so a reused stream is only tuned once.
 */
export async function applyCameraTuning(stream: MediaStream): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;

  if (!tunedStreams.has(stream)) {
    tunedStreams.add(stream);
    await track
      .applyConstraints({ advanced: CAMERA_TUNING } as MediaTrackConstraints)
      .catch(() => undefined);
  }

  const capabilities = track.getCapabilities?.() as ExtendedMediaTrackCapabilities | undefined;
  return Boolean(capabilities?.torch);
}

export async function setStreamTorch(stream: MediaStream | null, enabled: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  const capabilities = track.getCapabilities?.() as ExtendedMediaTrackCapabilities | undefined;
  if (!capabilities?.torch) return false;
  await track.applyConstraints({
    advanced: [{ torch: enabled }] as ExtendedMediaTrackConstraintSet[],
  } as MediaTrackConstraints);
  return true;
}

/** Test seam: drops the cached stream. */
export function resetBarcodeCamera(): void {
  stopMediaStream(cachedStream);
  cachedStream = null;
}
