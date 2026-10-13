// jest-expo supplies a native window without a browser screen. React Aria's
// test-only keyboard polyfill expects the screen object to exist.
if (typeof window !== 'undefined' && !window.screen) {
  Object.defineProperty(window, 'screen', {
    configurable: true,
    value: { orientation: { angle: 0 } },
  });
}
