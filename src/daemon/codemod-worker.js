/**
 * Rename analysis for the airgen codemod. Runs as a CHILD PROCESS of the
 * daemon: `findRenameLocations` has no CLI, so this is in-process TypeScript —
 * but in a process the daemon can outlive, mirroring `typecheck.js`. A whole
 * `Program` for a large consumer project stays out of the daemon's heap and is
 * returned to the OS when this exits.
 *
 * Protocol: a job JSON arrives on stdin, a result JSON leaves on stdout.
 *   job:    {cwd, configPath, generatedFile, previousSource, changes[]}
 *   result: {ok, plans: [{changeId, edits[], usages[], skipped?}], reason?}
 *
 * The generated file on disk is already the NEW one (it was written first, so
 * hot reload isn't delayed). The LanguageServiceHost therefore serves the
 * PREVIOUS text for that path — consumer code still spells the old names, so
 * the old symbols have to still resolve for references to be found at all.
 */

import path from 'node:path';
import {createRequire} from 'node:module';

/** Files the codemod is allowed to touch. */
const EDITABLE = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (raw += chunk));
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

/**
 * A LanguageService over the consumer's project, driven by their tsconfig.json
 * or jsconfig.json.
 *
 * `allowJs` is forced on: the generated hooks are explicitly usable from plain
 * `.js` files, so those must be in the program or renames silently miss them.
 * Forcing it in `options` afterwards is not enough — `parseJsonConfigFileContent`
 * resolves the FILE LIST from the options it is given, and only counts `.js`
 * as a source file when allowJs is on there. So it goes in as `existingOptions`
 * (which win over the config), and the config path goes in too, so a file named
 * jsconfig.json gets its implied defaults.
 * This program exists ONLY for rename analysis — diagnostics stay with tsc.
 */
function createService(ts, {configPath, overlayPath, overlaySource}) {
  const tsconfigDir = path.dirname(configPath);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) return null;

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, tsconfigDir, {allowJs: true}, configPath);
  const options = {...parsed.options, allowJs: true, checkJs: false, noEmit: true};

  const fileNames = new Set(parsed.fileNames.map(file => path.resolve(file)));
  fileNames.add(path.resolve(overlayPath));

  const versions = new Map();
  const snapshots = new Map();

  const readFile = fileName => {
    if (path.resolve(fileName) === path.resolve(overlayPath)) return overlaySource;
    return ts.sys.readFile(fileName);
  };

  const host = {
    getScriptFileNames: () => [...fileNames],
    getScriptVersion: fileName => String(versions.get(fileName) ?? 0),
    getScriptSnapshot(fileName) {
      if (snapshots.has(fileName)) return snapshots.get(fileName);
      const contents = readFile(fileName);
      const snapshot = contents === undefined ? undefined : ts.ScriptSnapshot.fromString(contents);
      snapshots.set(fileName, snapshot);
      return snapshot;
    },
    getCurrentDirectory: () => tsconfigDir,
    getCompilationSettings: () => options,
    getDefaultLibFileName: opts => ts.getDefaultLibFilePath(opts),
    fileExists: fileName =>
      path.resolve(fileName) === path.resolve(overlayPath) || ts.sys.fileExists(fileName),
    readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };

  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

