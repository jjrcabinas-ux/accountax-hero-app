/**
 * Who's signed in on this phone and which books are open.
 *
 * Sign-in: the web app (already past password/Google + SMS or a passkey)
 * shows a one-time code; the phone trades it at /api/mobile-link/redeem for a
 * Firebase custom token, plus the business that was open on the web and the
 * person's role in it. That choice is remembered on the phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInWithCustomToken, signOut as fbSignOut } from 'firebase/auth';
import { useSyncExternalStore } from 'react';

import { attachBooks, booksVersion, detachBooks, subscribeBooks, syncStatus, type Role } from '@/books/sync';

import { auth, WEB_APP_URL } from './firebase';

type Link = { uid: string; firm: string; role: Role };
const LINK_KEY = 'ath:mobile-link';

export type SessionState =
  | { status: 'starting' }
  | { status: 'signedOut' }
  | { status: 'loading'; email: string | null }
  | { status: 'ready'; email: string | null; role: Role }
  | { status: 'blocked'; email: string | null; message: string };

let authKnown = false;
let link: Link | null = null;
let email: string | null = null;
let pending: Omit<Link, 'uid'> | null = null;

const listeners = new Set<() => void>();
let cached: SessionState = { status: 'starting' };
let cachedAt = -1;

function compute(): SessionState {
  if (!authKnown) return { status: 'starting' };
  if (!link) return { status: 'signedOut' };
  const s = syncStatus();
  if (!s.ready) return { status: 'loading', email };
  if (s.errors.length) {
    const denied = s.errors.some(([, m]) => /permission/i.test(m));
    return {
      status: 'blocked',
      email,
      message: denied
        ? "These books can't be opened from this account right now. The plan may have lapsed, or you were signed out of all devices. Open the web app to check, then connect the phone again."
        : `Couldn't load your books: ${s.errors[0][1]}`,
    };
  }
  return { status: 'ready', email, role: link.role };
}

function snapshot(): SessionState {
  const v = booksVersion();
  if (v !== cachedAt) {
    const next = compute();
    if (JSON.stringify(next) !== JSON.stringify(cached)) cached = next;
    cachedAt = v;
  }
  return cached;
}

const notify = () => {
  cachedAt = -1;
  listeners.forEach((l) => l());
};
subscribeBooks(notify);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    link = null;
    email = null;
    detachBooks();
    authKnown = true;
    notify();
    return;
  }
  email = user.email;
  let next: Link | null = null;
  if (pending) {
    next = { uid: user.uid, ...pending };
    pending = null;
    await AsyncStorage.setItem(LINK_KEY, JSON.stringify(next));
  } else {
    const raw = await AsyncStorage.getItem(LINK_KEY);
    const saved = raw ? (JSON.parse(raw) as Link) : null;
    next = saved && saved.uid === user.uid ? saved : { uid: user.uid, firm: user.uid, role: 'owner' };
  }
  link = next;
  attachBooks(next.firm, next.role);
  authKnown = true;
  notify();
});

export function useSession(): SessionState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot,
  );
}

/** Accepts "ABCD2345", "abcd 2345" or the QR's accountaxhero://link?code=… */
export function parseLinkCode(input: string): string | null {
  const fromUri = input.match(/[?&]code=([A-Za-z0-9]+)/);
  const code = (fromUri ? fromUri[1] : input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === 8 ? code : null;
}

export async function signInWithLinkCode(code: string): Promise<void> {
  const res = await fetch(`${WEB_APP_URL}/api/mobile-link/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; firm?: string; role?: Role; error?: string };
  if (!res.ok || !data.token || !data.firm) throw new Error(data.error || "Couldn't reach AccounTax Hero. Check your connection.");
  pending = { firm: data.firm, role: data.role ?? 'owner' };
  try {
    await signInWithCustomToken(auth, data.token);
  } catch (e) {
    pending = null;
    throw e;
  }
}

export async function signOut() {
  await AsyncStorage.removeItem(LINK_KEY);
  await fbSignOut(auth);
}
