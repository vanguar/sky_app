// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { changeLanguage, i18n, initI18n } from './index';

it('loads the initial dictionary before rendering and keeps the latest language request', async () => {
  await initI18n('ru');
  expect(i18n.t('bodies.jupiter')).toBe('Юпитер');
  expect(document.documentElement.lang).toBe('ru');
  await Promise.all([changeLanguage('uk'), changeLanguage('de')]);
  expect(i18n.language).toBe('de');
  expect(document.documentElement.lang).toBe('de');
  await changeLanguage('ar');
  expect(document.documentElement.dir).toBe('rtl');
  await changeLanguage('en');
  expect(document.documentElement.dir).toBe('ltr');
});
