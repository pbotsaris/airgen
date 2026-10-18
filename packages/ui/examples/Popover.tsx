import {Button, Popover, Text} from '@airgen/ui';

export function PopoverExample() {
  return (
    <Popover align="start" flip>
      <Popover.Trigger>
        <Button type="button">Details</Button>
      </Popover.Trigger>
      <Popover.Content aria-label="Project details">
        <Text>Project settings</Text>
        <Popover.Close>
          <Button type="button">Done</Button>
        </Popover.Close>
      </Popover.Content>
    </Popover>
  );
}
