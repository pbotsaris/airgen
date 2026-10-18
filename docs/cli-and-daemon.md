# CLI, daemon, and security

## Scaffolding an extension

The SDK and React come from the extension scaffold, so you never install them by hand. For an interface extension, the hello-world template is the quickest start:

```sh
npm install -g @airtable/blocks-cli
block init NONE/<your-block-id> --template=https://github.com/Airtable/interface-extensions-hello-world <project-name>
cd <project-name>
npm install --save-dev airgen
```

`block init` takes a `<baseId>/<blockId>` identifier. Interface extensions aren't scoped to a single base, so the literal `NONE` fills that slot (the CLI accepts a base ID only if it starts with `app`, or exactly `NONE`). Get `<your-block-id>` (a `blk…` ID) from Builder Hub when you create the extension.

## Running

```sh
npx airgen                                   # daemon + `block run` in one process
npx airgen -p 3005 -o src/airtable-schema.ts # port and output path
npx airgen -- --port 9001                    # args after -- go to `block run`
npx airgen --daemon-only                     # just the daemon, run `block run` yourself
npx airgen --fix                             # also offer code fixes for renames
```

The generated file lands at `./frontend/airtable-schema.ts` by default. To change that (or the port) without flags, drop an `airgen-config.json` next to where you run airgen:

```json
{
  "out": "./frontend/src/airtable-schema.ts",
  "port": 3005,
  "fix": false
}
```

CLI flags and the `PORT` env var take precedence over the config file. The observer's `daemonUrl` prop must match the port (default `http://localhost:3001`).

The daemon is an in-process HTTP server tied to `block run`: it exits the moment `block run` exits, so stopping dev (ctrl-C) never leaves anything running.

Endpoints: `GET /health`, `POST /save-schema` (what the observer calls), `GET /diagnostics` (typecheck results), and under `--fix` only, `GET /fixes` and `POST /apply-fix`.

## Security

Any webpage you visit can fire blind cross-origin POSTs at localhost, so the daemon is deliberately locked down:

- binds `127.0.0.1` only
- the output path is fixed at startup (`--out` or `airgen-config.json`); client-supplied paths in the payload are ignored
- payloads must be bounded (< 2 MB) strings starting with the airgen header, or they're rejected without writing
- `GET /diagnostics` and `GET /fixes` are pure state reads (they never trigger work) and report cwd-relative paths only
- `POST /apply-fix` exists only under `--fix`, takes an id and nothing else, and applies only edits the daemon computed itself; paths and edits are never accepted from the request

The permissive CORS header exists because the extension iframe's origin is `airtable.com`, and is only safe because of the points above.

## Production

Remove `<SchemaObserver />` (or pass `enabled={false}`) before releasing. If it ships anyway, a released extension runs from a non-localhost origin, so browsers block the localhost request and the panel just shows "Disconnected"; nothing breaks and nothing is sent anywhere. `useSchemaDrift` (see [`examples/05-drift.tsx`](../examples/05-drift.tsx)) is the production-safe way to notice a base that changed under a released extension.
