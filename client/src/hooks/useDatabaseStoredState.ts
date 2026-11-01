import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '@/components/ui/ToastHost';
import { useGetAppDataQuery, usePutAppDataMutation } from '@/api/appDataApi';

const MISSING = Symbol('missing');

type MergeValue = unknown | typeof MISSING;
type MergeResult = { conflict: true } | { conflict: false; value: MergeValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valuesEqual(left: MergeValue, right: MergeValue): boolean {
  if (left === MISSING || right === MISSING) return left === right;
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeConcurrentValue(base: MergeValue, local: MergeValue, remote: MergeValue): MergeResult {
  if (valuesEqual(local, base)) return { conflict: false, value: remote };
  if (valuesEqual(remote, base) || valuesEqual(local, remote)) {
    return { conflict: false, value: local };
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const hasStableIds = [base, local, remote].every((items) =>
      items.every((item) => isRecord(item) && item.id !== undefined),
    );

    if (hasStableIds) {
      const makeMap = (items: unknown[]) =>
        new Map(items.map((item) => [JSON.stringify((item as Record<string, unknown>).id), item]));
      const baseById = makeMap(base);
      const localById = makeMap(local);
      const remoteById = makeMap(remote);
      const orderedIds = [
        ...new Set([
          ...remote.map((item) => JSON.stringify((item as Record<string, unknown>).id)),
          ...local.map((item) => JSON.stringify((item as Record<string, unknown>).id)),
          ...base.map((item) => JSON.stringify((item as Record<string, unknown>).id)),
        ]),
      ];
      const mergedItems: unknown[] = [];

      for (const id of orderedIds) {
        const merged = mergeConcurrentValue(
          baseById.get(id) ?? MISSING,
          localById.get(id) ?? MISSING,
          remoteById.get(id) ?? MISSING,
        );
        if (!('value' in merged)) return { conflict: true };
        if (merged.value !== MISSING) mergedItems.push(merged.value);
      }

      return { conflict: false, value: mergedItems };
    }

    const isPrimitiveArray = [base, local, remote].every((items) =>
      items.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item)),
    );
    if (isPrimitiveArray) {
      const baseKeys = new Set(base.map((item) => JSON.stringify(item)));
      const localKeys = new Set(local.map((item) => JSON.stringify(item)));
      const remoteKeys = new Set(remote.map((item) => JSON.stringify(item)));
      const allKeys = new Set([...baseKeys, ...localKeys, ...remoteKeys]);
      const included = new Set<string>();

      for (const key of allKeys) {
        const inBase = baseKeys.has(key);
        const inLocal = localKeys.has(key);
        const inRemote = remoteKeys.has(key);
        if (inLocal === inBase) {
          if (inRemote) included.add(key);
        } else if (inRemote === inBase || inLocal === inRemote) {
          if (inLocal) included.add(key);
        } else {
          return { conflict: true };
        }
      }

      const ordered = [...remote, ...local, ...base];
      const merged = new Map<string, unknown>();
      for (const item of ordered) {
        const key = JSON.stringify(item);
        if (included.has(key) && !merged.has(key)) merged.set(key, item);
      }
      return { conflict: false, value: [...merged.values()] };
    }
  }

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const merged: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);

    for (const key of keys) {
      const result = mergeConcurrentValue(
        Object.prototype.hasOwnProperty.call(base, key) ? base[key] : MISSING,
        Object.prototype.hasOwnProperty.call(local, key) ? local[key] : MISSING,
        Object.prototype.hasOwnProperty.call(remote, key) ? remote[key] : MISSING,
      );
      if (!('value' in result)) return { conflict: true };
      if (result.value !== MISSING) merged[key] = result.value;
    }

    return { conflict: false, value: merged };
  }

  return { conflict: true };
}

