import {expect, test} from 'vitest';
import {render} from '@testing-library/react';
import axe from 'axe-core';
import {Settings} from 'lucide-react';

import {Badge} from '../src/components/Badge';
import {Button} from '../src/components/Button';
import {CaretButton} from '../src/components/CaretButton';
import {Divide} from '../src/components/Divide';
import {Input} from '../src/components/Input';
import {Label} from '../src/components/Label';
import {Spinner} from '../src/components/Spinner';
import {Text} from '../src/components/Text';
import {Toggle} from '../src/components/Toggle';

test('kitchen sink of primitives has no axe violations', async () => {
  const {container} = render(
    <main>
      <Text variant="heading">Section</Text>
      <Label htmlFor="name-input">Name</Label>
      <Input id="name-input" onChange={() => {}} />
      <Button icon={Settings} aria-label="Settings" size="icon" />
      <Button>Save</Button>
      <CaretButton aria-label="Expand" />
      <Toggle checked onChange={() => {}} label="Notifications" />
      <Badge opts={{name: 'Live', color: 'greenBright'}} />
      <Divide />
      <Spinner />
    </main>,
  );

  const results = await axe.run(container, {
    rules: {
      // jsdom has no real layout/paint, color-contrast can't run meaningfully
      'color-contrast': {enabled: false},
    },
  });

  expect(results.violations).toEqual([]);
});
