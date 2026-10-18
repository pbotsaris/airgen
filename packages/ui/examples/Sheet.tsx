import {Button, Sheet} from '@airgen/ui';

export function SheetExample() {
  return (
    <Sheet.Root>
      <Sheet.Trigger asChild>
        <Button type="button">Open project</Button>
      </Sheet.Trigger>
      <Sheet.Portal>
        <Sheet.Overlay />
        <Sheet.Content side="right">
          <Sheet.Title>Project</Sheet.Title>
          <Sheet.Description>Manage this project.</Sheet.Description>
          <Sheet.Close asChild>
            <Button type="button">Done</Button>
          </Sheet.Close>
        </Sheet.Content>
      </Sheet.Portal>
    </Sheet.Root>
  );
}
