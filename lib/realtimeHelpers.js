import { supabase } from './supabaseClient';
import { useEffect, useRef } from 'react';

/**
 * Subscribe to real-time changes on a table.
 * Automatically cleans up on unmount.
 *
 * @param {string} table - Table name to watch
 * @param {function} callback - Called with payload on insert/update/delete
 * @param {string} [event='*'] - 'INSERT' | 'UPDATE' | 'DELETE' | '*'
 * @param {object} [filter] - Optional filter { property, value, type }
 *
 * NOTE: Supabase Realtime must be enabled for the table in the Supabase dashboard:
 *   Database → Replication → enable replication for the specified table.
 */
export function useRealtimeSubscription(table, callback, event = '*', filter = null, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter: `${filter.property}=eq.${filter.value}` } : {}),
        },
        (payload) => {
          callbackRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter?.property, filter?.value, enabled]);
}

/**
 * Subscribe to real-time changes on a specific row.
 *
 * @param {string} table - Table name to watch
 * @param {string|null} rowId - Row ID to watch (null = no subscription)
 * @param {function} callback - Called with payload on insert/update/delete
 * @param {string} [event='*'] - 'INSERT' | 'UPDATE' | 'DELETE' | '*'
 */
export function useRealtimeRow(table, rowId, callback, event = '*') {
  return useRealtimeSubscription(
    table,
    callback,
    event,
    rowId ? { property: 'id', value: rowId } : null
  );
}
