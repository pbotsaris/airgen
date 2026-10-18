import {NestedRecordTable} from '@airgen/ui';
import {projects} from './records.js';

const people = [{id: 'person1', fields: {name: 'Pedro', email: 'pedro@example.com', projects}}];

// In an extension:
// const people = useRecords('People', {include: {projects: {tasks: true}}});
// Only hydrated links ({id, fields}[]) can appear in nested, at any level.
// Expansion keys are row paths, e.g. person1/projects/project1/tasks/task1.
// Collapsing a parent preserves its children's expansion state.
export function NestedRecordTableExample() {
  return (
    <NestedRecordTable
      records={people}
      columns={['name', 'email']}
      defaultExpanded={1}
      nested={{
        projects: {
          columns: ['name', 'status'],
          nested: {tasks: {columns: ['title', 'done'], emptyMessage: 'No tasks yet'}},
        },
      }}
    />
  );
}
