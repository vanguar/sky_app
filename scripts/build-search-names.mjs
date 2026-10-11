import { readFile, writeFile } from 'node:fs/promises';

const codes = ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'ar'];
const dictionaries = await Promise.all(
  codes.map(async (code) => {
    const dictionary = JSON.parse(
      await readFile(new URL(`../src/i18n/${code}.json`, import.meta.url), 'utf8'),
    );
    return [
      code,
      {
        bodies: dictionary.bodies,
        messierNames: dictionary.messierNames,
        meteors: { names: dictionary.meteors.names },
      },
    ];
  }),
);
await writeFile(
  new URL('../src/features/search/search-names.json', import.meta.url),
  `${JSON.stringify(Object.fromEntries(dictionaries), null, 2)}\n`,
);
