/**
 * `useRecords(key, {include})` on the example base (Projects ↔ Tasks, People →
 * Projects), through the plain-function adapter: hydration, what gets
 * dropped, what gets skipped, and the hook-count contract.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {buildAirgenMeta} from '../dist/client/generator.js';
import {makeCreateTypedHooks} from '../dist/client/useTypedRecords.js';
import {cellText, groupRecords} from '../dist/client/runtime/index.js';
import {exampleBase} from './fixtures/example-base.js';
import {fakeAdapter, fakeBase, fakeRecord, fakeTable} from './fixtures/fake-sdk.js';

const meta = buildAirgenMeta(exampleBase);
const [projects, tasks, people] = exampleBase.tables;

const PROJECT_TASKS = 'fldProjTasks00001';
const PROJECT_TASK_NAMES = 'fldProjTaskNames1';
const TASK_TITLE = 'fldTaskTitle00001';
const TASK_PROJECT = 'fldTaskProject001';
const PERSON_PROJECTS = 'fldPersonProj0001';

function records() {
  return {
    [projects.id]: [
      fakeRecord(
        'recP1',
        {
          fldProjName000001: 'Site',
          // recT2 is a bare {id}, as right after a write; recT9 was deleted.
          [PROJECT_TASKS]: [{id: 'recT1', name: 'Write docs'}, {id: 'recT2'}, {id: 'recT9', name: 'Gone'}],
          [PROJECT_TASK_NAMES]: [{linkedRecordId: 'recT1', value: 'Write docs'}],
        },
        'Site',
      ),
      fakeRecord('recP2', {fldProjName000001: 'App'}, 'App'),
    ],
    [tasks.id]: [
      fakeRecord('recT1', {[TASK_TITLE]: 'Write docs', [TASK_PROJECT]: [{id: 'recP1', name: 'Site'}]}, 'Write docs'),
      fakeRecord('recT2', {[TASK_TITLE]: 'Ship', [TASK_PROJECT]: [{id: 'recP1', name: 'Site'}]}, 'Ship'),
    ],
    [people.id]: [fakeRecord('recH1', {fldPersonName0001: 'Ada', [PERSON_PROJECTS]: [{id: 'recP1'}]}, 'Ada')],
  };
}

/** Hooks over fake tables, with every `useRecords` call recorded by table id. */
function hooksFor(tables, adapterOptions = {}, hooksOptions) {
  const base = fakeBase(tables);
  const adapter = fakeAdapter(base, {records: records(), ...adapterOptions});
  const loads = [];
  const useRecords = adapter.useRecords;
  adapter.useRecords = table => {
    loads.push(table ? table.id : null);
    return useRecords(table);
  };
  return {base, adapter, loads, hooks: makeCreateTypedHooks(adapter)(meta, hooksOptions)};
}

/** Runs `fn` with `console.warn` captured; returns its messages. */
function capturingWarnings(fn) {
  const messages = [];
  const warn = console.warn;
  console.warn = message => messages.push(message);
  try {
    fn();
  } finally {
    console.warn = warn;
  }
  return messages;
}

test('rows carry the record name, and link cells stay {id, name} without include', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  const [site] = hooks.useRecords('Projects');
  assert.equal(site.name, 'Site');
  assert.deepEqual(site.fields.tasks, [{id: 'recT1', name: 'Write docs'}, {id: 'recT2'}, {id: 'recT9', name: 'Gone'}]);
});

test('include hydrates a link cell with the linked rows, joined by id, dropping records not loaded', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  const [site, app] = hooks.useRecords('Projects', {include: {tasks: true}});

  assert.deepEqual(
    site.fields.tasks.map(({id, name, fields}) => ({id, name, fields})),
    [
      {id: 'recT1', name: 'Write docs', fields: {title: 'Write docs', project: [{id: 'recP1', name: 'Site'}]}},
      {id: 'recT2', name: 'Ship', fields: {title: 'Ship', project: [{id: 'recP1', name: 'Site'}]}},
    ],
  );
  assert.equal(site.fields.tasks[0].raw.id, 'recT1');
  // Other cells are untouched; an empty link cell reads as absent, like any null cell.
  assert.equal(site.fields.name, 'Site');
  assert.equal(app.fields.tasks, undefined);
});

