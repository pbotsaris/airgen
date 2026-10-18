import * as React from 'react';

/** `system` follows the frame's `prefers-color-scheme`, as the components do with no provider. */
export type ColorScheme = 'light' | 'dark' | 'system';

const ThemeContext = React.createContext<ColorScheme | null>(null);

/** The nearest provider's scheme, or null outside any provider. */
export function useThemeScheme(): ColorScheme | null {
  return React.useContext(ThemeContext);
}

/**
 * The attribute the `dark:` variant keys on (tailwind.config.cjs), on an
 * element that doesn't take part in layout. Portal renders one too, so
 * portalled menus, dialogs and toasts follow the scheme from document.body.
 */
export function ThemeScope({scheme, children}: {scheme: ColorScheme; children?: React.ReactNode}) {
  return (
    <div data-ag-theme={scheme} style={{display: 'contents'}}>
      {children}
    </div>
  );
}

export interface ThemeProviderProps {
  /**
   * The scheme to force. The SDK's `useColorScheme` reads the same media query
   * the components already follow, so passing it changes nothing; this is for
   * an override such as a theme toggle.
   */
  colorScheme: ColorScheme;
  children?: React.ReactNode;
}

/**
 * Sets the color scheme for every component below it, portals included.
 * SDK-free: the caller supplies the scheme. One per tree; a provider nested
 * inside an opposite one isn't supported (CSS can't select the nearest).
 */
export function ThemeProvider({colorScheme, children}: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={colorScheme}>
      <ThemeScope scheme={colorScheme}>{children}</ThemeScope>
    </ThemeContext.Provider>
  );
}
