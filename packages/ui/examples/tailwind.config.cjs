// Optional: use this variant if your own Tailwind dark: classes must follow
// ThemeProvider. No Tailwind setup is required for the package's compiled CSS.
module.exports = {
  darkMode: [
    'variant',
    [
      '@media (prefers-color-scheme: dark) { &:not(:where([data-ag-theme="light"] *)) }',
      '&:where([data-ag-theme="dark"] *)',
    ],
  ],
};