test('include follows two links deep', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  const [ada] = hooks.useRecords('People', {include: {projects: {tasks: true}}});

  assert.equal(ada.name, 'Ada');
  assert.equal(ada.fields.projects[0].name, 'Site');
  assert.deepEqual(
    ada.fields.projects[0].fields.tasks.map(task => task.fields.title),
    ['Write docs', 'Ship'],
  );
});

test('one SDK useRecords call per table plus one per include key, whether or not the key resolves', () => {
  const {hooks, loads} = hooksFor([projects, tasks, people]);

  hooks.useRecords('People', {include: {projects: {tasks: true}}});
  assert.deepEqual(loads, [people.id, projects.id, tasks.id]);

  loads.length = 0;
  // `project` is a cycle (Projects → tasks → project): skipped, but still a
  // call — on the root table, so the count never depends on resolvability.
  capturingWarnings(() => hooks.useRecords('Projects', {include: {tasks: {project: true}}}));
  assert.deepEqual(loads, [projects.id, tasks.id, projects.id]);

  loads.length = 0;
  hooks.useRecords('Projects');
  assert.deepEqual(loads, [projects.id]);
});

test('a cycle is refused at runtime: the inner link cell is left as is', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  const messages = capturingWarnings(() => {
    const [site] = hooks.useRecords('Projects', {include: {tasks: {project: true}}});
    assert.equal(site.fields.tasks[0].fields.title, 'Write docs');
    assert.deepEqual(site.fields.tasks[0].fields.project, [{id: 'recP1', name: 'Site'}]);
    // Second render: warned once.
    hooks.useRecords('Projects', {include: {tasks: {project: true}}});
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /include "tasks\.project".*already on the include path/);
});

test('depth beyond two links is refused at runtime', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  const messages = capturingWarnings(() => {
    const [ada] = hooks.useRecords('People', {include: {projects: {tasks: {project: true}}}});
    assert.equal(ada.fields.projects[0].fields.tasks[0].fields.title, 'Write docs');
    assert.deepEqual(ada.fields.projects[0].fields.tasks[0].fields.project, [{id: 'recP1', name: 'Site'}]);
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /include "projects\.tasks\.project".*at most 2 links deep/);
});

test('a non-link key is skipped and its cell left untouched (a lookup of links is not a link)', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  const messages = capturingWarnings(() => {
    const [site] = hooks.useRecords('Projects', {include: {taskNames: true, name: true}});
    assert.deepEqual(site.fields.taskNames, [{linkedRecordId: 'recT1', value: 'Write docs'}]);
    assert.equal(site.fields.name, 'Site');
  });
  assert.equal(messages.length, 2);
  assert.match(messages[0], /include "name": not a link field/);
  assert.match(messages[1], /include "taskNames": not a link field/);
});

test('a link whose target table is deleted or hidden is skipped, with a fixed call count', () => {
  // No Tasks table in this base.
  const {hooks, loads} = hooksFor([projects, people]);
  const messages = capturingWarnings(() => {
    const [site] = hooks.useRecords('Projects', {include: {tasks: true}});
    assert.deepEqual(site.fields.tasks, [
      {id: 'recT1', name: 'Write docs'},
      {id: 'recT2'},
      {id: 'recT9', name: 'Gone'},
    ]);
  });
  assert.deepEqual(loads, [projects.id, projects.id]);
  assert.match(messages[0], /include "tasks": the linked table is deleted or hidden/);
});

test('a meta without linkedTableId (pre-0.4.0 file) still hydrates through the live link target', () => {
  const legacyMeta = structuredClone(meta);
  legacyMeta.version = 2;
  for (const table of Object.values(legacyMeta.tables)) {
    for (const field of Object.values(table.fields)) delete field.linkedTableId;
  }
  const base = fakeBase([projects, tasks, people]);
  const adapter = fakeAdapter(base, {records: records()});
  const hooks = makeCreateTypedHooks(adapter)(legacyMeta);

  // The live field still knows its target, so the meta table is found by the live id.
  const [site] = hooks.useRecords('Projects', {include: {tasks: true}});
  assert.equal(site.fields.tasks[0].fields.title, 'Write docs');
});

