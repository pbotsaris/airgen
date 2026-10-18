import {Search} from 'lucide-react';
import {Icon} from '@airgen/ui';

export function IconExample() {
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
      <Icon icon={Search} size="sm" /> Search
    </span>
  );
}
