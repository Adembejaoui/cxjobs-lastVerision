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
    ".kilo/**",
    // Generated Prisma client.
    "app/generated/**",
    // k6 load-test scripts run in k6's JS runtime (CommonJS `require` is
    // correct there), not in Node/Next.
    "tests/k6/**",
    // Local scratch files (gitignored: tmp-*, inspect_trgm.js, verify_seed.ts).
    "tmp-*",
    "tmp-verify/**",
    "inspect_trgm.js",
    "verify_seed.ts",
  ]),
  {
    // Known debt (19 sites at the time of the Phase 2 audit): these React
    // Compiler rules flag setState-in-effect / ref-in-render patterns whose
    // fixes are behavioural refactors of stateful forms. They are reported as
    // warnings and capped by `npm run lint:ci` (--max-warnings ratchet), so the
    // count can only go down. Lower the cap in package.json as sites are fixed.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
