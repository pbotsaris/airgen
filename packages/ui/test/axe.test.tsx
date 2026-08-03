import {expect, test} from 'vitest';
import {render, screen, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import {Select} from '../src/components/Select';
import {Popover, PopoverTrigger, PopoverContent} from '../src/components/Popover';
import {Tooltip, TooltipTrigger, TooltipContent} from '../src/components/Tooltip';
import {Dialog} from '../src/components/DialogSheet';
import {ToastProvider, useToast, type ToastAPI} from '../src/providers/ToastProvider';
import {SheetProvider, useSheet, type SheetAPI} from '../src/providers/SheetProvider';
import type {SelectOption} from '../src/types';

const AXE_OPTIONS = {
  rules: {
    // jsdom has no real layout/paint, color-contrast can't run meaningfully
    'color-contrast': {enabled: false},
    // best-practice rule; portalled overlays (menus, dialogs, toasts) attach
    // to document.body and legitimately live outside landmark regions
    region: {enabled: false},
  },
};

async function expectNoViolations(container: Element) {
  const results = await axe.run(container, AXE_OPTIONS);
  expect(results.violations).toEqual([]);
}

const OPTIONS: SelectOption[] = [
  {value: 'a', label: 'Alpha', color: 'blueBright'},
  {value: 'b', label: 'Beta'},
];

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

  await expectNoViolations(container);
});

test('open single, searchable and multi Select have no axe violations', async () => {
  const user = userEvent.setup();

  const single = render(
    <main>
      <Select options={OPTIONS} defaultValue="a" />
    </main>,
  );
  await user.click(screen.getByRole('button'));
  await expectNoViolations(document.body);
  single.unmount();

  const searchable = render(
    <main>
      <Select options={OPTIONS} searchable />
    </main>,
  );
  await user.click(screen.getByRole('button'));
  await expectNoViolations(document.body);
  searchable.unmount();

  render(
    <main>
      <Select multiple options={OPTIONS} defaultValue={['a']} />
    </main>,
  );
  await user.click(screen.getByRole('combobox'));
  await expectNoViolations(document.body);
});

test('open Popover and visible Tooltip have no axe violations', async () => {
  const user = userEvent.setup();
  const popover = render(
    <main>
      <Popover>
        <PopoverTrigger>
          <button>Open</button>
        </PopoverTrigger>
        <PopoverContent aria-label="Options panel">
          <p>content</p>
        </PopoverContent>
      </Popover>
    </main>,
  );
  await user.click(screen.getByRole('button', {name: 'Open'}));
  await expectNoViolations(document.body);
  popover.unmount();

  render(
    <main>
      <Tooltip open>
        <TooltipTrigger asChild>
          <button>Hover</button>
        </TooltipTrigger>
        <TooltipContent>Tip text</TooltipContent>
      </Tooltip>
    </main>,
  );
  await expectNoViolations(document.body);
});

test('Dialog with and WITHOUT Title/Description has no axe violations', async () => {
  const withTitle = render(
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Title</Dialog.Title>
          <Dialog.Description>Description</Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
  );
  await expectNoViolations(document.body);
  withTitle.unmount();

  // regression: unconditional aria-labelledby used to leave dangling IDREFs
  render(
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content aria-label="Untitled dialog">
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
  );
  await expectNoViolations(document.body);
});

test('sheet via provider and a toast stack have no axe violations', async () => {
  const sheetApi: {current: SheetAPI | null} = {current: null};
  const toastApi: {current: ToastAPI | null} = {current: null};
  function Grab() {
    sheetApi.current = useSheet();
    toastApi.current = useToast();
    return null;
  }
  render(
    <ToastProvider>
      <SheetProvider>
        <Grab />
      </SheetProvider>
    </ToastProvider>,
  );
  act(() => {
    sheetApi.current!.openSheet({title: 'Panel', content: <p>sheet body</p>});
    toastApi.current!.info('saved');
    toastApi.current!.error('broke');
  });
  await expectNoViolations(document.body);
});
