import {useState} from 'react';
import {Input, Label} from '@airgen/ui';

// onChange receives the string, rather than a DOM event.
export function InputExample() {
  const [name, setName] = useState('Project');
  return (
    <>
      <Label htmlFor="input-name">Name</Label>
      <Input id="input-name" value={name} onChange={setName} />
      <Input aria-label="Search" variant="ghost" placeholder="Search…" />
    </>
  );
}
