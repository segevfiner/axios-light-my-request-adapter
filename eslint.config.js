// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  // @ts-expect-error https://github.com/typescript-eslint/typescript-eslint/issues/10899
  tseslint.configs.recommended,
  {
    files: ["tests/**/*.{js,mjs,cjs,ts,mts,cts}"],
    ...vitest.configs.recommended,
  },
  prettierRecommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
  { ignores: ["docs/", "old/"] },
]);
