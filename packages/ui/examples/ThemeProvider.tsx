import {useState} from 'react';
import {Button, Select, ThemeProvider, type ColorScheme} from '@airgen/ui';

// Without a provider, components follow prefers-color-scheme.
// Portalled menus, dialogs and toasts also follow this override.
// Avoid nesting providers with opposing schemes.
export function ThemeProviderExample() {
  const [scheme, setScheme] = useState<ColorScheme>('system');
  return (
    <ThemeProvider colorScheme={scheme}>
      <Button type="button" onClick={() => setScheme(scheme === 'dark' ? 'light' : 'dark')}>
        Toggle theme
      </Button>
      <Select options={[{value: 'todo', label: 'Todo'}]} placeholder="Choose status" />
    </ThemeProvider>
  );
}
