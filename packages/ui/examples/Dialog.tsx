import {Button, Dialog} from '@airgen/ui';

export function DialogExample() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button type="button">Settings</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Project settings</Dialog.Title>
          <Dialog.Description>Review your project settings.</Dialog.Description>
          <Dialog.Close asChild>
            <Button type="button">Done</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
