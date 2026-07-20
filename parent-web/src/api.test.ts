import { describe, expect, it } from 'vitest';

import { publicGameUrl } from './api';

describe('parent API URLs', () => {
  it('opens published games on the backend host', () => {
    expect(publicGameUrl('space-penguin')).toBe('http://localhost:8080/g/space-penguin');
  });
});
