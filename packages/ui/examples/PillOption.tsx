import {PillOption} from '@airgen/ui';

// Display-only. Use Select for interactive selection.
export function PillOptionExample() {
  return (
    <>
      <PillOption opt={{value: 'done', label: 'Done', color: 'greenBright'}} size="sm" />
      <PillOption opt={{value: 'owner', label: 'Pedro'}} />
    </>
  );
}
