import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", ".local-auth/**", "out/**", "coverage/**", "next-env.d.ts", "docs/**"]),
  {
    files: ["lib/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*", "@supabase/*", "@/components/*", "@/lib/data/*"] }]
    }
  }
]);
