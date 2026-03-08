module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ["eslint:recommended", "plugin:react/recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["react", "react-hooks", "react-refresh"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react-refresh/only-export-components": "warn",
    "no-empty": "off",
    "no-unused-vars": "warn",
    "react/no-unescaped-entities": "off",
    "no-control-regex": "off",
  },
  settings: {
    react: {
      version: "18.2",
    },
  },
};
