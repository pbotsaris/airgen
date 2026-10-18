import {useState} from 'react';
import {Button, Portal} from '@airgen/ui';

// Content mounts under document.body and follows the surrounding ThemeProvider.
export function PortalExample() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setVisible(!visible)}>
        Toggle status
      </Button>
      {visible && (
        <Portal>
          <div role="status">Saved</div>
        </Portal>
      )}
    </>
  );
}
