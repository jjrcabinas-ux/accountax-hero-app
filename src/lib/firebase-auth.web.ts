import type { FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/** Web preview: the browser's own persistence. */
export function makeAuth(app: FirebaseApp): Auth {
  return getAuth(app);
}
