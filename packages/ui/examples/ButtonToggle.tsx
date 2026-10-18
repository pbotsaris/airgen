import {useState} from 'react';
import {ButtonToggle} from '@airgen/ui';

export function ButtonToggleExample() {
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState('list');
  return (
    <>
      <ButtonToggle checked={enabled} onChange={value => setEnabled(Boolean(value))}>
        Notifications
      </ButtonToggle>
      <ButtonToggle
        value={view}
        onChange={value => setView(String(value))}
        options={[
          {value: 'list', label: 'List'},
          {value: 'grid', label: 'Grid'},
        ]}
      />
    </>
  );
}
