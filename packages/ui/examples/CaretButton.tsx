import {useState} from 'react';
import {CaretButton} from '@airgen/ui';

export function CaretButtonExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CaretButton
        open={open}
        onClick={() => setOpen(!open)}
        aria-label="Project details"
        aria-controls="caret-details"
      />
      <div id="caret-details" hidden={!open}>
        Project details
      </div>
    </>
  );
}
