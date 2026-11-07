/**
 * Firebase for the phone app — the same project as the web app
 * (kontabooks-app), so one account and one set of books.
 * The web config is public by design; security comes from Auth + rules.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

import { makeAuth } from './firebase-auth';

const config = {
  apiKey: 'AIzaSyBYcDZypROb_ED5p73IlIpNz5YZte5y3c8',
  authDomain: 'kontabooks-app.firebaseapp.com',
  projectId: 'kontabooks-app',
  storageBucket: 'kontabooks-app.firebasestorage.app',
  messagingSenderId: '1000329988382',
  appId: '1:1000329988382:web:5ee8bca350c8b2ed95a10f',
};

/** The web app — the phone-link API lives there. */
export const WEB_APP_URL = 'https://accountaxhero.com';

const firstInit = getApps().length === 0;
export const app = firstInit ? initializeApp(config) : getApp();
export const auth = makeAuth(app);
// Records written from the phone may carry optional fields left undefined, exactly like the web's.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
