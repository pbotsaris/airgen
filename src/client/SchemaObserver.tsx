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

interface DiagnosticsError {
   file: string
   line: number
   col: number
   code: string
   message: string
}

/** Payload of the daemon's GET /diagnostics (absent on older daemons). */
interface DiagnosticsPayload {
   status: 'ok' | 'errors' | 'checking' | 'unavailable'
   errors: DiagnosticsError[]
   total: number
   checkedAt: string | null
   reason?: string
}

interface FixUsage {
   file: string
   line: number
}

interface PendingFix {
   id: string
   kind: string
   severity: 'breaking' | 'warning' | 'info'
   fixable: boolean
   description: string
   from: string
   to: string | null
   files: string[]
   editCount: number
   usages: FixUsage[]
}

/** Payload of GET /fixes (404s unless the daemon was started with --fix). */
interface FixesPayload {
   status: 'idle' | 'analyzing' | 'ready' | 'unavailable'
   reason: string | null
   fixes: PendingFix[]
}

/** Delays between polls while the daemon reports work in flight. */
const DIAGNOSTICS_POLL_DELAYS_MS = [
   0, 500, 1000, 2000, 3000, 3000, 3000, 3000, 3000, 3000,
]

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
      const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(
         null,
      )
      const [fixes, setFixes] = useState<FixesPayload | null>(null)
      const [applying, setApplying] = useState(false)
      const lastSentSignature = useRef<string | null>(null)
      const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
      // A 404 means an older daemon without /diagnostics — stop asking.
      const diagnosticsSupported = useRef(true)
      // A 404 here means --fix is off, which is the default. Stop asking.
      const fixesSupported = useRef(true)
      // Bumped on every new poll and on unmount so stale poll loops cancel.
      const pollGeneration = useRef(0)
      const fixPollGeneration = useRef(0)

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

      // Re-fetches /diagnostics until the daemon settles out of 'checking'.
      // Each call claims a new generation; older loops see the bump and stop.
      const pollDiagnostics = useCallback(async () => {
         if (!diagnosticsSupported.current) return
         const generation = ++pollGeneration.current

         for (const delay of DIAGNOSTICS_POLL_DELAYS_MS) {
            if (delay > 0) {
               await new Promise((resolve) => setTimeout(resolve, delay))
            }
            if (generation !== pollGeneration.current) return

            try {
               const res = await fetch(`${daemonUrl}/diagnostics`)
               if (res.status === 404) {
                  diagnosticsSupported.current = false
                  return
               }
               if (!res.ok) return
               const payload = (await res.json()) as DiagnosticsPayload
               if (generation !== pollGeneration.current) return
               setDiagnostics(payload)
               if (payload.status !== 'checking') return
            } catch {
               return
            }
         }
      }, [daemonUrl])

      // Same shape as the diagnostics poll: settle once the daemon stops
      // reporting work in flight, and let a newer poll cancel an older one.
      const pollFixes = useCallback(async () => {
         if (!fixesSupported.current) return
         const generation = ++fixPollGeneration.current

         for (const delay of DIAGNOSTICS_POLL_DELAYS_MS) {
            if (delay > 0) {
               await new Promise((resolve) => setTimeout(resolve, delay))
            }
            if (generation !== fixPollGeneration.current) return

            try {
               const res = await fetch(`${daemonUrl}/fixes`)
               if (res.status === 404) {
                  fixesSupported.current = false
                  return
               }
               if (!res.ok) return
               const payload = (await res.json()) as FixesPayload
               if (generation !== fixPollGeneration.current) return
               setFixes(payload)
               if (payload.status !== 'analyzing') return
            } catch {
               return
            }
         }
      }, [daemonUrl])

      const applyFix = useCallback(
         async (body: { id: string } | { all: true }) => {
            setApplying(true)
            try {
               await fetch(`${daemonUrl}/apply-fix`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
               })
            } catch {
               // The refreshed lists below tell the story either way.
            } finally {
               setApplying(false)
            }
            pollFixes()
            pollDiagnostics()
         },
         [daemonUrl, pollFixes, pollDiagnostics],
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
         pollDiagnostics()
         pollFixes()
         return () => {
            cancelled = true
            pollGeneration.current++
            fixPollGeneration.current++
         }
      }, [daemonUrl, enabled, pollDiagnostics, pollFixes])

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
               pollDiagnostics()
               pollFixes()
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
      }, [signature, enabled, daemonUrl, debounceMs, base, pollDiagnostics, pollFixes])

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
            <DiagnosticsDetails diagnostics={diagnostics} />
            <FixesDetails fixes={fixes} applying={applying} onApply={applyFix} />
            <button type='button' style={buttonStyle} onClick={copyToClipboard}>
               {copied ? 'Copied!' : 'Copy schema'}
            </button>
         </div>
      )
   }

   return SchemaObserver
}