/** Position of `name` declared as a member of `interfaceName`, or -1. */
function findPropertyPosition(ts, sourceFile, interfaceName, propertyName) {
  let position = -1;

  const visit = node => {
    if (position !== -1) return;
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        const name = member.name;
        if (!name) continue;
        const text = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
        if (text === propertyName) {
          position = name.getStart(sourceFile);
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return position;
}

/** Position of a top-level `interface X`/`type X` declaration name, or -1. */
function findTypeDeclarationPosition(ts, sourceFile, typeName) {
  for (const statement of sourceFile.statements) {
    if (
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      statement.name.text === typeName
    ) {
      return statement.name.getStart(sourceFile);
    }
  }
  return -1;
}

function isEditable(fileName, generatedFile) {
  if (path.resolve(fileName) === path.resolve(generatedFile)) return false; // already regenerated
  return EDITABLE.has(path.extname(fileName));
}

/**
 * Rename locations for a symbol declared in the generated file, as edits.
 * Locations inside the generated file itself are dropped — it was rewritten
 * from the schema, not patched.
 */
function renameEdits(ts, service, {fileName, position, newText, generatedFile}) {
  if (position < 0) return [];
  const locations = service.findRenameLocations(fileName, position, false, false, {
    providePrefixAndSuffixTextForRename: true,
  });
  if (!locations) return [];

  const edits = [];
  for (const location of locations) {
    if (!isEditable(location.fileName, generatedFile)) continue;
    edits.push({
      fileName: location.fileName,
      start: location.textSpan.start,
      length: location.textSpan.length,
      // Shorthand destructuring (`const {oldKey} = fields`) needs the prefix so
      // the local binding keeps its name instead of silently changing.
      newText: `${location.prefixText ?? ''}${newText}${location.suffixText ?? ''}`,
    });
  }
  return edits;
}

/** Every source file the analysis may edit (skips node_modules and the generated file). */
function editableSourceFiles(ts, program, generatedFile) {
  return program
    .getSourceFiles()
    .filter(file => !file.isDeclarationFile)
    .filter(file => !file.fileName.includes('/node_modules/'))
    .filter(file => isEditable(file.fileName, generatedFile));
}

/**
 * String-literal rewrites, gated on the type checker rather than text matching.
 * `accept(node)` decides whether a literal really is the symbol we mean; when
 * the checker can't confirm it, we skip — under-fixing is the right failure
 * mode, since the typecheck panel will still surface anything left behind.
 */
function literalEdits(ts, program, {generatedFile, oldText, newText, accept}) {
  const edits = [];

  for (const sourceFile of editableSourceFiles(ts, program, generatedFile)) {
    const visit = node => {
      if (ts.isStringLiteral(node) && node.text === oldText && accept(node, sourceFile)) {
        edits.push({
          fileName: sourceFile.fileName,
          // The span is the literal's contents, quotes excluded.
          start: node.getStart(sourceFile) + 1,
          length: node.getWidth(sourceFile) - 2,
          newText,
        });
        return;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  return edits;
}

/** The expression a string literal is being compared against, if any. */
function comparisonSubject(ts, node) {
  const parent = node.parent;
  if (!parent) return null;

  if (ts.isBinaryExpression(parent)) {
    const operator = parent.operatorToken.kind;
    const isEquality =
      operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operator === ts.SyntaxKind.EqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsToken;
    if (!isEquality) return null;
    return parent.left === node ? parent.right : parent.left;
  }

  if (ts.isCaseClause(parent) && parent.expression === node) {
    const switchStatement = parent.parent?.parent;
    if (switchStatement && ts.isSwitchStatement(switchStatement)) return switchStatement.expression;
  }

  return null;
}

/** Builds the edit/usage plan for one change. */
function planChange(ts, service, program, checker, job, change) {
  const {generatedFile, previousSource} = job;
  const generated = program.getSourceFile(generatedFile);
  if (!generated) return {changeId: change.id, edits: [], usages: [], skipped: 'generated file not in program'};

  switch (change.kind) {
    case 'field-key-renamed': {
      const position = findPropertyPosition(ts, generated, change.recordInterface, change.from);
      return {
        changeId: change.id,
        edits: renameEdits(ts, service, {
          fileName: generatedFile,
          position,
          newText: change.to,
          generatedFile,
        }),
        usages: [],
      };
    }

    case 'type-name-renamed': {
      const position = findTypeDeclarationPosition(ts, generated, change.from);
      return {
        changeId: change.id,
        edits: renameEdits(ts, service, {
          fileName: generatedFile,
          position,
          newText: change.to,
          generatedFile,
        }),
        usages: [],
      };
    }

    case 'table-key-renamed': {
      // Table keys live in call arguments (`useRecords('Projects')`), which
      // rename doesn't reach. Accept a literal only when its contextual type
      // comes from the generated TableRecordMap keys.
      const edits = literalEdits(ts, program, {
        generatedFile,
        oldText: change.from,
        newText: change.to,
        accept: node => {
          if (!node.parent || !ts.isCallExpression(node.parent)) return false;
          if (!node.parent.arguments.includes(node)) return false;
          const contextual = checker.getContextualType(node);
          if (!contextual) return false;
          const constraint = checker.getBaseConstraintOfType?.(contextual) ?? contextual;
          const candidates = constraint.isUnion?.() ? constraint.types : [constraint];
          return candidates.some(
            candidate => candidate.isStringLiteral?.() && candidate.value === change.from,
          );
        },
      });
      return {changeId: change.id, edits, usages: []};
    }

    case 'choice-name-renamed': {
      if (!change.choiceAlias) {
        return {changeId: change.id, edits: [], usages: [], skipped: 'no choice alias to gate on'};
      }
      const edits = literalEdits(ts, program, {
        generatedFile,
        oldText: change.from,
        newText: change.to,
        accept: node => {
          const subject = comparisonSubject(ts, node);
          if (!subject) return false;
          const type = checker.getTypeAtLocation(subject);
          return typeMentionsChoiceName(ts, checker, type, change.from);
        },
      });
      return {changeId: change.id, edits, usages: []};
    }

    default: {
      // Not mechanically fixable: locate the usages so they can be listed.
      const position =
        change.kind === 'table-removed'
          ? findTypeDeclarationPosition(ts, generated, change.recordInterface)
          : findPropertyPosition(ts, generated, change.recordInterface, change.oldFieldKey ?? change.from);
      return {changeId: change.id, edits: [], usages: findUsages(ts, service, generatedFile, position, job)};
    }
  }
}

/**
 * True when `type` is a string-literal type equal to `choiceName`, or an object
 * type (or union thereof) whose `name` property is that literal — i.e. the
 * subject really is a generated choice value, not an unrelated string.
 */
function typeMentionsChoiceName(ts, checker, type, choiceName) {
  if (!type) return false;

  const types = type.isUnion?.() ? type.types : [type];
  return types.some(candidate => {
    if (candidate.isStringLiteral?.() && candidate.value === choiceName) return true;

    const nameProperty = candidate.getProperty?.('name');
    if (!nameProperty) return false;

    const declaration = nameProperty.valueDeclaration ?? nameProperty.declarations?.[0];
    if (!declaration) return false;

    const nameType = checker.getTypeOfSymbolAtLocation(nameProperty, declaration);
    const nameTypes = nameType?.isUnion?.() ? nameType.types : [nameType];
    return nameTypes.some(member => member?.isStringLiteral?.() && member.value === choiceName);
  });
}

/** file:line for every reference to the symbol at `position`, outside the generated file. */
function findUsages(ts, service, fileName, position, job) {
  if (position < 0) return [];
  const references = service.getReferencesAtPosition(fileName, position);
  if (!references) return [];

  const usages = [];
  for (const reference of references) {
    if (!isEditable(reference.fileName, job.generatedFile)) continue;
    const source = service.getProgram()?.getSourceFile(reference.fileName);
    if (!source) continue;
    const {line} = source.getLineAndCharacterOfPosition(reference.textSpan.start);
    usages.push({
      file: path.relative(job.cwd, reference.fileName),
      line: line + 1,
    });
  }
  return usages;
}

async function main() {
  const job = JSON.parse(await readStdin());
  const tsDir = job.typescriptDir;

  let ts;
  try {
    ts = createRequire(path.join(tsDir, 'noop.js'))('typescript');
  } catch (error) {
    process.stdout.write(JSON.stringify({ok: false, reason: `could not load typescript: ${error?.message ?? error}`}));
    return;
  }

  const service = createService(ts, {
    configPath: job.configPath,
    overlayPath: job.generatedFile,
    overlaySource: job.previousSource,
  });
  if (!service) {
    process.stdout.write(JSON.stringify({ok: false, reason: `could not read ${path.basename(job.configPath)}`}));
    return;
  }

  const program = service.getProgram();
  if (!program) {
    process.stdout.write(JSON.stringify({ok: false, reason: 'could not build a TypeScript program'}));
    return;
  }

  const checker = program.getTypeChecker();
  const plans = [];

  for (const change of job.changes) {
    try {
      plans.push(planChange(ts, service, program, checker, job, change));
    } catch (error) {
      plans.push({changeId: change.id, edits: [], usages: [], skipped: `analysis failed: ${error?.message ?? error}`});
    }
  }

  // The daemon hashes the touched files itself — it owns the apply step and
  // must be the one deciding whether a file changed under it.
  process.stdout.write(JSON.stringify({ok: true, plans}));
}

main().catch(error => {
  process.stdout.write(JSON.stringify({ok: false, reason: `${error?.message ?? error}`}));
});
