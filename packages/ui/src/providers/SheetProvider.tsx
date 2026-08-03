import * as React from 'react';
import {X} from 'lucide-react';
import {Sheet, type SheetSide} from '../components/DialogSheet.js';
import {Button} from '../components/Button.js';
import {usePresence} from '../dropdown.js';

const SHEET_EXIT_MS = 200; // matches Sheet.Content's duration-200

export interface SheetRenderCtx<T = unknown> {
  close: () => void;
  data?: T;
  title?: React.ReactNode;
}

export interface SheetRequest<T = unknown> {
  content: React.ReactNode | ((ctx: SheetRenderCtx<T>) => React.ReactNode);
  /** Header row is omitted entirely when no title and no renderHeader are given. */
  title?: React.ReactNode;
  side?: SheetSide;
  /** Width/padding overrides for this request (e.g. "w-[800px] p-6"). */
  className?: string;
  data?: T;
  /** Replaces the default title + close-button header. */
  renderHeader?: (ctx: SheetRenderCtx<T>) => React.ReactNode;
}

export interface SheetAPI {
  openSheet: <T>(req: SheetRequest<T>) => void;
  closeSheet: () => void;
}

const SheetContext = React.createContext<SheetAPI | null>(null);

export function useSheet(): SheetAPI {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error('useSheet must be used within <SheetProvider>');
  return ctx;
}

export interface SheetProviderProps {
  children: React.ReactNode;
  /** Portal target; defaults to document.body. */
  container?: Element | null;
  /** Default content classes applied to every sheet (per-request className appends). */
  className?: string;
}

/** Put this high in the tree; open sheets imperatively via `useSheet()`. */
export function SheetProvider({children, container, className}: SheetProviderProps) {
  const [state, setState] = React.useState<{open: boolean; req: SheetRequest<unknown> | null}>({open: false, req: null});

  const closeSheet = React.useCallback(() => {
    setState(prev => ({...prev, open: false}));
  }, []);

  const openSheet = React.useCallback(<T,>(r: SheetRequest<T>) => {
    setState({open: true, req: r as SheetRequest<unknown>});
  }, []);

  const api = React.useMemo<SheetAPI>(() => ({openSheet, closeSheet}), [openSheet, closeSheet]);

  const {open, req} = state;

  // Keep the request (and thus the content) mounted through the exit
  // animation, then drop it so effects/subscriptions inside the content don't
  // stay alive behind a closed sheet.
  const present = usePresence(open, SHEET_EXIT_MS);
  React.useEffect(() => {
    if (!present) setState(prev => (prev.req ? {...prev, req: null} : prev));
  }, [present]);

  const side = req?.side ?? 'right';
  const ctx: SheetRenderCtx = {close: closeSheet, data: req?.data, title: req?.title};

  const renderContent = (): React.ReactNode => {
    if (!req) return null;
    const content = req.content;
    if (typeof content === 'function') return content(ctx);
    return content;
  };

  const header = req?.renderHeader ? (
    req.renderHeader(ctx)
  ) : req?.title !== undefined ? (
    <div className="flex items-end justify-between shrink-0">
      <Sheet.Title className="text-lg font-semibold text-neutral-500 dark:text-neutral-400">{req.title}</Sheet.Title>
      <Sheet.Close asChild>
        <Button size="icon-sm" icon={X} variant="ghost" aria-label="Close" />
      </Sheet.Close>
    </div>
  ) : null;

  return (
    <SheetContext.Provider value={api}>
      {children}

      {/* Always mounted; visibility is driven by the controlled `open` prop
          so closing plays the exit animation instead of unmount flicker. */}
      <Sheet.Root open={open} onOpenChange={v => (v ? undefined : closeSheet())}>
        <Sheet.Portal container={container}>
          <Sheet.Overlay />
          <Sheet.Content side={side} className={['flex flex-col p-6', className, req?.className].filter(Boolean).join(' ')}>
            {header}
            <div className={header ? 'mt-4 flex flex-col flex-1 min-h-0' : 'flex flex-col flex-1 min-h-0'}>{renderContent()}</div>
          </Sheet.Content>
        </Sheet.Portal>
      </Sheet.Root>
    </SheetContext.Provider>
  );
}
