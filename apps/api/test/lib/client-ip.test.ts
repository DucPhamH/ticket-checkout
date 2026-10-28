import { describe, expect, it } from 'vitest';
import { normalizeIp } from '../../src/lib/client-ip';

describe('normalizeIp', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:192.168.1.5', '192.168.1.5'], // IPv4 written as IPv6
    ['::1', '127.0.0.1'], // too short for VNPay (needs 7–45 characters)
    ['2001:db8::8a2e:370:7334', '2001:db8::8a2e:370:7334'],
    ['', '127.0.0.1'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeIp(input)).toBe(expected);
  });
});
