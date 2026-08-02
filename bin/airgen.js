#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { startDaemon } from '../src/daemon/server.js'

const USAGE = `airgen — runs \`block run\` with the schema daemon alongside it

Usage:
  npx airgen [options] [-- <args for block run>]

Options:
  -p, --port <n>     Daemon port (default: 3001, or PORT env var)
  -o, --out <path>   Output file (default: ./frontend/airtable-schema.ts)
      --daemon-only  Start only the daemon; don't spawn \`block run\`
      --fix          Offer to rewrite your code when a rename breaks it
  -h, --help         Show this help

Reads airgen-config.json from the current directory if present, e.g.
{"out": "./frontend/airtable-schema.ts", "port": 3001}. CLI flags and the
PORT env var take precedence over the config file.

The daemon lives inside this process and exits when \`block run\` exits,
so nothing keeps running after you stop working. Render <SchemaObserver />
in your extension and the output file is rewritten whenever the base
schema changes.
`

/**

 * @typedef {object} AirgenConfig
 * @property {string} [out]
 * @property {number} [port]

 */

/**

 * @typedef {object} AirgenOptions
 * @property {number} [port]
 * @property {string} [outPath]
 * @property {boolean} [daemonOnly]

 */

/**

 * @typedef {object} ParsedArgs
 * @property {AirgenOptions} options
 * @property {string[]} blockArgs
 */

/**

 * @typedef {'string' | 'number'} ConfigValueType

 */

const CONFIG_FILE = 'airgen-config.json'
const CONFIG_KEYS = { out: 'string', port: 'number', fix: 'boolean' }

function loadRawConfigFile(cwd) {
   try {
      return fs.readFileSync(path.join(cwd, CONFIG_FILE), 'utf8')
   } catch (error) {
      if (error?.code === 'ENOENT') return null

      process.stderr.write(
         `Could not read ${CONFIG_FILE}: ${error?.message ?? error}\n`,
      )
      process.exit(1)
   }
}

function parseConfig(raw) {
   if (raw === null) return null

   try {
      return JSON.parse(raw)
   } catch (error) {
      process.stderr.write(`Invalid ${CONFIG_FILE}: ${error?.message ?? error}\n`)
      process.exit(1)
   }
}

/** @returns {{out?: string, port?: number} | null} null when no config file exists */
function loadConfig(cwd) {
   const raw = loadRawConfigFile(cwd)
   // No config file at all is the common case, not an error — defaults apply.
   if (raw === null) return null

   const config = parseConfig(raw)

   if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      process.stderr.write(`Invalid ${CONFIG_FILE}: expected a JSON object\n`)
      process.exit(1)
   }

   for (const [key, value] of Object.entries(config)) {
      const expected = CONFIG_KEYS[key]

      if (expected === undefined) {
         process.stderr.write(
            `Unknown key ${JSON.stringify(key)} in ${CONFIG_FILE} (known keys: ${Object.keys(CONFIG_KEYS).join(', ')})\n`,
         )
         process.exit(1)
      }

      if (typeof value !== expected) {
         process.stderr.write(
            `Invalid ${CONFIG_FILE}: ${JSON.stringify(key)} must be a ${expected}\n`,
         )
         process.exit(1)
      }
   }
   return config
}

function parseArgs(argv) {
   const options = {}
   const blockArgs = []

   for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]

      switch (arg) {
         case '--':
            blockArgs.push(...argv.slice(i + 1))
            return { options, blockArgs }

         case '-h':
         case '--help':
            process.stdout.write(USAGE)
            process.exit(0)

         case '-p':
         case '--port':
            options.port = Number(argv[++i])
            break

         case '-o':
         case '--out':
            options.outPath = argv[++i]
            break

         case '--daemon-only':
            options.daemonOnly = true
            break

         case '--fix':
            options.fix = true
            break

         default:
            process.stderr.write(`Unknown argument: ${arg}\n\n${USAGE}`)
            process.exit(1)
      }
   }

   return { options, blockArgs }
}

function applyConfig(config, opts) {
   const applied = []
   const options = { ...opts }

   if (options.port === undefined && config.port !== undefined) {
      options.port = config.port
      applied.push('port')
   }

   if (options.outPath === undefined && config.out !== undefined) {
      options.outPath = config.out
      applied.push('out')
   }

   if (options.fix === undefined && config.fix !== undefined) {
      options.fix = config.fix
      applied.push('fix')
   }

   if (applied.length > 0) {
      console.log(`[airgen] Applying ${CONFIG_FILE} (${applied.join(', ')})`)
   }

   return options
}

/** An absent port is fine — the daemon's own default applies. */
function isPortValid(port) {
   if (port === undefined) return true
   if (!Number.isInteger(port)) return false

   return port >= 0 && port <= 65535
}

function logPortError(error) {
   if (error?.code === 'EADDRINUSE') {
      const msg = `Port already in use — is another airgen daemon running? (${error.message})\n`
      process.stderr.write(msg)
      return
   }

   process.stderr.write(`${error?.message ?? error}\n`)
}

function logDaemonError(error) {
   if (error?.code === 'ENOENT') {
      const msg =
         '`block` CLI not found. Install it (npm install -g @airtable/blocks-cli),\n' +
         'or run `npx airgen --daemon-only` alongside your own `block run`.\n'

      process.stderr.write(msg)
      return
   }
   process.stderr.write(
      `Failed to start \`block run\`: ${error?.message ?? error}\n`,
   )
}

let { options, blockArgs } = parseArgs(process.argv.slice(2))

const daemonOnly = options.daemonOnly === true
delete options.daemonOnly

if (options.port === undefined && process.env.PORT) {
   options.port = Number(process.env.PORT)
}

const config = loadConfig(process.cwd())
options = config ? applyConfig(config, options) : options

if (!isPortValid(options.port)) {
   process.stderr.write('Invalid port\n')
   process.exit(1)
}

if (options.outPath === undefined) delete options.outPath

try {
   await startDaemon(options)
} catch (error) {
   logPortError(error)
   process.exit(1)
}

if (!daemonOnly) {
   const child = spawn('block', ['run', ...blockArgs], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
   })

   child.on('error', (error) => {
      logDaemonError(error)
      process.exit(1)
   })

   child.on('exit', (code, signal) => {
      process.exit(signal !== null ? 1 : (code ?? 0))
   })

   // Ctrl-C reaches `block run` directly via the terminal's process group;
   // stay alive until it finishes shutting down, then exit via the handler above.
   process.on('SIGINT', () => { })
   process.on('SIGTERM', () => child.kill('SIGTERM'))
   process.on('SIGHUP', () => child.kill('SIGHUP'))
}
