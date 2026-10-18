import {GroupTable, type RecordGroup} from '@airgen/ui';
import {projects, type Project} from './records.js';

// Same shape as: groupRecords(projects, {fields: ['status', 'owner']}).
// Fixtures keep this example independent of generated schemas and the SDK.
const groups: RecordGroup<Project>[] = projects.map(record => {
  const values = [record.fields.status, record.fields.owner];
  return {key: JSON.stringify(values), values, records: [record]};
});

// Multiple group values produce nested, independently collapsible levels.
// Parent summaries receive the distinct union of their leaves' records.
// expanded/onExpandedChange use leaf keys or JSON.stringify(values prefix).
export function GroupTableExample() {
  return (
    <GroupTable
      groups={groups}
      columns={['name', 'status', 'owner', 'hours']}
      groupLabels={['Status', 'Owner']}
      emptyGroupLabel="Unassigned"
      defaultExpanded={1}
      // With airgen: summary={records => aggregate(records, {hours: {field: 'hours', op: 'sum'}})}.
      summary={records => ({hours: records.reduce((sum, record) => sum + record.fields.hours, 0)})}
      formatSummary={hours => `${hours} h`}
      summaryPlacement="footer"
    />
  );
}
