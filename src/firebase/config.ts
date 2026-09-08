import admin from 'firebase-admin';
import { EnvironmentConfig } from '../config/environment';
import { logger } from '../utils/logger';

let app: admin.app.App | null = null;

/**
 * Initializes the Firebase Admin SDK using service-account credentials
 * supplied entirely through environment variables (never a committed JSON
 * file). Safe to call multiple times — the app is created once and reused.
 */
export function initializeFirebase(env: EnvironmentConfig): admin.app.App {
  if (app) return app;

  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
      }),
      storageBucket: env.firebaseStorageBucket,
    });
    logger.info('Firebase Admin SDK initialized', {
      projectId: env.firebaseProjectId,
      storageBucket: env.firebaseStorageBucket,
    });
    return app;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', error);
    throw new Error('Firebase initialization failed. Check FIREBASE_* environment variables.');
  }
}

export function getDb(): admin.firestore.Firestore {
  if (!app) throw new Error('Firebase has not been initialized yet');
  return app.firestore();
}

export function getBucket(): ReturnType<admin.storage.Storage['bucket']> {
  if (!app) throw new Error('Firebase has not been initialized yet');
  return app.storage().bucket();
}
