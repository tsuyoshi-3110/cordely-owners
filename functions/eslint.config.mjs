// functions/eslint.config.mjs
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.js"],
    // 旧設定ファイルやビルド成果物は lint 対象外
    ignores: ["lib/**", "node_modules/**", ".eslintrc.js"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      // ← Node グローバル（process/module/require など）を有効化
      globals: { ...globals.node },
    },
    plugins: { "@typescript-eslint": ts },
    rules: {
      "no-console": "off",
    },
  },
];
