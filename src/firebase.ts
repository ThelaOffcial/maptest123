import { initializeApp } from 'firebase/app';
import { getDatabase, ref, update } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCHWxJQPNKk6aD3NLx6Bu6eAHj3EQS66v8',
  authDomain: 'grade01-34e91.firebaseapp.com',
  databaseURL: 'https://grade01-34e91-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'grade01-34e91',
  storageBucket: 'grade01-34e91.firebasestorage.app',
  messagingSenderId: '497178015045',
  appId: '1:497178015045:web:d29d452809274c4e25ba2c',
  measurementId: 'G-LGQGGC538T',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const admissionsRef = ref(db, 'grade1_admissions_2026');

export async function ensureAuth() {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (err) {
    console.warn('Firebase anonymous auth:', err);
  }
}

export interface DistanceMarksPayload {
  distanceMarks: number;
  distanceMaxMarks: number;
  distanceCategory: string;
  distanceRoadKm?: number | null;
}

/**
 * Save the distance-check marks directly onto one applicant record, e.g.
 * grade1_admissions_2026/<sheetKey>/applicants/<applicantKey>.
 * Only the distance* fields are written; nothing else on the record is touched.
 */
export async function saveDistanceMarks(
  sheetKey: string,
  applicantKey: string,
  payload: DistanceMarksPayload
): Promise<void> {
  await ensureAuth();
  const data: Record<string, unknown> = {
    distanceMarks: payload.distanceMarks,
    distanceMaxMarks: payload.distanceMaxMarks,
    distanceCategory: payload.distanceCategory,
    distanceSavedAt: new Date().toISOString(),
  };
  if (payload.distanceRoadKm != null) data.distanceRoadKm = payload.distanceRoadKm;
  await update(ref(db, `grade1_admissions_2026/${sheetKey}/applicants/${applicantKey}`), data);
}
