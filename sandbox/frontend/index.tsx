import React, {useState} from 'react';
import {initializeBlock, useColorScheme} from '@airtable/blocks/interface/ui';
import {SchemaObserver} from 'airgen/interface';
import {SheetProvider, Text, ThemeProvider, ToastProvider, type ColorScheme} from '@airgen/ui';
import '@airgen/ui/styles.css';
import './style.css';
import {airgenMeta} from './airtable-schema';
import {Components} from './tester/panels/Components';
import {CustomProperties} from './tester/panels/CustomProperties';
import {Drift} from './tester/panels/Drift';
import {Fields} from './tester/panels/Fields';
import {Overview} from './tester/panels/Overview';
import {Queries} from './tester/panels/Queries';
import {Records} from './tester/panels/Records';
import {Relations} from './tester/panels/Relations';
import {Typed} from './tester/panels/Typed';
import {Writes} from './tester/panels/Writes';

const PANELS = {
  Overview,
  Records,
  Fields,
  Relations,
  Queries,
  Typed,
  Writes,
  Drift,
  'Custom properties': CustomProperties,
  Components,
} as const;
type PanelName = keyof typeof PANELS;

class PanelBoundary extends React.Component<{name: string; children: React.ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-md border border-red-400 bg-red-50 dark:bg-red-950/40 p-3">
        <strong>{this.props.name} crashed</strong> (airgen's runtime should never throw)
        <pre className="text-sm whitespace-pre-wrap">{this.state.error.stack ?? String(this.state.error)}</pre>
        <button type="button" onClick={() => this.setState({error: null})}>
          Retry
        </button>
      </div>
    );
  }
}

// What each source reports, to check them against Airtable's theme setting.
function ThemeProbe({scheme, onScheme}: {scheme: ColorScheme; onScheme: (scheme: ColorScheme) => void}) {
  const {colorScheme} = useColorScheme();
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const [media, setMedia] = useState(query.matches);
  React.useEffect(() => {
    const onChange = (event: MediaQueryListEvent) => setMedia(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [query]);
  React.useEffect(() => {
    console.log('[theme] useColorScheme:', colorScheme, 'prefers-color-scheme dark:', media);
  }, [colorScheme, media]);
  return (
    <div className="ml-auto flex items-center gap-2 text-sm text-gray-gray400">
      <span>
        useColorScheme: <strong>{colorScheme}</strong> · media: <strong>{media ? 'dark' : 'light'}</strong>
      </span>
      <select value={scheme} onChange={event => onScheme(event.target.value as ColorScheme)}>
        <option value="system">system</option>
        <option value="light">light</option>
        <option value="dark">dark</option>
      </select>
    </div>
  );
}

function Tester({scheme, onScheme}: {scheme: ColorScheme; onScheme: (scheme: ColorScheme) => void}) {
  const [panel, setPanel] = useState<PanelName>('Overview');
  const Panel = PANELS[panel];
  return (
    <div className="min-h-screen p-4 text-base bg-gray-gray50 dark:bg-gray-gray800 text-gray-gray700 dark:text-gray-gray200">
      <SchemaObserver meta={airgenMeta} />
      <header className="flex items-baseline gap-3 mt-2 mb-3">
        <Text variant="title">airgen tester</Text>
        <Text variant="muted">airgen + @airgen/ui against the live base</Text>
        <ThemeProbe scheme={scheme} onScheme={onScheme} />
      </header>
      <nav className="flex flex-wrap gap-1 mb-4 border-b border-gray-gray200 dark:border-gray-gray600">
        {(Object.keys(PANELS) as PanelName[]).map(name => (
          <button
            key={name}
            type="button"
            onClick={() => setPanel(name)}
            className={`px-3 py-1.5 border-0 border-b-2 bg-transparent cursor-pointer text-inherit ${
              name === panel ? 'border-blue-500 font-semibold' : 'border-transparent text-gray-gray400'
            }`}
          >
            {name}
          </button>
        ))}
      </nav>
      <PanelBoundary key={panel} name={panel}>
        <Panel />
      </PanelBoundary>
    </div>
  );
}

function Root() {
  const [scheme, setScheme] = useState<ColorScheme>('system');
  return (
    <ThemeProvider colorScheme={scheme}>
      <ToastProvider position="bottom-right">
        <SheetProvider>
          <Tester scheme={scheme} onScheme={setScheme} />
        </SheetProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

initializeBlock({interface: () => <Root />});
