import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Intentional control character regex used for security validation
      "no-control-regex": "off",
      // These rules from newer ESLint can be enabled incrementally
      "no-useless-assignment": "warn",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "tests/**", "api/**", "*.config.*"],
  }
);
