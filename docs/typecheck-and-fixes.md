# Typechecking and fixing your code

airgen detects type errors and helps fix code affected by Airtable schema changes. Both features work with JavaScript and TypeScript.

## Typechecking

`block run` doesn't typecheck your code. airgen fills that gap by running your project's TypeScript compiler after every schema update.

Results appear in the `<SchemaObserver />` panel:

- **Types OK** — No errors found.
- **Type errors** — Expand to see errors with file names and line numbers.
- **Unavailable** — TypeScript isn't installed or configured.

Install TypeScript if needed:

```sh
npm i -D typescript @types/react
```

airgen uses your project's own TypeScript installation and configuration. It never bundles a compiler.

## TypeScript configuration

airgen automatically creates a recommended `tsconfig.json` if your extension doesn't have one.

If your existing config needs changes, the observer shows a warning with a suggested fix.

Run:

```sh
npx airgen fix-tsconfig
```

This fixes common issues with JSX, JavaScript files, module resolution, and missing source directories. Other settings are preserved.

The default configuration looks like this:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "allowJs": true,
    "checkJs": true,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["frontend"]
}
```

**Note:** Extensions inside monorepos use their own configuration. You can use `extends` to share settings with the parent project.

## Automatic code fixes

When you rename a field or table in Airtable, references in your code may become outdated.

Enable automatic fix suggestions with:

```sh
npx airgen --fix
```

Or in `airgen-config.json`:

```json
{
  "fix": true
}
```

airgen tracks schema changes by Airtable record IDs and identifies affected code.

| Schema change | Action |
|---|---|
| Field renamed | Updates field references |
| Table renamed | Updates table references and types |
| Select option renamed | Updates matching values |
| Generated type renamed | Updates type references |
| Field or table deleted | Reports affected code |
| Field type changed | Reports affected code |

Available fixes appear in the observer panel with an **Apply** button.

Only verified references are modified. Changes that require manual decisions are reported but never automatically rewritten.

After applying a fix, airgen runs the typecheck again.

**Note:** Fixes modify your source files. Use Git to review or undo changes. Automatic fixes require TypeScript 6 or earlier. Typechecking remains available with TypeScript 7.

## JavaScript support

You don't need to write TypeScript to use these features.

airgen supports `.js` and `.jsx` files through JSDoc and TypeScript's `checkJs` option.

For JavaScript projects, you can use a `jsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2020",
    "moduleResolution": "bundler",
    "checkJs": true
  },
  "include": ["frontend"]
}
```

**Important:** Enable `"checkJs": true` to report errors in JavaScript files. Automatic fixes work regardless of this setting.

## Diagnostics API

The daemon exposes `GET /diagnostics` for typecheck results and configuration warnings.

When `--fix` is enabled, `GET /fixes` lists available fixes and `POST /apply-fix` applies a selected fix.
