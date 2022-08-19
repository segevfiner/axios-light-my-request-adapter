/** @type {import("eslint").Linter.Config} */
module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:jest/recommended",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "2021",
    sourceType: "module",
    tsconfigRootDir: __dirname,
    project: [
      "./tsconfig.json",
      "./tsconfig.eslint.json",
      "./test/tsconfig.json",
    ],
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-non-null-assertion": ["off"],
  },
  ignorePatterns: ["/dist/", "/coverage/", "/docs/"],
};
