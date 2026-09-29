import nextPlugin from "@next/eslint-plugin-next";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "public/**"],
  },
  nextPlugin.flatConfig.coreWebVitals,
];

export default eslintConfig;