export function useDatabaseStoredState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const initialValueRef = useRef(initialValue);
  const [value, setValue] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const hydratedRef = useRef(false);
  const loadFailedRef = useRef(false);
  const loadErrorReportedRef = useRef(false);
  const pendingActionsRef = useRef<SetStateAction<T>[]>([]);
  const lastSavedValueRef = useRef('');
  const lastEnqueuedValueRef = useRef('');
  const baseValueRef = useRef<unknown>(initialValue);
  const revisionRef = useRef(0);
  const currentValueRef = useRef(value);
  const conflictedRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const { showToast } = useToast();
  const { data, isSuccess, isError } = useGetAppDataQuery(key, {
    refetchOnMountOrArgChange: true,
  });
  const [putAppData] = usePutAppDataMutation();

  useEffect(() => {
    if (!isSuccess || hydratedRef.current) return;
    const storedValue = data?.value ?? initialValueRef.current;
    let hydratedValue = storedValue as T;
    for (const action of pendingActionsRef.current) {
      hydratedValue =
        typeof action === 'function'
          ? (action as (previous: T) => T)(hydratedValue)
          : action;
    }
    pendingActionsRef.current = [];
    const serialized = JSON.stringify(storedValue);
    if (serialized === undefined) {
      showToast(`Could not load saved data for "${key}".`, 'error');
      return;
    }

    hydratedRef.current = true;
    readyRef.current = true;
    lastSavedValueRef.current = serialized;
    lastEnqueuedValueRef.current = serialized;
    baseValueRef.current = storedValue;
    revisionRef.current = data?.revision ?? 0;
    setValue(hydratedValue);
    setReady(true);
  }, [data, isSuccess, key, showToast]);

  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(value);
    if (serialized === undefined || serialized === lastEnqueuedValueRef.current) return;
    lastEnqueuedValueRef.current = serialized;

    saveQueueRef.current = saveQueueRef.current.then(async () => {
      if (conflictedRef.current || serialized !== lastEnqueuedValueRef.current) return;
      const previousValue = lastSavedValueRef.current;
      try {
        const saved = await putAppData({
          key,
          value,
          expected_revision: revisionRef.current,
        }).unwrap();
        lastSavedValueRef.current = serialized;
        baseValueRef.current = saved.value ?? value;
        revisionRef.current = saved.revision;
      } catch (error) {
        const apiError = error as {
          status?: unknown;
          data?: { detail?: unknown };
        };
        const conflictDetail = apiError.data?.detail;
        if (
          apiError.status === 409 &&
          isRecord(conflictDetail) &&
          typeof conflictDetail.revision === 'number'
        ) {
          const remoteValue = conflictDetail.value ?? initialValueRef.current;
          const merged = mergeConcurrentValue(
            baseValueRef.current,
            currentValueRef.current,
            remoteValue,
          );
          baseValueRef.current = remoteValue;
          revisionRef.current = conflictDetail.revision;
          lastSavedValueRef.current = JSON.stringify(remoteValue) ?? '';
          lastEnqueuedValueRef.current = lastSavedValueRef.current;

          if (!('value' in merged) || merged.value === MISSING) {
            conflictedRef.current = true;
            showToast(
              `Another user changed "${key}" at the same time. Your unsaved changes are still on screen; copy them, reload, and reapply.`,
              'error',
            );
            return;
          }

          setValue(merged.value as T);
          showToast(`Merged concurrent changes to "${key}"; saving the combined data.`, 'info');
          return;
        }

        if (
          lastEnqueuedValueRef.current === serialized &&
          JSON.stringify(currentValueRef.current) === serialized &&
          previousValue
        ) {
          lastEnqueuedValueRef.current = previousValue;
          try {
            setValue(JSON.parse(previousValue) as T);
          } catch {
            showToast(`Could not restore the last saved value for "${key}".`, 'error');
          }
        }
        const detail = (error as { data?: { detail?: unknown } })?.data?.detail;
        showToast(
          typeof detail === 'string' ? detail : `Failed to save "${key}" to the database.`,
          'error',
        );
      }
    });
  }, [key, putAppData, ready, showToast, value]);

  useEffect(() => {
    if (!isError || hydratedRef.current || loadErrorReportedRef.current) return;
    loadFailedRef.current = true;
    loadErrorReportedRef.current = true;
    showToast(`Failed to load "${key}" from the database. Reload the page and try again.`, 'error');
  }, [isError, key, showToast]);

  const setDatabaseValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      if (conflictedRef.current) {
        showToast(`Reload "${key}" before making further changes.`, 'error');
        return;
      }
      if (loadFailedRef.current) {
        showToast(`Cannot change "${key}" because its database data did not load.`, 'error');
        return;
      }
      if (!readyRef.current) {
        pendingActionsRef.current.push(nextValue);
        return;
      }
      setValue(nextValue);
    },
    [key, showToast],
  );

  return [value, setDatabaseValue, ready];
}
