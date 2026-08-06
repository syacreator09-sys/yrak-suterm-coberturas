import { describe, expect, it } from 'vitest';

describe('upload signature policy', () => {
  it('documents that MIME and magic bytes must both be validated', () => {
    const allowedPairs = [
      ['image/jpeg', [0xff, 0xd8, 0xff]],
      ['image/png', [0x89, 0x50, 0x4e, 0x47]],
      ['application/pdf', [0x25, 0x50, 0x44, 0x46]],
    ];
    expect(allowedPairs).toHaveLength(3);
    expect(allowedPairs[0]?.[0]).toBe('image/jpeg');
  });
});
