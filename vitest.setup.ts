import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// jsdom は location.hash をテスト間で保持し続けるため、あるテストで開いたハッシュが
// 次のテストの SmartPhoto 構築時に「ハッシュ復元」として誤って再オープンされることがある。
// 各テストの開始前に必ずクリアする
beforeEach(() => {
  window.history.replaceState(null, '', `${location.pathname}${location.search}`);
});

// jsdom環境でのモック設定
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// window.scrollのモック
window.scroll = vi.fn();

// TouchEventのモック
class TouchEventMock {
  type: string;
  touches: unknown[];
  changedTouches: unknown[];
  targetTouches: unknown[];

  constructor(
    type: string,
    options: { touches?: unknown[]; changedTouches?: unknown[]; targetTouches?: unknown[] } = {},
  ) {
    this.type = type;
    this.touches = options.touches || [];
    this.changedTouches = options.changedTouches || [];
    this.targetTouches = options.targetTouches || [];
  }
}

(global as unknown as { TouchEvent: unknown }).TouchEvent = TouchEventMock;

// DeviceOrientationEventのモック
class DeviceOrientationEventMock {
  type: string;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;

  constructor(type: string, options: { alpha?: number; beta?: number; gamma?: number } = {}) {
    this.type = type;
    this.alpha = options.alpha ?? null;
    this.beta = options.beta ?? null;
    this.gamma = options.gamma ?? null;
  }
}

(global as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent =
  DeviceOrientationEventMock;

// ResizeObserverのモック
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserverのモック
(global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = vi
  .fn()
  .mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

// requestAnimationFrameのモック
global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => setTimeout(cb, 0)) as unknown as typeof requestAnimationFrame;
global.cancelAnimationFrame = vi.fn();

// Element.prototype.scrollIntoViewのモック
Element.prototype.scrollIntoView = vi.fn();

// window.pageXOffsetとwindow.pageYOffsetのモック
Object.defineProperty(window, 'pageXOffset', {
  writable: true,
  value: 0,
});

Object.defineProperty(window, 'pageYOffset', {
  writable: true,
  value: 0,
});

// HTMLDialogElement.close() / showModal() のモック。
// dialog.open を唯一の真実として扱う設計(§8)の前提となるよう、実ブラウザに近い
// 挙動(2重 showModal() は InvalidStateError、close() は 'close' イベント発火)を再現する
HTMLDialogElement.prototype.showModal = function showModal() {
  if (this.open) {
    throw new DOMException(
      "Failed to execute 'showModal' on 'HTMLDialogElement': The element already has an 'open' attribute, and therefore cannot be opened modally.",
      'InvalidStateError',
    );
  }
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function close() {
  if (!this.open) {
    return;
  }
  this.removeAttribute('open');
  // 仕様上 close() は 'close' イベント(非バブリング/キャンセル不可)を発火する。
  // アプリ側はこのイベントを購読して isOpen 状態を同期しているため再現する
  this.dispatchEvent(new Event('close'));
};

// window.Image のモック。実ブラウザ相当の非同期ロードを、内部実装(groupItems 等)に
// 依存せず契約テストから再現できるようにする(§11.2 の前提: 契約テストは公開APIと
// DOM だけに依存する)。src を設定すると次のマイクロタスクで onload が発火し、
// 既定の width/height(800x600)を返す。読み込み失敗を検証したいテストは
// window.Image を個別に上書きすればよい
class ImageMock {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 0;
  height = 0;
  #src = '';

  get src(): string {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    if (!value) {
      return;
    }
    queueMicrotask(() => {
      this.width = 800;
      this.height = 600;
      this.onload?.();
    });
  }
}

(global as unknown as { Image: unknown }).Image = ImageMock;
