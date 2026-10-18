import {Badge} from '@airgen/ui';

export function BadgeExample() {
  return (
    <>
      <Badge opts={{name: 'Done', color: 'greenBright'}} />
      <Badge opts={{name: 'Draft'}} />
    </>
  );
}
