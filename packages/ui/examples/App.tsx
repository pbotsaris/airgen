import '@airgen/ui/styles.css';
import {Select, ToastProvider, useToast} from '@airgen/ui';

// Import styles once at your application's entry point.
function StatusPicker() {
  const {info} = useToast();
  return (
    <Select
      pill
      placeholder="Choose status"
      options={[
        {value: 'todo', label: 'Todo', color: 'yellowBright'},
        {value: 'done', label: 'Done', color: 'greenBright'},
      ]}
      onChange={value => info(`Moved to ${value}`)}
    />
  );
}

export function App() {
  return (
    <ToastProvider>
      <StatusPicker />
    </ToastProvider>
  );
}
