/**
 * Dev-only panel that keeps ./airtable-schema.ts in sync with the live base.
 *
 * Efficiency gates, in order:
 *   1. `sdk.useWatchable(base, ['schema'])` — this component re-renders only
 *      on schema mutations (never on record/cell data changes). Keep it a leaf.
 *   2. Schema signature comparison — no-op renders (or schema events that
 *      don't affect generated types) skip regeneration entirely.
 *   3. Debounce — rapid-fire schema edits cost one generation + POST, not N.
 *
 * In a released extension (non-localhost origin) the browser blocks requests
 * to localhost, so the panel just shows "disconnected" — but you should
 * remove it (or set enabled={false}) before releasing anyway.
 *
 * Built via `createSchemaObserver(sdk)` so each entry point can bind its SDK
 * flavor's hooks (see sdk.ts). Rendered with plain DOM elements, not the
 * Blocks component library — the interface SDK doesn't ship one.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateTypeScriptFromBase } from './generator.js'
import { computeSchemaSignature } from './schema-signature.js'
import { checkSchemaDrift } from './schema-drift.js'
import type { DriftMetaLike, DriftReport } from './schema-drift.js'
import type { BlocksSdkAdapter } from './sdk.js'

export interface SchemaObserverProps {
   /** Where the airgen daemon is listening. */
   daemonUrl?: string
   /** Quiet period after the last schema event before generating + syncing. */
   debounceMs?: number
   /** Disable all work (e.g. in production builds). */
   enabled?: boolean
   /**
    * Pass `airgenMeta` from your generated file to surface schema drift
    * (deleted/renamed tables and fields, type changes) in the panel.
    */
   meta?: DriftMetaLike
}

export interface SchemaObserverConfig {
   /** Module the generated file imports `createTypedHooks` from (default 'airgen'). */
   hooksModule?: string
}

type DaemonStatus = 'unknown' | 'connected' | 'disconnected'

const panelStyle: React.CSSProperties = {
   display: 'flex',
   alignItems: 'center',
   gap: 12,
   flexWrap: 'wrap',
   padding: 8,
   borderBottom: '2px solid #e0e0e0',
   fontFamily: 'inherit',
}

const textStyle: React.CSSProperties = { fontSize: 11, lineHeight: '14px' }

const buttonStyle: React.CSSProperties = {
   ...textStyle,
   fontWeight: 500,
   padding: '4px 8px',
   border: 'none',
   borderRadius: 3,
   background: 'rgba(0, 0, 0, 0.05)',
   color: '#333333',
   cursor: 'pointer',
}

