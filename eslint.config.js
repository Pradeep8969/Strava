const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "artifacts/**",
      "supabase/functions/**",
      ".npm-cache/**",
    ],
  },
  {
    rules: {
      "react/jsx-no-leaked-render": ["error", { validStrategies: ["ternary"] }],
    },
  },
]);
