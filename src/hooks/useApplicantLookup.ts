import { useCallback, useEffect, useRef, useState } from 'react';
import { onValue } from 'firebase/database';
import { admissionsRef, ensureAuth } from '../firebase';

export interface ApplicantRecord {
  id: string;
  applicantNo: string;
  categoryNo: string;
  name: string;
  parentName: string;
  nicOrId: string;
  sheetName: string;
  sheetKey: string;
  applicantKey: string;
}

export type LookupResult =
  | { status: 'idle' }
  | { status: 'found'; record: ApplicantRecord }
  | { status: 'ambiguous'; count: number }
  | { status: 'not-found' };

type Status = 'loading' | 'ready' | 'error';

function toArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean) as T[];
  if (typeof value === 'object') return Object.values(value as Record<string, T>).filter(Boolean);
  return [];
}

export function normalizeKey(input: string): string {
  const cleaned = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = cleaned.match(/^([A-Z]*)0*(\d+)$/);
  if (match) return `${match[1]}${parseInt(match[2], 10)}`;
  return cleaned;
}

export function useApplicantLookup() {
  const [status, setStatus] = useState<Status>('loading');
  const [count, setCount] = useState(0);
  const byCategory = useRef<Map<string, ApplicantRecord[]>>(new Map());
  const byApplicant = useRef<Map<string, ApplicantRecord[]>>(new Map());

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    ensureAuth().then(() => {
      if (cancelled) return;
      unsubscribe = onValue(
        admissionsRef,
        (snapshot) => {
          const cat = new Map<string, ApplicantRecord[]>();
          const app = new Map<string, ApplicantRecord[]>();
          let total = 0;

          const entries = (v: unknown): [string, any][] => {
            if (!v) return [];
            if (Array.isArray(v)) return v.map((x, i) => [String(i), x] as [string, any]).filter(([, x]) => x);
            if (typeof v === 'object') return Object.entries(v as Record<string, any>).filter(([, x]) => x);
            return [];
          };
          entries(snapshot.val()).forEach(([sheetKey, sheet]) => {
            entries(sheet.applicants).forEach(([applicantKey, a]) => {
              const record: ApplicantRecord = {
                id: String(a.id ?? `${sheet.sheetName}_${total}`),
                applicantNo: String(a.applicantNo ?? ''),
                categoryNo: String(a.categoryNo ?? ''),
                name: String(a.name ?? '').trim(),
                parentName: String(a.parentName ?? '').trim(),
                nicOrId: String(a.nicOrId ?? '').trim(),
                sheetName: String(sheet.sheetName ?? ''),
                sheetKey,
                applicantKey,
              };
              total += 1;
              const push = (map: Map<string, ApplicantRecord[]>, key: string) => {
                if (!key) return;
                const list = map.get(key) ?? [];
                list.push(record);
                map.set(key, list);
              };
              push(cat, normalizeKey(record.categoryNo));
              push(app, normalizeKey(record.applicantNo));
            });
          });

          byCategory.current = cat;
          byApplicant.current = app;
          setCount(total);
          setStatus('ready');
        },
        (err) => {
          console.error('Firebase read error:', err);
          setStatus('error');
        }
      );
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const lookup = useCallback(
    (input: string): LookupResult => {
      const key = normalizeKey(input);
      if (!key) return { status: 'idle' };

      const categoryHits = byCategory.current.get(key) ?? [];
      if (categoryHits.length === 1) return { status: 'found', record: categoryHits[0] };
      if (categoryHits.length > 1) return { status: 'ambiguous', count: categoryHits.length };

      const applicantHits = byApplicant.current.get(key) ?? [];
      if (applicantHits.length === 1) return { status: 'found', record: applicantHits[0] };
      if (applicantHits.length > 1) return { status: 'ambiguous', count: applicantHits.length };

      return { status: 'not-found' };
    },
    [count]
  );

  return { status, count, lookup };
}
