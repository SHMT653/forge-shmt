// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  acquireBarcodeStream,
  CameraError,
  describeCameraError,
  releaseBarcodeStream,
  resetBarcodeCamera,
} from '@/services/barcodeCamera';

/**
 * The scanner used to fire up to four getUserMedia calls per open and refused
 * any camera whose label looked like a front camera. That combination meant:
 * repeated permission prompts on the phone, and on a laptop (single "FaceTime
 * HD Camera") a scanner that never started at all.
 *
 * These tests pin both down: how often we may ask, and what we accept.
 */

type Settings = { deviceId?: string; facingMode?: string };

function fakeTrack(label: string, settings: Settings) {
  return {
    kind: 'video',
    label,
    readyState: 'live' as 'live' | 'ended',
    enabled: true,
    stop() {
      this.readyState = 'ended';
    },
    getSettings: () => settings,
    getCapabilities: () => ({}),
    applyConstraints: () => Promise.resolve(),
  };
}

function fakeStream(label: string, settings: Settings) {
  const track = fakeTrack(label, settings);
  return {
    id: `${label}:${settings.deviceId ?? ''}`,
    track,
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream & { track: ReturnType<typeof fakeTrack> };
}

function domError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

const REAR = { label: 'Back Camera', deviceId: 'rear-1', facingMode: 'environment' };
const FRONT = { label: 'FaceTime HD Camera', deviceId: 'front-1', facingMode: 'user' };

function installMediaDevices(mediaDevices: Partial<MediaDevices>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: mediaDevices,
  });
}

function secureContext(secure: boolean) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure });
}

beforeEach(() => {
  resetBarcodeCamera();
  window.localStorage.clear();
  secureContext(true);
});

describe('acquireBarcodeStream', () => {
  it('asks exactly once on a phone with a rear camera', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(REAR.label, REAR));
    const enumerateDevices = vi.fn().mockResolvedValue([]);
    installMediaDevices({ getUserMedia, enumerateDevices } as unknown as MediaDevices);

    await acquireBarcodeStream();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    // Devices are only enumerated after a grant, and only when we did not
    // already land on the rear camera.
    expect(enumerateDevices).not.toHaveBeenCalled();
    const constraints = getUserMedia.mock.calls[0][0] as MediaStreamConstraints;
    expect(constraints.video).toMatchObject({ facingMode: { ideal: 'environment' } });
  });

  it('keeps the only camera of a laptop instead of refusing it', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(FRONT.label, FRONT));
    const enumerateDevices = vi.fn().mockResolvedValue([{ kind: 'videoinput', deviceId: FRONT.deviceId, label: FRONT.label }]);
    installMediaDevices({ getUserMedia, enumerateDevices } as unknown as MediaDevices);

    const stream = await acquireBarcodeStream();

    expect(stream.getVideoTracks()[0].label).toBe(FRONT.label);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('switches to the rear camera when the first grant was the front one', async () => {
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(fakeStream(FRONT.label, FRONT))
      .mockResolvedValueOnce(fakeStream(REAR.label, REAR));
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: FRONT.deviceId, label: FRONT.label },
      { kind: 'videoinput', deviceId: REAR.deviceId, label: REAR.label },
    ]);
    installMediaDevices({ getUserMedia, enumerateDevices } as unknown as MediaDevices);

    const stream = await acquireBarcodeStream();

    expect(stream.getVideoTracks()[0].label).toBe(REAR.label);
    // The second call runs on an already granted permission - no new prompt.
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem('forge.barcode.camera-device')).toBe(REAR.deviceId);
  });

  it('goes straight to the remembered camera on the next open', async () => {
    window.localStorage.setItem('forge.barcode.camera-device', REAR.deviceId);
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(REAR.label, REAR));
    installMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } as unknown as MediaDevices);

    await acquireBarcodeStream();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    const constraints = getUserMedia.mock.calls[0][0] as MediaStreamConstraints;
    expect(constraints.video).toMatchObject({ deviceId: { exact: REAR.deviceId } });
  });

  it('forgets a camera that no longer exists and falls back', async () => {
    window.localStorage.setItem('forge.barcode.camera-device', 'gone');
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(domError('OverconstrainedError'))
      .mockResolvedValueOnce(fakeStream(REAR.label, REAR));
    installMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } as unknown as MediaDevices);

    const stream = await acquireBarcodeStream();

    expect(stream.getVideoTracks()[0].label).toBe(REAR.label);
    expect(window.localStorage.getItem('forge.barcode.camera-device')).toBe(REAR.deviceId);
  });

  it('does not ask a second time after a denial', async () => {
    window.localStorage.setItem('forge.barcode.camera-device', REAR.deviceId);
    const getUserMedia = vi.fn().mockRejectedValue(domError('NotAllowedError'));
    installMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } as unknown as MediaDevices);

    await expect(acquireBarcodeStream()).rejects.toMatchObject({ kind: 'denied' });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('reuses the running stream instead of requesting a new one', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(REAR.label, REAR));
    installMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } as unknown as MediaDevices);

    const first = await acquireBarcodeStream();
    releaseBarcodeStream();
    expect(first.getVideoTracks()[0].enabled).toBe(false);

    const second = await acquireBarcodeStream();

    expect(second).toBe(first);
    expect(second.getVideoTracks()[0].enabled).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('hands the camera back on an immediate release', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(REAR.label, REAR));
    installMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } as unknown as MediaDevices);

    const first = await acquireBarcodeStream();
    releaseBarcodeStream({ immediate: true });

    expect(first.getVideoTracks()[0].readyState).toBe('ended');

    await acquireBarcodeStream();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('names http as the problem instead of blaming the camera', async () => {
    secureContext(false);
    const getUserMedia = vi.fn();
    installMediaDevices({ getUserMedia } as unknown as MediaDevices);

    const error = await acquireBarcodeStream().catch((caught: CameraError) => caught);

    expect(error).toBeInstanceOf(CameraError);
    expect((error as CameraError).kind).toBe('insecure');
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(describeCameraError(error)).toContain('https');
  });
});

describe('describeCameraError', () => {
  it('tells a blocked permission apart from a missing camera', () => {
    expect(describeCameraError(domError('NotAllowedError'))).toContain('blockiert');
    expect(describeCameraError(domError('NotFoundError'))).toContain('Keine passende Kamera');
    expect(describeCameraError(domError('NotReadableError'))).toContain('anderen App');
  });
});