const MAX_DRIFT_LINES = 5
const MAX_DIAGNOSTIC_LINES = 3

function DiagnosticsDetails({
   diagnostics,
}: {
   diagnostics: DiagnosticsPayload | null
}): React.ReactElement | null {
   // null (no data yet / old daemon) and 'unavailable' both render nothing —
   // typechecking is an optional extra, not a required part of the strip.
   if (!diagnostics) return null

   if (diagnostics.status === 'checking') {
      return <span style={{ ...textStyle, color: '#666666' }}>… typechecking</span>
   }
   if (diagnostics.status === 'ok') {
      return <span style={{ ...textStyle, color: '#048a0e' }}>✓ types ok</span>
   }
   if (diagnostics.status !== 'errors') return null

   return (
      <details style={textStyle}>
         <summary style={{ color: '#d33030', fontWeight: 600, cursor: 'pointer' }}>
            ✗ {diagnostics.total} type error{diagnostics.total === 1 ? '' : 's'}
         </summary>
         <div style={{ paddingTop: 4, color: '#333333' }}>
            {diagnostics.errors.slice(0, MAX_DIAGNOSTIC_LINES).map((error, index) => (
               <div key={index}>
                  {error.file}:{error.line} — {truncate(error.message, 120)}
               </div>
            ))}
            {diagnostics.total > MAX_DIAGNOSTIC_LINES && (
               <div>+{diagnostics.total - MAX_DIAGNOSTIC_LINES} more</div>
            )}
         </div>
      </details>
   )
}

function truncate(text: string, max: number): string {
   return text.length > max ? `${text.slice(0, max)}…` : text
}

const MAX_USAGE_LINES = 4

/**
 * Pending schema fixes. Renders nothing unless the daemon was started with
 * --fix (it 404s otherwise) and something in the code is actually affected.
 */
function FixesDetails({
   fixes,
   applying,
   onApply,
}: {
   fixes: FixesPayload | null
   applying: boolean
   onApply: (body: { id: string } | { all: true }) => void
}): React.ReactElement | null {
   if (!fixes || fixes.fixes.length === 0) return null

   const fixable = fixes.fixes.filter((fix) => fix.fixable)
   const summary =
      fixable.length > 0
         ? `${fixes.fixes.length} schema change${fixes.fixes.length === 1 ? '' : 's'} affect your code · ${fixable.length} fixable`
         : `${fixes.fixes.length} schema change${fixes.fixes.length === 1 ? '' : 's'} affect your code`

   return (
      <details style={textStyle}>
         <summary
            style={{ color: '#8250df', fontWeight: 600, cursor: 'pointer' }}
         >
            {summary}
         </summary>
         <div style={{ paddingTop: 4, color: '#333333' }}>
            {fixable.length > 1 && (
               <button
                  type='button'
                  style={{ ...buttonStyle, marginBottom: 4 }}
                  disabled={applying}
                  onClick={() => onApply({ all: true })}
               >
                  Fix all {fixable.length}
               </button>
            )}
            {fixes.fixes.map((fix) => (
               <div key={fix.id} style={{ paddingBottom: 4 }}>
                  <span>{fix.description}</span>
                  {fix.fixable
                     ? (
                        <button
                           type='button'
                           style={{ ...buttonStyle, marginLeft: 6 }}
                           disabled={applying}
                           onClick={() => onApply({ id: fix.id })}
                        >
                           Apply ({fix.editCount} in {fix.files.length} file
                           {fix.files.length === 1 ? '' : 's'})
                        </button>
                     )
                     : (
                        <div style={{ color: '#666666', paddingLeft: 8 }}>
                           {fix.usages.slice(0, MAX_USAGE_LINES).map((usage, index) => (
                              <div key={index}>
                                 {usage.file}:{usage.line}
                              </div>
                           ))}
                           {fix.usages.length > MAX_USAGE_LINES && (
                              <div>+{fix.usages.length - MAX_USAGE_LINES} more</div>
                           )}
                        </div>
                     )}
               </div>
            ))}
         </div>
      </details>
   )
}

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


