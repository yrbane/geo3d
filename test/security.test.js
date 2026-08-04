'use strict';
// Regression test for a reflected-XSS fix: `?shapes=` / `?preset=` were
// echoed verbatim into `Geo3D#info`, which index.html injects via
// `innerHTML` — so an arbitrary URL query became arbitrary HTML/JS.
// Run with: node --test test/
//
// geo3d.js is a browser-only IIFE (no module export, canvas/DOM APIs used
// at construction time), so we fake just enough of the browser to
// instantiate it headlessly. No dependencies — matches the library's own
// "zero dependencies, no build step" rule.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function makeCtx() {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set() { return true; },
  });
}

function makeCanvas() {
  return {
    width: 0, height: 0, clientWidth: 400, clientHeight: 400, style: {},
    getContext: () => makeCtx(),
  };
}

function installFakeBrowser() {
  global.window = global;
  global.innerWidth = 800;
  global.innerHeight = 600;
  global.devicePixelRatio = 1;
  global.matchMedia = () => ({ matches: false });
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.addEventListener = () => {};
  global.removeEventListener = () => {};
  global.IntersectionObserver = class { observe() {} disconnect() {} };
  global.document = {
    readyState: 'complete',
    hidden: false,
    querySelector: () => null, // skip auto-init — we instantiate manually
    createElement: () => makeCanvas(),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

installFakeBrowser();
require(path.join(__dirname, '..', 'geo3d.js'));
const Geo3D = global.Geo3D;

test('malicious ?shapes=/?preset= values never reach `info` (XSS regression)', () => {
  const g = new Geo3D(makeCanvas(), {
    quality: 1, // skip the device-hint probe (navigator), irrelevant here
    shapes: ['<img src=x onerror=alert(1)>', 'ico'],
    preset: '<script>alert(1)</script>',
  });
  assert.ok(!/[<>]/.test(g.info), `info leaked unescaped markup: ${g.info}`);
  g.destroy();
});

test('legitimate shapes/preset names still show through in `info`', () => {
  const g = new Geo3D(makeCanvas(), { quality: 1, shapes: ['cube', 'tet'], preset: 'fire', layers: 2 });
  assert.match(g.info, /fire/);
  assert.match(g.info, /cube/);
  g.destroy();
});

test('an unknown preset falls back to "custom" in `info`', () => {
  const g = new Geo3D(makeCanvas(), { quality: 1, preset: 'not-a-real-preset', layers: 1 });
  assert.match(g.info, /custom/);
  g.destroy();
});
