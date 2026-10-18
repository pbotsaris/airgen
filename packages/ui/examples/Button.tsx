import {Save} from 'lucide-react';
import {Button} from '@airgen/ui';

export function ButtonExample() {
  return (
    <>
      <Button type="button" icon={Save} onClick={() => window.alert('Saved')}>
        Save
      </Button>
      <Button type="button" variant="outline" color="blueBright">
        Secondary action
      </Button>
      <Button type="button" size="icon" icon={Save} aria-label="Save changes" />
    </>
  );
}
