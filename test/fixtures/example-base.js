/**
 * The base behind `examples/`: a small, generic project tracker (Projects,
 * Tasks, People) with one of each common field type and nothing awkward —
 * that is `mock-base.js`'s job. `examples/airtable-schema.ts` is generated
 * from it (generator.test.js keeps the two in sync, refresh with
 * `UPDATE_SNAPSHOTS=1`), so the examples typecheck against exactly what airgen
 * would emit for a base shaped like this.
 */
import {COMPUTED_FIELD_TYPES} from './mock-base.js';

const PROJECTS = 'tblProjects000001';
const TASKS = 'tblTasks0000000001';
const PEOPLE = 'tblPeople000000001';

export const exampleBase = {
  id: 'appExample0000001',
  name: 'Project Tracker',
  tables: [
    {
      id: PROJECTS,
      name: 'Projects',
      fields: [
        {id: 'fldProjName000001', name: 'Name', type: 'singleLineText'},
        {
          id: 'fldProjStatus0001',
          name: 'Status',
          type: 'singleSelect',
          options: {
            choices: [
              {id: 'selPlanned000001', name: 'Planned', color: 'grayBright'},
              {id: 'selActive0000001', name: 'Active', color: 'blueBright'},
              {id: 'selDone000000001', name: 'Done', color: 'greenBright'},
            ],
          },
        },
        {
          id: 'fldProjTags000001',
          name: 'Tags',
          type: 'multipleSelects',
          options: {
            choices: [
              {id: 'selDesign0000001', name: 'Design', color: 'purpleBright'},
              {id: 'selEng0000000001', name: 'Engineering', color: 'tealBright'},
              {id: 'selMarketing0001', name: 'Marketing', color: 'orangeBright'},
            ],
          },
        },
        {id: 'fldProjOwner00001', name: 'Owner', type: 'singleCollaborator'},
        {id: 'fldProjTeam000001', name: 'Team', type: 'multipleCollaborators'},
        {id: 'fldProjBudget0001', name: 'Budget', type: 'currency', options: {precision: 2, symbol: '$'}},
        {id: 'fldProjStart00001', name: 'Start Date', type: 'date', options: {dateFormat: {name: 'iso'}}},
        {id: 'fldProjDue0000001', name: 'Due Date', type: 'date', options: {dateFormat: {name: 'iso'}}},
        {id: 'fldProjDone000001', name: 'Done', type: 'checkbox', options: {icon: 'check', color: 'greenBright'}},
        {id: 'fldProjNotes00001', name: 'Notes', type: 'multilineText'},
        {id: 'fldProjFiles00001', name: 'Files', type: 'multipleAttachments'},
        {id: 'fldProjTasks00001', name: 'Tasks', type: 'multipleRecordLinks', options: {linkedTableId: TASKS}},
        {id: 'fldProjCount00001', name: 'Task Count', type: 'count', options: {recordLinkFieldId: 'fldProjTasks00001'}},
        {
          id: 'fldProjTaskNames1',
          name: 'Task Names',
          type: 'multipleLookupValues',
          options: {
            recordLinkFieldId: 'fldProjTasks00001',
            fieldIdInLinkedTable: 'fldTaskTitle00001',
            result: {type: 'singleLineText'},
          },
        },
        {
          id: 'fldProjHours00001',
          name: 'Total Hours',
          type: 'rollup',
          options: {
            recordLinkFieldId: 'fldProjTasks00001',
            fieldIdInLinkedTable: 'fldTaskHours00001',
            result: {type: 'number', options: {precision: 1}},
          },
        },
        {
          id: 'fldProjDaysLeft01',
          name: 'Days Left',
          type: 'formula',
          options: {isValid: true, result: {type: 'number', options: {precision: 0}}},
        },
        {id: 'fldProjCreated001', name: 'Created', type: 'createdTime'},
        {id: 'fldProjModified01', name: 'Last Modified', type: 'lastModifiedTime'},
      ],
    },
    {
      id: TASKS,
      name: 'Tasks',
      fields: [
        {id: 'fldTaskTitle00001', name: 'Title', type: 'singleLineText'},
        {id: 'fldTaskProject001', name: 'Project', type: 'multipleRecordLinks', options: {linkedTableId: PROJECTS}},
        {id: 'fldTaskAssignee01', name: 'Assignee', type: 'singleCollaborator'},
        {
          id: 'fldTaskStatus0001',
          name: 'Status',
          type: 'singleSelect',
          options: {
            choices: [
              {id: 'selTodo000000001', name: 'Todo', color: 'grayBright'},
              {id: 'selInProgress001', name: 'In Progress', color: 'yellowBright'},
              {id: 'selTaskDone00001', name: 'Done', color: 'greenBright'},
            ],
          },
        },
        {
          id: 'fldTaskPriority01',
          name: 'Priority',
          type: 'singleSelect',
          options: {
            choices: [
              {id: 'selLow0000000001', name: 'Low'},
              {id: 'selMedium0000001', name: 'Medium'},
              {id: 'selHigh000000001', name: 'High', color: 'redBright'},
            ],
          },
        },
        {id: 'fldTaskHours00001', name: 'Hours', type: 'number', options: {precision: 1}},
        {id: 'fldTaskDue0000001', name: 'Due', type: 'date', options: {dateFormat: {name: 'iso'}}},
        {id: 'fldTaskDone000001', name: 'Completed', type: 'checkbox', options: {icon: 'check', color: 'greenBright'}},
        {id: 'fldTaskDesc000001', name: 'Description', type: 'richText'},
        {
          id: 'fldTaskProjStatus',
          name: 'Project Status',
          type: 'multipleLookupValues',
          options: {
            recordLinkFieldId: 'fldTaskProject001',
            fieldIdInLinkedTable: 'fldProjStatus0001',
            result: {
              type: 'singleSelect',
              options: {
                choices: [
                  {id: 'selPlanned000001', name: 'Planned', color: 'grayBright'},
                  {id: 'selActive0000001', name: 'Active', color: 'blueBright'},
                  {id: 'selDone000000001', name: 'Done', color: 'greenBright'},
                ],
              },
            },
          },
        },
      ],
    },
    {
      id: PEOPLE,
      name: 'People',
      fields: [
        {id: 'fldPersonName0001', name: 'Name', type: 'singleLineText'},
        {id: 'fldPersonEmail001', name: 'Email', type: 'email'},
        {
          id: 'fldPersonRole0001',
          name: 'Role',
          type: 'singleSelect',
          options: {
            choices: [
              {id: 'selDesigner00001', name: 'Designer'},
              {id: 'selEngineer00001', name: 'Engineer'},
              {id: 'selManager000001', name: 'Manager'},
            ],
          },
        },
        {id: 'fldPersonProj0001', name: 'Projects', type: 'multipleRecordLinks', options: {linkedTableId: PROJECTS}},
        {id: 'fldPersonActive01', name: 'Active', type: 'checkbox', options: {icon: 'check', color: 'greenBright'}},
      ],
    },
  ],
};

for (const table of exampleBase.tables) {
  // Like the SDK: the primary field is the first field.
  table.primaryField = {id: table.fields[0].id};
  for (const field of table.fields) {
    field.isComputed = COMPUTED_FIELD_TYPES.has(field.type);
  }
}
