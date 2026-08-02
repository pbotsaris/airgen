/**
 * Dev-only panel that keeps ./airtable-schema.ts in sync with the live base.
 *
 * Efficiency gates, in order:
 *   1. `useWatchable(base, ['schema'])` — this component re-renders only on
 *      schema mutations (never on record/cell data changes). Keep it a leaf.
 *   2. Schema signature comparison — no-op renders (or schema events that
 *      don't affect generated types) skip regeneration entirely.
 *   3. Debounce — rapid-fire schema edits cost one generation + POST, not N.
 *
 * In a released extension (non-localhost origin) the browser blocks requests
 * to localhost, so the panel just shows "disconnected" — but you should
 * remove it (or set enabled={false}) before releasing anyway.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useBase, useWatchable, Box, Button, Text} from '@airtable/blocks/ui';
import {generateTypeScriptFromBase} from './generator.js';
import {computeSchemaSignature} from './schema-signature.js';

export interface SchemaObserverProps {
  /** Where the airgen daemon is listening. */
  daemonUrl?: string;
  /** Quiet period after the last schema event before generating + syncing. */
  debounceMs?: number;
  /** Disable all work (e.g. in production builds). */
  enabled?: boolean;
}

type DaemonStatus = 'unknown' | 'connected' | 'disconnected';

export function SchemaObserver({
  daemonUrl = 'http://localhost:3001',
  debounceMs = 500,
  enabled = true,
}: SchemaObserverProps): React.ReactElement | null {
  const base = useBase();
  useWatchable(base, ['schema']);

  const [status, setStatus] = useState<DaemonStatus>('unknown');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastSentSignature = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signature = enabled ? computeSchemaSignature(base) : null;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`${daemonUrl}/health`)
      .then(response => {
        if (!cancelled) setStatus(response.ok ? 'connected' : 'disconnected');
      })
      .catch(() => {
        if (!cancelled) setStatus('disconnected');
      });
    return () => {
      cancelled = true;
    };
  }, [daemonUrl, enabled]);

  useEffect(() => {
    if (!enabled || signature === null || signature === lastSentSignature.current) {
      return;
    }
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      debounceTimer.current = null;
      // Generate inside the debounced callback: N rapid edits, 1 generation.
      const code = generateTypeScriptFromBase(base);
      try {
        const response = await fetch(`${daemonUrl}/save-schema`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({code, signature, tableCount: base.tables.length}),
        });
        if (response.ok) {
          lastSentSignature.current = signature;
          setLastSyncedAt(new Date().toLocaleTimeString());
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      } catch {
        setStatus('disconnected');
      }
    }, debounceMs);
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [signature, enabled, daemonUrl, debounceMs, base]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateTypeScriptFromBase(base));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable in this context; nothing to do
    }
  }, [base]);

  if (!enabled) return null;

  const statusLabel =
    status === 'connected' ? '● Connected' : status === 'disconnected' ? '○ Disconnected' : '◌ Connecting…';
  const statusColor = status === 'connected' ? '#048a0e' : status === 'disconnected' ? '#d33030' : '#666666';

  return (
    <Box
      display="flex"
      alignItems="center"
      padding={2}
      borderBottom="thick"
      style={{gap: 12, flexWrap: 'wrap'}}
    >
      <Text size="small" style={{color: statusColor, fontWeight: 600}}>
        airgen {statusLabel}
      </Text>
      <Text size="small" textColor="light">
        {base.tables.length} table{base.tables.length === 1 ? '' : 's'}
        {lastSyncedAt ? ` · synced ${lastSyncedAt}` : status === 'disconnected' ? ' · run `npx airgen`' : ''}
      </Text>
      <Button size="small" variant="secondary" onClick={copyToClipboard}>
        {copied ? 'Copied!' : 'Copy schema'}
      </Button>
    </Box>
  );
}
