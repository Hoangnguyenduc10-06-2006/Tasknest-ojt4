import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { 'no-alert': 'error', 'no-restricted-globals': ['error', 'alert', 'confirm', 'prompt'], 'no-restricted-properties': ['error', ...['window', 'globalThis', 'self'].flatMap(object => ['alert', 'confirm', 'prompt'].map(property => ({ object, property, message: 'Dùng modal hoặc thông báo trong ứng dụng.' })))] } },
  { files: ['**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser, ...globals.node } }, plugins: { 'react-hooks': hooks, 'react-refresh': refresh }, rules: { ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
);
