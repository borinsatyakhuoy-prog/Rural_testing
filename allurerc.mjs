import { defineConfig } from 'allure';

export default defineConfig({
  name: 'Rural Lodge QA Report',
  output: './allure-report',
  historyPath: './allure-history/history.jsonl',
  plugins: {
    awesome: {
      options: {
        reportName: 'Rural Lodge QA Report',
        singleFile: false,
        reportLanguage: 'en',
      },
    },
  },
});
