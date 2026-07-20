import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { GuestSession } from '@/api/types';

const sessionKey = 'imaginelab.child-session.v1';

export const childSessionStorage = {
  async load(): Promise<GuestSession | null> {
    const stored = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(sessionKey) ?? null
      : await SecureStore.getItemAsync(sessionKey);
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isGuestSession(parsed)) return parsed;
    } catch {
      // Remove legacy or damaged values instead of using an unvalidated token.
    }
    await this.clear();
    return null;
  },

  async save(session: GuestSession): Promise<void> {
    const value = JSON.stringify(session);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(sessionKey, value);
      return;
    }
    await SecureStore.setItemAsync(sessionKey, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(sessionKey);
      return;
    }
    await SecureStore.deleteItemAsync(sessionKey);
  },
};

function isGuestSession(value: unknown): value is GuestSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<GuestSession>;
  const user = session.user;
  return (
    typeof session.token === 'string' &&
    session.token.length >= 32 &&
    !!user &&
    user.role === 'child' &&
    typeof user.id === 'string' &&
    typeof user.displayName === 'string' &&
    typeof user.childId === 'string' &&
    typeof user.linked === 'boolean'
  );
}
