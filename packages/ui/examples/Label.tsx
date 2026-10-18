import {Input, Label} from '@airgen/ui';

export function LabelExample() {
  return (
    <>
      <Label htmlFor="label-project">Project</Label>
      <Input id="label-project" defaultValue="Website" />
    </>
  );
}