test('plain-JS callers: a malformed include never throws', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  capturingWarnings(() => {
    for (const include of [null, 'tasks', 42, ['tasks'], {tasks: 0}, {tasks: 'yes'}, {tasks: {}}]) {
      const [site] = hooks.useRecords('Projects', {include});
      assert.equal(site.name, 'Site');
    }
    // A truthy non-object value means `true`.
    const [site] = hooks.useRecords('Projects', {include: {tasks: 'yes'}});
    assert.equal(site.fields.tasks[0].fields.title, 'Write docs');
  });
});

test('useQuery takes the same include, and filters match hydrated rows by name or id', () => {
  const {hooks} = hooksFor([projects, tasks, people]);

  const byName = hooks.useQuery('Projects', {
    include: {tasks: true},
    where: [{field: 'tasks', op: 'is', value: 'Ship'}],
  });
  assert.deepEqual(
    byName.map(row => row.id),
    ['recP1'],
  );
  assert.equal(byName[0].fields.tasks[1].fields.title, 'Ship');

  const byId = hooks.useQuery('Projects', {
    include: {tasks: true},
    where: [{field: 'tasks', op: 'anyOf', value: ['recT1']}],
  });
  assert.equal(byId.length, 1);
  assert.deepEqual(
    hooks.useQuery('Projects', {include: {tasks: true}, where: [{field: 'tasks', op: 'empty'}]}).map(r => r.id),
    ['recP2'],
  );
});

test('groupRecords and cellText treat hydrated rows like {id, name} links', () => {
  const {hooks} = hooksFor([projects, tasks, people]);
  const rows = hooks.useRecords('Projects', {include: {tasks: true}});

  const byName = groupRecords(rows, {fields: ['tasks']}).map(group => [group.key, group.records.map(row => row.name)]);
  assert.deepEqual(byName.sort(), [
    ['["Ship"]', ['Site']],
    ['["Write docs"]', ['Site']],
    ['[null]', ['App']],
  ]);
  assert.deepEqual(
    groupRecords(rows, {fields: ['tasks'], by: 'id'})
      .map(group => group.key)
      .sort(),
    ['["recT1"]', '["recT2"]', '[null]'],
  );
  assert.equal(cellText(rows[0].fields.tasks), 'Write docs, Ship');
});

test('custom properties: a look-alike root whose link points at a look-alike target rebases the target by name', () => {
  // A duplicated base: same names, new ids, links between the copies.
  const copyProjects = structuredClone(projects);
  copyProjects.id = 'tblCopyProjects01';
  copyProjects.fields = copyProjects.fields.map((field, index) => ({
    ...field,
    id: `fldCP${String(index).padStart(11, '0')}`,
  }));
  copyProjects.primaryField = {id: copyProjects.fields[0].id};
  const copyTasks = structuredClone(tasks);
  copyTasks.id = 'tblCopyTasks00001';
  copyTasks.fields = copyTasks.fields.map((field, index) => ({
    ...field,
    id: `fldCT${String(index).padStart(11, '0')}`,
  }));
  copyTasks.primaryField = {id: copyTasks.fields[0].id};
  const copyTasksLink = copyProjects.fields.find(field => field.name === 'Tasks');
  copyTasksLink.options = {linkedTableId: copyTasks.id};
  const copyTitle = copyTasks.fields.find(field => field.name === 'Title');

  const picked = fakeTable(copyProjects);
  const {hooks} = hooksFor(
    [projects, tasks, people, picked, copyTasks],
    {
      customProperties: () => ({[`airgenTable_${projects.id}`]: picked}),
      records: {
        ...records(),
        [picked.id]: [fakeRecord('recCP1', {[copyTasksLink.id]: [{id: 'recCT1', name: 'Copy task'}]}, 'Copy')],
        [copyTasks.id]: [fakeRecord('recCT1', {[copyTitle.id]: 'Copy task'}, 'Copy task')],
      },
    },
    {customProperties: {Projects: 'Projects table'}},
  );

  const [copy] = hooks.useRecords('Projects', {include: {tasks: true}});
  assert.equal(copy.name, 'Copy');
  assert.equal(copy.fields.tasks[0].fields.title, 'Copy task');
  assert.equal(copy.fields.tasks[0].raw.id, 'recCT1');
});
