import '@testing-library/jest-dom';

// jsdom環境でのモック設定
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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
  constructor(type, options = {}) {
    this.type = type;
    this.touches = options.touches || [];
    this.changedTouches = options.changedTouches || [];
    this.targetTouches = options.targetTouches || [];
  }
}

global.TouchEvent = TouchEventMock;

// DeviceOrientationEventのモック
class DeviceOrientationEventMock {
  constructor(type, options = {}) {
    this.type = type;
    this.alpha = options.alpha || 0;
    this.beta = options.beta || 0;
    this.gamma = options.gamma || 0;
  }
}

global.DeviceOrientationEvent = DeviceOrientationEventMock;

// ResizeObserverのモック
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserverのモック
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// window.pageXOffsetとwindow.pageYOffsetのモック
Object.defineProperty(window, 'pageXOffset', {
  writable: true,
  value: 0,
});

Object.defineProperty(window, 'pageYOffset', {
  writable: true,
  value: 0,
});

// document.documentElementのモック
Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: {
    scrollLeft: 0,
    scrollTop: 0,
  },
});

// document.body.parentNodeのモック
Object.defineProperty(document.body, 'parentNode', {
  writable: true,
  value: {
    scrollLeft: 0,
    scrollTop: 0,
  },
});