export function createSchemaObserver(
   sdk: BlocksSdkAdapter,
   config: SchemaObserverConfig = {},
): (props: SchemaObserverProps) => React.ReactElement | null {
   const generatorOptions = { hooksModule: config.hooksModule }

   function SchemaObserver({
      daemonUrl = 'http://localhost:3001',
      debounceMs = 500,
      enabled = true,
      meta,
   }: SchemaObserverProps): React.ReactElement | null {
      const base = sdk.useBase()
      sdk.useWatchable(base, ['schema'])

      const [status, setStatus] = useState<DaemonStatus>('unknown')
      const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
      const [copied, setCopied] = useState(false)
      const lastSentSignature = useRef<string | null>(null)
      const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

      // A plain string, so it's stable across renders that don't change the
      // schema — the debounce effect below depends on it by value.
      const signature = enabled ? computeSchemaSignature(base) : null

      // Render-time read keyed on the signature: state-only re-renders
      // (status, copied) never recompute, and no watcher/effect is added, so
      // the three efficiency gates above are untouched.
      const drift = useMemo<DriftReport | null>(
         () =>
            enabled && meta && signature !== null
               ? checkSchemaDrift(base, meta)
               : null,
         [signature, meta, enabled, base],
      )

      useEffect(() => {
         if (!enabled) return

         let cancelled = false

         fetch(`${daemonUrl}/health`)
            .then((response) => {
               if (!cancelled) setStatus(response.ok ? 'connected' : 'disconnected')
            })
            .catch(() => {
               if (!cancelled) setStatus('disconnected')
            })
         return () => {
            cancelled = true
         }
      }, [daemonUrl, enabled])

      useEffect(() => {
         // Nothing to do when disabled, and unchanged schemas never reach the
         // daemon — a no-op render must not cost a generation or a file write.
         if (
            !enabled ||
            signature === null ||
            signature === lastSentSignature.current
         ) {
            return
         }

         if (debounceTimer.current !== null) clearTimeout(debounceTimer.current)

         debounceTimer.current = setTimeout(async () => {
            debounceTimer.current = null

            // Generate inside the debounced callback: N rapid edits, 1 generation.
            const code = generateTypeScriptFromBase(base, generatorOptions)

            try {
               const res = await fetch(`${daemonUrl}/save-schema`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                     code,
                     signature,
                     tableCount: base.tables.length,
                  }),
               })

               if (!res.ok) {
                  setStatus('disconnected')
                  return
               }

               lastSentSignature.current = signature
               setLastSyncedAt(new Date().toLocaleTimeString())
               setStatus('connected')
            } catch {
               setStatus('disconnected')
            }
         }, debounceMs)

         // cleanup
         return () => {
            if (debounceTimer.current !== null) {
               clearTimeout(debounceTimer.current)
               debounceTimer.current = null
            }
         }
      }, [signature, enabled, daemonUrl, debounceMs, base])

      const copyToClipboard = useCallback(async () => {
         try {
            await navigator.clipboard.writeText(
               generateTypeScriptFromBase(base, generatorOptions),
            )
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
         } catch {
            // nothing to do
         }
      }, [base])

      if (!enabled) return null

      const statusDisplay = getStatusDisplay(status)

      return (
         <div style={panelStyle}>
            <span
               style={{ ...textStyle, color: statusDisplay.color, fontWeight: 600 }}
            >
               airgen {statusDisplay.label}
            </span>
            <span style={{ ...textStyle, color: '#666666' }}>
               {base.tables.length} table{base.tables.length === 1 ? '' : 's'}
               {lastSyncedAt
                  ? ` · synced ${lastSyncedAt}`
                  : status === 'disconnected'
                     ? ' · run `npx airgen`'
                     : ''}
            </span>
            {drift && !drift.ok && <DriftDetails drift={drift} />}
            <button type='button' style={buttonStyle} onClick={copyToClipboard}>
               {copied ? 'Copied!' : 'Copy schema'}
            </button>
         </div>
      )
   }

   return SchemaObserver
}

const MAX_DRIFT_LINES = 5

/** One collapsed line in the strip; <details> expands without any state. */
function DriftDetails({ drift }: { drift: DriftReport }): React.ReactElement {
   const parts: string[] = []
   if (drift.counts.breaking > 0) parts.push(`${drift.counts.breaking} breaking`)
   if (drift.counts.warning > 0) parts.push(`${drift.counts.warning} warning`)
   if (drift.counts.info > 0) parts.push(`${drift.counts.info} renamed`)
   const color =
      drift.counts.breaking > 0
         ? '#d33030'
         : drift.counts.warning > 0
            ? '#b58a00'
            : '#666666'

   return (
      <details style={textStyle}>
         <summary style={{ color, fontWeight: 600, cursor: 'pointer' }}>
            drift: {parts.join(' · ')}
         </summary>
         <div style={{ paddingTop: 4, color: '#333333' }}>
            {drift.findings.slice(0, MAX_DRIFT_LINES).map((finding, index) => (
               <div key={index}>{finding.message}</div>
            ))}
            {drift.findings.length > MAX_DRIFT_LINES && (
               <div>+{drift.findings.length - MAX_DRIFT_LINES} more</div>
            )}
         </div>
      </details>
   )
}

function getStatusDisplay(status: DaemonStatus): {
   label: string
   color: string
} {
   switch (status) {
      case 'connected':
         return {
            label: '● Connected',
            color: '#048a0e',
         }

      case 'disconnected':
         return {
            label: '○ Disconnected',
            color: '#d33030',
         }

      default:
         return {
            label: '◌ Connecting…',
            color: '#666666',
         }
   }
}


