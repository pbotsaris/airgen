import {useState} from 'react';
import {Button, InlineEdit} from '@airgen/ui';

// Enter/blur saves. Escape cancels. value is controlled; update it after saving.
// An unchanged parsed value skips onCommit. Rejections keep the draft open.
export function InlineEditExample() {
  const [name, setName] = useState('Website');
  return <InlineEdit label="Name" value={name} onCommit={setName} />;
}

const dollars = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

// Display and raw text reserve space in both modes. Long drafts scroll within
// the input. A committed value can resize it; set width: '100%' to fill a container.
// Numeric drafts reject empty/non-finite values. Values stay numeric on save.
export function CurrencyInlineEditExample({save = async () => {}}: {save?: (amount: number) => Promise<void>}) {
  const [budget, setBudget] = useState(1234.5);
  return (
    <InlineEdit
      label="Budget"
      value={budget}
      format={dollars.format}
      align="right"
      onCommit={async amount => {
        await save(amount);
        setBudget(amount);
      }}
    />
  );
}

const reais = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});

export function LocalizedCurrencyInlineEditExample() {
  const [budget, setBudget] = useState(1234.5);
  return (
    <InlineEdit
      label="Budget in reais"
      value={budget}
      onCommit={setBudget}
      format={reais.format}
      toInputValue={amount => amount.toFixed(2).replace('.', ',')}
      parse={draft => {
        if (!/^-?\d+(,\d{1,2})?$/.test(draft)) throw new Error('Enter an amount such as 1234,50.');
        return Number(draft.replace(',', '.'));
      }}
      align="right"
    />
  );
}

// Custom editors own their layout. They receive a string draft, save/cancel,
// pending, error and label. Use parse to convert the draft to another value type.
// Enter/blur do not save by default, including blur into portalled toolbars.
// Opt-in commitOnBlur treats portals as outside. preventDefault handles keys locally.
// The first focusable control receives focus; save/cancel restore the trigger.
// Keep renderValue content noninteractive: it renders inside an edit button.
export function CustomInlineEditExample() {
  const [description, setDescription] = useState('Project notes');
  return (
    <InlineEdit
      label="Description"
      value={description}
      onCommit={setDescription}
      renderValue={value => <span>{value}</span>}
      renderEditor={({draft, setDraft, commit, cancel, pending, label}) => (
        <div>
          <textarea
            aria-label={label}
            value={draft}
            disabled={pending}
            onChange={event => setDraft(event.target.value)}
          />
          <Button type="button" disabled={pending} onClick={() => void commit()}>
            Save
          </Button>
          <Button type="button" disabled={pending} onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}
    />
  );
}
