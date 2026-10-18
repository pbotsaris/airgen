import {Button, Tooltip} from '@airgen/ui';

export function TooltipExample() {
  return (
    <Tooltip>
      <Tooltip.Trigger asChild>
        <Button type="button">Save</Button>
      </Tooltip.Trigger>
      <Tooltip.Content>Save your changes</Tooltip.Content>
    </Tooltip>
  );
}
