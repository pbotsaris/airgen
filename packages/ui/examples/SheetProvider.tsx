import {Button, SheetProvider, useSheet} from '@airgen/ui';

function OpenButton() {
  const {openSheet} = useSheet();
  return (
    <Button
      type="button"
      onClick={() =>
        openSheet({
          title: 'Project details',
          side: 'right',
          content: ({close}) => (
            <>
              <p>Manage this project.</p>
              <Button type="button" onClick={close}>
                Done
              </Button>
            </>
          ),
        })
      }
    >
      Open details
    </Button>
  );
}

export function SheetProviderExample() {
  return (
    <SheetProvider>
      <OpenButton />
    </SheetProvider>
  );
}
