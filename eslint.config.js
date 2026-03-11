import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      // Intentional control character regex used for security validation
      "no-control-regex": "off",
      // These rules from newer ESLint can be enabled incrementally
      "no-useless-assignment": "error",
    },
  },
  {
    // Server and SSEServerTransport deprecations require MCP SDK migration
    files: ["src/server.ts"],
    rules: {
      "@typescript-eslint/no-deprecated": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "tests/**", "api/**", "*.config.*"],
  }
);
