import { beforeEach, vi } from 'vitest';

// Tests never reach the network: any fetch (e.g. to VNPay) fails unless a test mocks the answer.
beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network is disabled in tests; mock fetch'));
});
