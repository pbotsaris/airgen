import {useState} from 'react';
import {Button, LoadingOverlay} from '@airgen/ui';

export function LoadingOverlayExample({save = async () => {}}: {save?: () => Promise<void>}) {
  const [pending, setPending] = useState(false);
  return (
    <div style={{position: 'relative'}}>
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await save();
          } finally {
            setPending(false);
          }
        }}
      >
        Save
      </Button>
      {/* The overlay blocks pointer input. Disable keyboard controls separately. */}
      <LoadingOverlay pending={pending} label="Saving…" />
    </div>
  );
}
