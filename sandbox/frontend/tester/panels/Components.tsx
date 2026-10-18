/** Every @airgen/ui export, fed live base data where it makes sense. */
import React, {useState} from 'react';
import {Bell, Check, Pencil, Plus, Search, Trash2} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonToggle,
  Caret,
  CaretButton,
  Circle,
  Dialog,
  Divide,
  Icon,
  Input,
  Label,
  LoadingOverlay,
  PillOption,
  Popover,
  RecordCellValue,
  RecordTable,
  Select,
  Sheet,
  Spinner,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Toggle,
  Tooltip,
  airtableColorToHex,
  shouldUseLightText,
  useSheet,
  useToast,
  type ButtonSize,
  type ButtonVariant,
  type SelectOption,
} from '@airgen/ui';
import {dyn, includableLinks, meta, tableKeys, type Row} from '../dyn';
import {Code, Section} from '../kit';

const HUES = ['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'gray'];
const SHADES = ['Light2', 'Light1', '', 'Bright', 'Dark1'];
const VARIANTS: ButtonVariant[] = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'];
const SIZES = ['xs', 'sm', 'base', 'lg', 'xl'] as const;

/** The first table with a select that has choices, and a table with links: the live inputs for the demos. */
function useLiveData() {
  const keys = tableKeys();
  const selectTable =
    keys.find(k => Object.values(meta.tables[k].fields).some(f => f.type === 'singleSelect' || f.type === 'multipleSelects')) ?? keys[0];
  const selectKey = Object.keys(meta.tables[selectTable]?.fields ?? {}).find(k => ['singleSelect', 'multipleSelects'].includes(meta.tables[selectTable].fields[k].type));
  const linkTable = keys.find(k => includableLinks(k).length > 0) ?? keys[0];
  const fields = dyn.useFields(selectTable);
  const selectRows = dyn.useRecords(selectTable);
  const linkRows = dyn.useRecords(linkTable);
  const choices = selectKey ? fields[selectKey].choices : [];
  return {selectTable, selectKey, choices, selectRows, linkTable, linkRows};
}

export function Components() {
  const live = useLiveData();
  return (
    <>
      <Buttons />
      <Divide className="my-4" />
      <Inputs />
      <Divide className="my-4" />
      <Colors choices={live.choices} selectKey={live.selectKey} />
      <Divide className="my-4" />
      <Selects live={live} />
      <Divide className="my-4" />
      <Overlays rows={live.linkRows} tableKey={live.linkTable} />
      <Divide className="my-4" />
      <Feedback />
      <Divide className="my-4" />
      <Tables rows={live.linkRows} tableKey={live.linkTable} />
    </>
  );
}

function Buttons() {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Button, CaretButton, Caret, Icon" hint="Every variant × size; icon-only sizes; disabled.">
      <div className="grid gap-2" style={{gridTemplateColumns: `100px repeat(${SIZES.length}, max-content)`}}>
        {VARIANTS.map(variant => (
          <React.Fragment key={variant}>
            <Code>{variant}</Code>
            {SIZES.map(size => (
              <Button key={size} variant={variant} size={size} icon={Plus}>
                {size}
              </Button>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {(['icon-xs', 'icon-sm', 'icon', 'icon-lg', 'icon-xl'] as ButtonSize[]).map(size => (
          <Button key={size} size={size} variant="outline" icon={Pencil} aria-label={size} />
        ))}
        <Button disabled icon={Trash2} variant="destructive">
          disabled
        </Button>
        <CaretButton open={open} onClick={() => setOpen(!open)} label={open ? 'Open' : 'Closed'} variant="secondary" />
        {(['down', 'up', 'left', 'right'] as const).map(direction => (
          <Caret key={direction} direction={direction} />
        ))}
        <Caret variant="triangle" size="lg" />
        <Icon icon={Bell} size="lg" />
        <Icon icon={Search} size={24} className="text-blue-500" />
      </div>
    </Section>
  );
}

function Inputs() {
  const [text, setText] = useState('');
  const [on, setOn] = useState(true);
  const [small, setSmall] = useState(false);
  const [view, setView] = useState('grid');
  const [pinned, setPinned] = useState(false);
  return (
    <Section title="Text, Label, Input, Toggle, ButtonToggle">
      <div className="flex flex-wrap items-baseline gap-4 mb-3">
        {(['title', 'heading', 'large', 'default', 'muted'] as const).map(variant => (
          <Text key={variant} variant={variant}>
            {variant}
          </Text>
        ))}
        <Text bold>bold</Text>
        <Text italic>italic</Text>
        <Text underline>underline</Text>
        <Text color="redBright">color="redBright"</Text>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="t-input">Input (default)</Label>
          <Input id="t-input" value={text} onChange={setText} placeholder="Type…" />
        </div>
        <div>
          <Label htmlFor="t-ghost">ghost / sm</Label>
          <Input id="t-ghost" variant="ghost" size="sm" defaultValue="ghost input" />
        </div>
        <Input size="xs" placeholder="xs" className="w-24" />
        <Input size="lg" placeholder="lg" className="w-32" />
        <Input disabled placeholder="disabled" className="w-32" />
        <Toggle checked={on} onChange={setOn} label={`Toggle ${on ? 'on' : 'off'}`} />
        <Toggle size="sm" checked={small} onChange={setSmall} label="sm" />
        <Toggle checked disabled onChange={() => {}} label="disabled" />
        <ButtonToggle
          options={[
            {value: 'grid', label: 'Grid'},
            {value: 'list', label: 'List'},
            {value: 'board', label: 'Board'},
          ]}
          value={view}
          onChange={v => setView(String(v))}
        />
        <ButtonToggle checked={pinned} onChange={v => setPinned(Boolean(v))} icon={Check}>
          {pinned ? 'Pinned' : 'Pin'}
        </ButtonToggle>
      </div>
      <Text variant="muted" className="mt-2">
        input: "{text}" · view: {view}
      </Text>
    </Section>
  );
}

function Colors({choices, selectKey}: {choices: ReadonlyArray<{id: string; name: string; color?: string}>; selectKey?: string}) {
  return (
    <Section title="PillOption, Badge, Circle, colors" hint="The vendored Airtable palette, then the live choices of a select in this base.">
      <div className="grid gap-1 mb-3" style={{gridTemplateColumns: `repeat(${SHADES.length}, max-content)`}}>
        {HUES.flatMap(hue =>
          SHADES.map(shade => {
            const color = `${hue}${shade}`;
            const hex = airtableColorToHex(color);
            return (
              <PillOption
                key={color}
                size="sm"
                opt={{value: color, label: `${color} ${hex ?? '?'} ${hex && shouldUseLightText(hex) ? '◐' : ''}`, color}}
              />
            );
          }),
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Text variant="muted">live {selectKey ?? '(no select)'}:</Text>
        {choices.map(choice => (
          <span key={choice.id} className="inline-flex items-center gap-1">
            <Circle color={choice.color ?? null} />
            <Badge opts={choice} />
          </span>
        ))}
        <Badge variant="md" opts={{name: 'md badge', color: '#7c37ef'}} />
        <Badge opts={null} />
        <PillOption opt={{value: 'avatar', label: 'with avatar', profilePicUrl: 'https://www.gravatar.com/avatar/?d=identicon'}} />
        {SIZES.map(size => (
          <PillOption key={size} size={size} opt={{value: size, label: size, color: 'tealLight1'}} />
        ))}
      </div>
    </Section>
  );
}

function Selects({live}: {live: ReturnType<typeof useLiveData>}) {
  const choiceOptions: SelectOption[] = live.choices.map(c => ({value: c.id, label: c.name, color: c.color}));
  const [single, setSingle] = useState<string>();
  const [many, setMany] = useState<string[]>([]);
  const [grouped, setGrouped] = useState<string>();
  const [custom, setCustom] = useState<string>();

  // Records of the link table grouped by their first link's target name: a realistic grouped picker.
  const firstLink = includableLinks(live.linkTable)[0]?.fieldKey;
  const groupName = (row: Row) => ((row.fields[firstLink ?? ''] as Array<{name: string}> | undefined)?.[0]?.name ?? 'Ungrouped');
  const groupKeys = [...new Set(live.linkRows.map(groupName))];
  const recordOptions: SelectOption[] = live.linkRows.map(row => ({value: row.id, label: row.name || row.id, group: groupName(row), textValue: row.name}));

  return (
    <Section title="Select" hint={<>Live data: choices of <Code>{live.selectKey ?? '—'}</Code>, records of <Code>{live.linkTable}</Code>.</>}>
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <Label>single, pill</Label>
          <Select pill options={choiceOptions} value={single} onChange={setSingle} placeholder="Pick a choice" className="w-56" />
        </div>
        <div>
          <Label>multiple, searchable, records</Label>
          <Select multiple searchable options={recordOptions} value={many} onChange={setMany} placeholder="Pick records" className="w-80" />
        </div>
        <div>
          <Label>grouped by {firstLink ?? '—'}, maxItems 50</Label>
          <Select
            searchable
            options={recordOptions}
            groups={groupKeys.map((key, i) => ({key, label: key, color: `${HUES[i % HUES.length]}Light2`}))}
            value={grouped}
            onChange={setGrouped}
            maxItems={50}
            className="w-64"
          />
        </div>
        <div>
          <Label>renderOption + disabled option</Label>
          <Select
            options={[...choiceOptions.slice(0, 4), {value: 'off', label: 'Disabled option', disabled: true}]}
            value={custom}
            onChange={setCustom}
            renderOption={(opt, state) => (
              <span className="flex items-center gap-2">
                {state.selected ? '✓' : ' '} <Circle color={opt.color ?? null} /> {opt.label}
              </span>
            )}
            className="w-56"
          />
        </div>
        <div>
          <Label>disabled, empty</Label>
          <Select disabled options={[]} placeholder="Nothing" className="w-40" />
        </div>
      </div>
      <Text variant="muted" className="mt-2">
        single={single ?? '—'} · many={many.length} · grouped={grouped ?? '—'}
      </Text>
    </Section>
  );
}

function Overlays({rows, tableKey}: {rows: Row[]; tableKey: string}) {
  const {openSheet} = useSheet();
  const [dialogChoice, setDialogChoice] = useState<string>();
  const options = rows.slice(0, 30).map(r => ({value: r.id, label: r.name}));
  const showRecord = (row: Row) =>
    openSheet({
      title: row.name,
      data: row,
      content: ({close}) => (
        <div className="flex flex-col gap-2">
          {Object.entries(row.fields).map(([key, value]) => (
            <div key={key}>
              <Label>{meta.tables[tableKey].fields[key]?.name ?? key}</Label>
              <RecordCellValue value={value} />
            </div>
          ))}
          <Button onClick={close}>Close</Button>
        </div>
      ),
    });

  return (
    <Section title="Popover, Tooltip, Dialog, Sheet, useSheet">
      <div className="flex flex-wrap items-center gap-3">
        <Popover side="bottom" align="start" trapFocus>
          <Popover.Trigger>
            <Button variant="outline">Popover with a form</Button>
          </Popover.Trigger>
          <Popover.Content className="p-3 w-64 flex flex-col gap-2">
            <Label htmlFor="pop-in">Name</Label>
            <Input id="pop-in" placeholder="focus is trapped here" />
            <Popover.Close>
              <Button size="sm">Done</Button>
            </Popover.Close>
          </Popover.Content>
        </Popover>
        {(['top', 'right', 'bottom', 'left'] as const).map(side => (
          <Tooltip key={side}>
            <Tooltip.Trigger asChild>
              <Button variant="secondary" size="sm">
                tooltip {side}
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content side={side}>Tooltip on the {side}</Tooltip.Content>
          </Tooltip>
        ))}
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button>Dialog with a Select</Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="p-4 w-96 flex flex-col gap-3">
              <Dialog.Title>Pick a record</Dialog.Title>
              <Dialog.Description>The Select menu must render above the dialog overlay.</Dialog.Description>
              <Select searchable options={options} value={dialogChoice} onChange={setDialogChoice} />
              <Dialog.Close asChild>
                <Button variant="outline">Close</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        {(['right', 'left', 'top', 'bottom'] as const).map(side => (
          <Sheet.Root key={side}>
            <Sheet.Trigger asChild>
              <Button variant="ghost">Sheet {side}</Button>
            </Sheet.Trigger>
            <Sheet.Portal>
              <Sheet.Overlay />
              <Sheet.Content side={side} className="p-4">
                <Sheet.Title>Sheet from the {side}</Sheet.Title>
                <Sheet.Description>Escape, overlay click or the button closes it.</Sheet.Description>
                <Sheet.Close asChild>
                  <Button className="mt-3">Close</Button>
                </Sheet.Close>
              </Sheet.Content>
            </Sheet.Portal>
          </Sheet.Root>
        ))}
        <Button variant="outline" disabled={!rows[0]} onClick={() => rows[0] && showRecord(rows[0])}>
          useSheet: open “{rows[0]?.name ?? '—'}”
        </Button>
      </div>
    </Section>
  );
}

function Feedback() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Section title="useToast, Spinner, LoadingOverlay">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => toast.info('Info toast')}>info</Button>
        <Button variant="secondary" onClick={() => toast.warning('Warning toast')}>
          warning
        </Button>
        <Button variant="destructive" onClick={() => toast.error('Error toast (role=alert)')}>
          error
        </Button>
        <Button variant="outline" onClick={() => toast.toast('Debounced by key', {key: 'k', delay: 400})}>
          debounced ×1
        </Button>
        <Button variant="outline" onClick={() => toast.toast('Sticky 10s', {duration: 10000})}>
          10 s
        </Button>
        <Button variant="ghost" onClick={() => toast.clear()}>
          clear
        </Button>
        {(['xs', 'sm', 'base', 'md', 'lg', 'xl'] as const).map(size => (
          <Spinner key={size} size={size} aria-label={size} />
        ))}
        <Toggle checked={pending} onChange={setPending} label="LoadingOverlay" />
      </div>
      <div className="relative h-24 mt-2 rounded-md border border-dashed border-gray-gray300 dark:border-gray-gray600 flex items-center justify-center">
        <Text variant="muted">content under the overlay</Text>
        <LoadingOverlay pending={pending} label="Loading…" delay={0} />
      </div>
    </Section>
  );
}

function Tables({rows, tableKey}: {rows: Row[]; tableKey: string}) {
  const [loading, setLoading] = useState(false);
  const fieldKeys = Object.keys(meta.tables[tableKey]?.fields ?? {});
  return (
    <Section title="Table primitives and RecordTable states">
      <Table className="mb-4">
        <TableCaption>Static table: header, body, footer, caption</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Table</TableHead>
            <TableHead className="text-right">Fields</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableKeys().map(key => (
            <TableRow key={key}>
              <TableCell>{meta.tables[key].name}</TableCell>
              <TableCell className="text-right">{Object.keys(meta.tables[key].fields).length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{tableKeys().reduce((n, k) => n + Object.keys(meta.tables[k].fields).length, 0)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      <div className="flex gap-2 items-center mb-2">
        <Toggle checked={loading} onChange={setLoading} label="loading" />
      </div>
      <Text variant="muted">Typed shorthand columns, custom cell, action column, zebra rowClassName:</Text>
      <RecordTable
        records={rows.slice(0, 8)}
        loading={loading}
        columns={[
          ...fieldKeys.slice(0, 3),
          {id: 'count', header: 'cells', align: 'right', accessor: (r: Row) => Object.keys(r.fields).length},
          {
            id: 'first',
            header: 'custom cell',
            cell: ({record}: {record: Row}) => <Badge opts={{name: record.name.slice(0, 20) || '—', color: 'purpleLight2'}} />,
            accessor: (r: Row) => r.name,
          },
        ]}
        rowClassName={(_, i) => (i % 2 ? 'bg-gray-gray50 dark:bg-gray-gray700' : undefined)}
        caption={`${tableKey}: first 8 records`}
      />
      <div className="mt-3">
        <RecordTable records={[]} emptyMessage="Empty state: no records match." columns={fieldKeys.slice(0, 2)} />
      </div>
    </Section>
  );
}
