import {useState} from 'react';
import {Toggle} from '@airgen/ui';

export function ToggleExample() {
  const [enabled, setEnabled] = useState(false);
  return <Toggle checked={enabled} onChange={setEnabled} label="Notifications" />;
}
