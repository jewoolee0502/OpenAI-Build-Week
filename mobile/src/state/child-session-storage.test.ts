import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GuestSession } from '@/api/types';
import { childSessionStorage } from './child-session-storage';

const secureValues = vi.hoisted(() => new Map<string, string>());

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: vi.fn(async (key: string) => secureValues.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureValues.set(key, String(value));
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureValues.delete(key);
  }),
}));

describe('child session storage', () => {
  beforeEach(() => secureValues.clear());

  it('restores both the private token and stable Child ID from this device', async () => {
    const session: GuestSession = {
      token: 'private-child-token-that-is-long-enough-1234',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'child',
        displayName: 'Guest Creator',
        childId: 'KID-ABCD-2345',
        linked: false,
      },
    };

    await childSessionStorage.save(session);

    expect(await childSessionStorage.load()).toEqual(session);
  });
});
