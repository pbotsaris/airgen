import {useState} from 'react';
import {Label, Select, type SelectOption} from '@airgen/ui';

const options: SelectOption[] = [
  {value: 'todo', label: 'Todo', color: 'yellowBright', group: 'active'},
  {value: 'doing', label: 'In progress', color: 'blueBright', group: 'active'},
  {value: 'done', label: 'Done', color: 'greenBright', group: 'closed'},
];

export function SelectExample() {
  const [status, setStatus] = useState('todo');
  const [statuses, setStatuses] = useState<string[]>([]);
  return (
    <>
      <Label htmlFor="single-status">Status</Label>
      <Select id="single-status" pill options={options} value={status} onChange={setStatus} />
      <Label htmlFor="multiple-statuses">Filter statuses</Label>
      <Select
        id="multiple-statuses"
        multiple
        pill
        searchable
        options={options}
        groups={[
          {key: 'active', label: 'Active'},
          {key: 'closed', label: 'Closed'},
        ]}
        value={statuses}
        onChange={setStatuses}
      />
    </>
  );
}
