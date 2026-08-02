/**
 * Structural Base-like fixture covering every mapped field type plus the
 * awkward cases: accented names (transliterated + camelCased field keys),
 * field-key collisions after transliteration, select choices with quotes in
 * names, table-name collisions after sanitization, names starting with
 * digits, emoji-only names (fall back to the quoted raw name),
 * formula/rollup result resolution, and an unknown future field type.
 */
export const mockBase = {
  id: 'appMockBase000001',
  name: 'Mock Base',
  tables: [
    {
      id: 'tblProjects000001',
      name: 'Projects',
      description: 'Main projects table',
      fields: [
        {id: 'fldName0000000001', name: 'Name', type: 'singleLineText', description: 'Project title'},
        {id: 'fldNotes000000001', name: 'Notes!', type: 'multilineText'},
        {id: 'fldRich0000000001', name: 'Brief', type: 'richText'},
        {id: 'fldEmail000000001', name: 'Contact Email', type: 'email'},
        {id: 'fldUrl00000000001', name: 'Website', type: 'url'},
        {id: 'fldPhone000000001', name: 'Phone', type: 'phoneNumber'},
        {id: 'fldBudget00000001', name: 'Budget', type: 'currency', options: {precision: 2, symbol: '$'}},
        {id: 'fldPct00000000001', name: 'Completion %', type: 'percent', options: {precision: 0}},
        {id: 'fldRating00000001', name: 'Rating', type: 'rating', options: {max: 5}},
        {id: 'fldDur00000000001', name: 'Duration', type: 'duration'},
        {id: 'fldCount000000001', name: 'Task Count', type: 'count'},
        {id: 'fldAuto0000000001', name: 'ID', type: 'autoNumber'},
        {id: 'fldDone0000000001', name: 'Done', type: 'checkbox', options: {icon: 'check', color: 'greenBright'}},
        {id: 'fldDate0000000001', name: 'Start Date', type: 'date', options: {dateFormat: {name: 'iso'}}},
        {id: 'fldDT000000000001', name: 'Kickoff', type: 'dateTime'},
        {id: 'fldCreated0000001', name: 'Created', type: 'createdTime'},
        {id: 'fldModified000001', name: 'Modified', type: 'lastModifiedTime'},
        {
          id: 'fldStatus00000001',
          name: 'Status',
          type: 'singleSelect',
          options: {
            choices: [
              {id: 'selTodo000000001', name: 'Todo', color: 'redBright'},
              {id: 'selProg000000001', name: 'In "Progress"', color: 'yellowBright'},
              {id: 'selDone000000001', name: 'Done', color: 'greenBright'},
            ],
          },
        },
        {
          id: 'fldTags0000000001',
          name: 'Tags',
          type: 'multipleSelects',
          options: {
            choices: [
              {id: 'selDesign0000001', name: 'Design'},
              {id: 'selDev0000000001', name: 'Dev', color: 'blueBright'},
            ],
          },
        },
        {id: 'fldEmptySel000001', name: 'Empty Select', type: 'singleSelect', options: {choices: []}},
        {id: 'fldLinks000000001', name: 'Tasks', type: 'multipleRecordLinks', options: {linkedTableId: 'tblTasks0000000001'}},
        {id: 'fldAttach00000001', name: 'Files', type: 'multipleAttachments'},
        {id: 'fldOwner000000001', name: 'Owner', type: 'singleCollaborator'},
        {id: 'fldTeam0000000001', name: 'Team', type: 'multipleCollaborators'},
        {id: 'fldCreatedBy00001', name: 'Created By', type: 'createdBy'},
        {id: 'fldModifiedBy0001', name: 'Modified By', type: 'lastModifiedBy'},
        {id: 'fldBarcode0000001', name: 'Barcode', type: 'barcode'},
        {id: 'fldButton00000001', name: 'Open', type: 'button'},
        {
          id: 'fldFormula0000001',
          name: 'Days Left',
          type: 'formula',
          options: {isValid: true, result: {type: 'number', options: {precision: 0}}},
        },
        {
          id: 'fldFormulaStr0001',
          name: 'Label',
          type: 'formula',
          options: {isValid: true, result: {type: 'singleLineText'}},
        },
        {id: 'fldFormulaBad0001', name: 'Broken Formula', type: 'formula', options: {isValid: false}},
        {
          id: 'fldRollup00000001',
          name: 'Total Hours',
          type: 'rollup',
          options: {isValid: true, result: {type: 'number', options: {precision: 1}}},
        },
        {
          id: 'fldLookup00000001',
          name: 'Task Names',
          type: 'multipleLookupValues',
          options: {isValid: true, result: {type: 'singleLineText'}},
        },
        {id: 'fldAi000000000001', name: 'Summary', type: 'aiText'},
        {id: 'fldFuture00000001', name: 'Weird Field', type: 'someFutureType'},
      ],
    },
    {
      id: 'tblMyTable00000001',
      name: 'My Table',
      fields: [{id: 'fldMt100000000001', name: 'Name', type: 'singleLineText'}],
    },
    {
      id: 'tblMyTable00000002',
      name: 'My-Table',
      fields: [{id: 'fldMt200000000001', name: 'Name', type: 'singleLineText'}],
    },
    {
      id: 'tblSolucoes000001',
      name: 'Minhas Soluções',
      fields: [
        {id: 'fldMs100000000001', name: 'minhas soluções', type: 'singleLineText'},
        {id: 'fldMs200000000001', name: 'Ação', type: 'checkbox'},
        {id: 'fldMs300000000001', name: 'Soluções', type: 'singleLineText'},
        {id: 'fldMs400000000001', name: 'Solucoes', type: 'singleLineText'},
        {id: 'fldMs500000000001', name: '2024 Total', type: 'number', options: {precision: 0}},
        {id: 'fldMs600000000001', name: '🎉', type: 'singleLineText'},
      ],
    },
    {
      id: 'tbl2024Plans000001',
      name: '2024 Plans',
      fields: [
        {id: 'fldPlan0000000001', name: 'Plan', type: 'singleLineText'},
        {
          id: 'fldPlanStatus0001',
          name: 'Status',
          type: 'singleSelect',
          options: {choices: [{id: 'selPlanA00000001', name: 'Draft'}]},
        },
      ],
    },
  ],
};
