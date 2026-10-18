# CLI, daemon, and security

## Scaffolding an extension

The SDK and React come from the extension scaffold, so you never install them by hand. For an interface extension:

```sh
npm install -g @airtable/blocks-cli
block init NONE/<your-block-id> --template=https://github.com/Airtable/interface-extensions-hello-world <project-name>
cd <project-name>
npm install --save-dev airgen
```

`block init` takes a `<baseId>/<blockId>` identifier. 

## Running

```sh
npx airgen                                   # daemon + `block run` in one process
npx airgen -p 3005 -o src/airtable-schema.ts # port and output path
npx airgen -- --port 9001                    # args after -- go to `block run`
npx airgen --daemon-only                     # just the daemon, run `block run` yourself
npx airgen --fix                             # also offer code fixes for renames
npx airgen fix-tsconfig                      # create or fix the tsconfig the typecheck uses
```
### First run

On the first run, airgen creates a placeholder `airtable-schema.ts` so your extension can bundle before the schema is generated.

The placeholder contains empty metadata and table types. The first sync replaces it with the actual schema. Existing files are never overwritten.

**Note:** Hooks like `useRecords` are only available after the first sync.

### TypeScript configuration

If no `tsconfig.json` or `jsconfig.json` exists within your extension, airgen creates a recommended `tsconfig.json`.

Existing configs are left unchanged. Run `npx airgen fix-tsconfig` to update one.

See [Typechecking](typecheck-and-fixes.md#your-tsconfig).

### Configuration

By default, the generated schema is saved to `./frontend/airtable-schema.ts`.

To customize the output path, port, or automatic fixes, create an `airgen-config.json`:

```json
{
  "out": "./frontend/src/airtable-schema.ts",
  "port": 3005,
  "fix": false
}
```

CLI flags and the `PORT` environment variable override these settings.

Make sure `<SchemaObserver />` uses the same port in its `daemonUrl` prop. The default is `http://localhost:3001`.

### Daemon

The daemon runs alongside `block run` and stops automatically when you exit (`Ctrl+C`).

Available endpoints:

- `GET /health` — Check daemon status.
- `POST /save-schema` — Save the schema from the observer.
- `GET /diagnostics` — Get typecheck results.
- `GET /fixes` — List suggested fixes (`--fix` only).
- `POST /apply-fix` — Apply a fix (`--fix` only).

### Security

The daemon runs locally and includes safeguards to prevent unauthorized access or file changes:

- Binds to `127.0.0.1` only.
- Writes only to the configured output file.
- Validates incoming payloads and limits their size to 2 MB.
- Applies only internally generated fixes when `--fix` is enabled.

### Production

Remove `<SchemaObserver />` or set `enabled={false}` before releasing.

If left enabled, it simply shows "Disconnected" in production without affecting the extension.

Use `useSchemaDrift` to detect schema changes in released extensions. See [`examples/05-drift.tsx`](../examples/05-drift.tsx).

