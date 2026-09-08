import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

beforeEach(() => window.localStorage.clear());

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => null,
});
