/**
 * The package compiles its own CSS (consumers never scan this package).
 *
 * Theme values are adopted verbatim from the interface-alpha `block init`
 * scaffold config so components render on the same scale as the host
 * extension: the scaffold redefines fontSize (text-base is 13px, not
 * Tailwind's 16px), borderRadius, boxShadow, and font weights. The
 * control-x/y spacing tokens are consumed by src/sizes.ts — invariant per
 * size: text line-height + 2*control-y + 2px border === control height
 * (xs h-5, sm h-6, base h-8, lg h-9, xl h-10).
 */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  corePlugins: {
    // Never restyle the host extension or Airtable SDK UI.
    preflight: false,
  },
  theme: {
    extend: {
      spacing: {
        "control-x-xs": "0.375rem", // 6px
        "control-x-sm": "0.5rem", // 8px
        "control-x-base": "0.75rem", // 12px
        "control-x-lg": "1rem", // 16px
        "control-x-xl": "1.25rem", // 20px
        "control-y-xs": "0.125rem", // 2px
        "control-y-sm": "0.1875rem", // 3px
        "control-y-base": "0.3125rem", // 5px
        "control-y-lg": "0.375rem", // 6px
        "control-y-xl": "0.4375rem", // 7px
      },
      fontSize: {
        xs: ["0.5625rem", "0.875rem"],
        sm: ["0.6875rem", "1rem"],
        base: ["0.8125rem", "1.25rem"],
        lg: ["0.9375rem", "1.375rem"],
        xl: ["1.0625rem", "1.5rem"],
        "2xl": ["1.3125rem", "1.625rem"],
        "3xl": ["1.4375rem", "1.8125rem"],
        "4xl": ["1.6875rem", "2.125rem"],
        "5xl": ["1.9375rem", "2.5rem"],
        "6xl": ["2.1875rem", "2.75rem"],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      borderRadius: {
        sm: "0.1875rem",
        md: "0.375rem",
        lg: "0.875rem",
      },
      boxShadow: {
        xs: "0px 0px 1px rgba(0, 0, 0, 0.32), 0px 0px 2px rgba(0, 0, 0, 0.08), 0px 1px 3px rgba(0, 0, 0, 0.08)",
        sm: "0px 0px 1px rgba(0, 0, 0, 0.32), 0px 0px 3px rgba(0, 0, 0, 0.11), 0px 1px 4px rgba(0, 0, 0, 0.12)",
        md: "0px 0px 1px 0px rgba(0, 0, 0, 0.24), 0px 0px 2px 0px rgba(0, 0, 0, 0.08), 0px 2px 4px 0px rgba(0, 0, 0, 0.08)",
        lg: "0px 0px 1px 0px rgba(0, 0, 0, 0.48), 0px 0px 2px 0px rgba(0, 0, 0, 0.08), 0px 2px 4px 0px rgba(0, 0, 0, 0.12), 0px 2px 8px 0px rgba(0, 0, 0, 0.08)",
        xl: "0px 0px 1px rgba(0, 0, 0, 0.24), 0px 0px 2px rgba(0, 0, 0, 0.16), 0px 3px 4px rgba(0, 0, 0, 0.06), 0px 6px 8px rgba(0, 0, 0, 0.06), 0px 12px 16px rgba(0, 0, 0, 0.08), 0px 18px 32px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
