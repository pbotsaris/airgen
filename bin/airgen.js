#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startDaemon} from '../src/daemon/server.js';

const USAGE = `airgen — runs \`block run\` with the schema daemon alongside it

Usage:
  npx airgen [options] [-- <args for block run>]

Options:
  -p, --port <n>     Daemon port (default: 3001, or PORT env var)
  -o, --out <path>   Output file (default: ./frontend/airtable-schema.ts)
      --daemon-only  Start only the daemon; don't spawn \`block run\`
  -h, --help         Show this help

Reads airgen-config.json from the current directory if present, e.g.
{"out": "./frontend/airtable-schema.ts", "port": 3001}. CLI flags and the
PORT env var take precedence over the config file.

The daemon lives inside this process and exits when \`block run\` exits,
so nothing keeps running after you stop working. Render <SchemaObserver />
in your extension and the output file is rewritten whenever the base
schema changes.
`;

const CONFIG_FILE = 'airgen-config.json';
const CONFIG_KEYS = {out: 'string', port: 'number'};

/** @returns {{out?: string, port?: number} | null} null when no config file exists */
function loadConfig(cwd) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(cwd, CONFIG_FILE), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    process.stderr.write(`Could not read ${CONFIG_FILE}: ${error?.message ?? error}\n`);
    process.exit(1);
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`Invalid ${CONFIG_FILE}: ${error?.message ?? error}\n`);
    process.exit(1);
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    process.stderr.write(`Invalid ${CONFIG_FILE}: expected a JSON object\n`);
    process.exit(1);
  }
  for (const [key, value] of Object.entries(config)) {
    const expected = CONFIG_KEYS[key];
    if (expected === undefined) {
      process.stderr.write(`Unknown key ${JSON.stringify(key)} in ${CONFIG_FILE} (known keys: ${Object.keys(CONFIG_KEYS).join(', ')})\n`);
      process.exit(1);
    }
    if (typeof value !== expected) {
      process.stderr.write(`Invalid ${CONFIG_FILE}: ${JSON.stringify(key)} must be a ${expected}\n`);
      process.exit(1);
    }
  }
  return config;
}

function parseArgs(argv) {
  const options = {};
  const blockArgs = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      blockArgs.push(...argv.slice(i + 1));
      break;
    } else if (arg === '-h' || arg === '--help') {
      process.stdout.write(USAGE);
      process.exit(0);
    } else if (arg === '-p' || arg === '--port') {
      options.port = Number(argv[++i]);
    } else if (arg === '-o' || arg === '--out') {
      options.outPath = argv[++i];
    } else if (arg === '--daemon-only') {
      options.daemonOnly = true;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n\n${USAGE}`);
      process.exit(1);
    }
  }
  return {options, blockArgs};
}

const {options, blockArgs} = parseArgs(process.argv.slice(2));
const daemonOnly = options.daemonOnly === true;
delete options.daemonOnly;
if (options.port === undefined && process.env.PORT) {
  options.port = Number(process.env.PORT);
}
const config = loadConfig(process.cwd());
if (config) {
  const applied = [];
  if (options.port === undefined && config.port !== undefined) {
    options.port = config.port;
    applied.push('port');
  }
  if (options.outPath === undefined && config.out !== undefined) {
    options.outPath = config.out;
    applied.push('out');
  }
  if (applied.length > 0) {
    console.log(`[airgen] Applying ${CONFIG_FILE} (${applied.join(', ')})`);
  }
}
if (options.port !== undefined && (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)) {
  process.stderr.write('Invalid port\n');
  process.exit(1);
}
if (options.outPath === undefined) {
  delete options.outPath;
}

try {
  await startDaemon(options);
} catch (error) {
  if (error?.code === 'EADDRINUSE') {
    process.stderr.write(`Port already in use — is another airgen daemon running? (${error.message})\n`);
  } else {
    process.stderr.write(`${error?.message ?? error}\n`);
  }
  process.exit(1);
}

if (!daemonOnly) {
  const child = spawn('block', ['run', ...blockArgs], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('error', error => {
    if (error?.code === 'ENOENT') {
      process.stderr.write(
        '`block` CLI not found. Install it (npm install -g @airtable/blocks-cli),\n' +
          'or run `npx airgen --daemon-only` alongside your own `block run`.\n'
      );
    } else {
      process.stderr.write(`Failed to start \`block run\`: ${error?.message ?? error}\n`);
    }
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    process.exit(signal !== null ? 1 : code ?? 0);
  });

  // Ctrl-C reaches `block run` directly via the terminal's process group;
  // stay alive until it finishes shutting down, then exit via the handler above.
  process.on('SIGINT', () => {});
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGHUP', () => child.kill('SIGHUP'));
}
