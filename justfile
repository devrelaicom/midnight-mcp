# Run pre-commit checks (staged files)
pre-commit:
    .husky/pre-commit

# Run pre-push checks (full project)
pre-push:
    npm run typecheck
    npm run lint -- --max-warnings 0
    npx prettier --check "src/**/*.ts"
    npm run test:run

# Run all checks
check: pre-push
