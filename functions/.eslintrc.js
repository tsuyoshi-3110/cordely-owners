/* functions/.eslintrc.js */
module.exports = {
  root: true,
  env: { node: true, es2021: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: ["lib/**", "node_modules/**", "dist/**"],
  rules: {
    // 必要ならここに追加
  },
};
