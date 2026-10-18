import {GroupTable, type RecordGroup} from '@airgen/ui';
import {projects, type Project} from './records.js';

// Same shape as: groupRecords(projects, {fields: ['status', 'owner']}).
// Fixtures keep this example independent of generated schemas and the SDK.
const groups: RecordGroup<Project>[] = projects.map(record => {
  const values = [record.fields.status, record.fields.owner];
  return {key: JSON.stringify(values), values, records: [record]};
});

// With airgen: summary={records => aggregate(records, {hours: {field: 'hours', op: 'sum'}})}.
const hours = (records: ReadonlyArray<Project>) => ({
  hours: records.reduce((sum, record) => sum + record.fields.hours, 0),
});

// Multiple group values produce nested, independently collapsible levels; the
// top level gets the darkest background and each deeper level a lighter one.
// groupLabels render as small captions over each value (groupLabelPlacement
// "inline" gives "Status: Done" instead). Parent summaries receive the
// distinct union of their leaves' records. summaryPlacement "auto" keeps the
// summary in the group row while collapsed and moves it to a totals row
// while expanded. expanded/onExpandedChange use leaf keys or
// JSON.stringify(values prefix).
export function GroupTableExample() {
  return (
    <GroupTable
      groups={groups}
      columns={['name', 'status', 'owner', {id: 'hours', header: 'Hours (h)', align: 'right'}]}
      groupLabels={['Status', 'Owner']}
      emptyGroupLabel="Unassigned"
      defaultExpanded={1}
      summary={hours}
      formatSummary={hours => `${hours} h`}
      summaryPlacement="auto"
    />
  );
}

// Totals only: showRecords={false} drops the records under each leaf and
// moves the labels into a leading column of their own (groupColumn), so
// every data column holds nothing but summaries. Rename a data column with
// an {id, header} entry; the group column's header is groupColumn.header.
// Leaves have nothing to open, so they get no caret and keep their summary
// in the row whatever summaryPlacement says.
export function GroupTotalsExample() {
  return (
    <GroupTable
      groups={groups}
      columns={[{id: 'hours', header: 'Total hours', align: 'right'}]}
      groupColumn={{header: 'Owner', width: 240}}
      groupLabels={['Status', 'Owner']}
      showRecords={false}
      summary={hours}
      formatSummary={hours => `${hours} h`}
    />
  );
}

// Records with a group column: the labels and carets sit in their own
// column while the records keep every data column. groupLabelPlacement
// "inline" puts the level label before the value; summaryPlacement "footer"
// always adds a totals row (its label cell reads `${totalLabel} ${value}`,
// so a translated totalLabel works); groupRowClassName (a string, or a
// function of the group context) adds to the per-level style.
export function GroupFooterExample() {
  return (
    <GroupTable
      groups={groups}
      columns={['name', {id: 'hours', header: 'Hours', align: 'right'}]}
      groupColumn={{header: 'Status / Owner', width: 220}}
      groupLabels={['Status', 'Owner']}
      groupLabelPlacement="inline"
      groupRowClassName={context => (context.value === 'Done' ? 'group-done' : undefined)}
      summary={hours}
      formatSummary={hours => `${hours} h`}
      summaryPlacement="footer"
      totalLabel="Sum"
    />
  );
}
