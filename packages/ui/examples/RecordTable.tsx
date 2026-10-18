import {Button, RecordTable, type RecordTableColumn} from '@airgen/ui';
import {projects, type Project} from './records.js';

// In an extension, replace projects with useRecords('Projects').
// Explicit columns also show fields that are empty in every record.
const columns: RecordTableColumn<Project>[] = [
  {id: 'name', header: 'Project', width: 240, minWidth: 120, maxWidth: 480},
  {id: 'status'},
  {id: 'hours', align: 'right'},
  {
    id: 'actions',
    header: 'Actions',
    accessor: record => record.id,
    resizable: false,
    cell: ({record}) => (
      <Button type="button" onClick={() => window.alert(record.fields.name)}>
        Open
      </Button>
    ),
  },
];

// Resizing: one header row, no spans/colgroup. Arrow keys move 10px (Shift: 50px).
export function RecordTableExample() {
  return <RecordTable records={projects} columns={columns} columnLines resizable caption="Projects" />;
}

// expanded/onExpandedChange optionally control a map of row keys to booleans.
// defaultExpanded accepts true or a predicate; explicit map entries override it.
export function ExpandableRecordTableExample() {
  return (
    <RecordTable
      records={projects}
      columns={['name', 'status']}
      canExpand={record => record.fields.tasks.length > 0}
      renderExpanded={({record}) => (
        <ul>
          {record.fields.tasks.map(task => (
            <li key={task.id}>{task.fields.title}</li>
          ))}
        </ul>
      )}
    />
  );
}
