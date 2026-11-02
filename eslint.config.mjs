import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Storefront V2: design tokens are the only source of colour.
  // `styles/storefront/tokens.css` is the one file allowed to hold hex values;
  // everywhere else use the generated Tailwind utilities (bg-ink, text-bone,
  // border-line, bg-signal, ...). See the Phase 1 plan, cross-cutting note 3.
  {
    files: [
      "components/storefront/**",
      "app/(storefront)/**",
      "lib/storefront/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: String.raw`Literal[value=/#[0-9a-fA-F]{3,8}\b/]`,
          message:
            "Use a token from styles/storefront/tokens.css instead of a hex colour.",
        },
        {
          selector: String.raw`TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\b/]`,
          message:
            "Use a token from styles/storefront/tokens.css instead of a hex colour.",
        },
      ],
    },
  },
]);

export default eslintConfig;
