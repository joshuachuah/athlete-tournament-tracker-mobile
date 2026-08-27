// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "coverage/*",
      "ios/*",
      "android/*",
      ".expo/*",
      "plans/*",
      "docs/*",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // React Compiler owns memoization in this project.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useMemo", "useCallback", "memo"],
              message:
                "React Compiler handles memoization here. Remove the manual hook.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='React'][property.name=/^(useMemo|useCallback|memo)$/]",
          message:
            "React Compiler handles memoization here. Remove the manual hook.",
        },
        {
          selector:
            "TSAsExpression > TSTypeReference > Identifier[name='Error']",
          message: "Use errorMessage() from lib/errors instead of casting to Error.",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);
