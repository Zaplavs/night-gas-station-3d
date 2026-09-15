/* Полнота перевода. Смешанный язык на экране — это не «почти готово», а брак,
   поэтому каждая русская строка, которая может попасть игроку на глаза, обязана
   иметь пару в словаре: ключи t(...), тексты данных и разметка. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EN } from '../src/content/en.js';

const CYRILLIC = /[А-Яа-яЁё]/;
const read = (file) => readFile(resolve(file), 'utf8');
const missing = [];
const check = (key, where) => { if (EN[key] === undefined) missing.push(`${where}: ${key}`); };

/* 1. Ключи из кода: t('...') и t('...', {...}). */
const sources = ['src/main.js', 'src/content/levels.js', 'src/content/shifts.js'];
let keys = 0;
for (const file of sources) {
  const code = await read(file);
  for (const match of code.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) {
    const key = match[1].replace(/\\'/g, "'");
    if (!CYRILLIC.test(key)) continue;
    keys++;
    check(key, file);
  }
}

/* 2. Тексты данных: их переводят в месте вывода, значит пара нужна всё равно. */
const DATA = ['src/content/levels.js', 'src/content/achievements.js', 'src/content/upgrades.js',
  'src/content/menu.js', 'src/content/vehicles.js', 'src/content/shifts.js'];
const STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
let dataStrings = 0;
for (const file of DATA) {
  const code = await read(file);
  for (const line of code.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    for (const match of line.matchAll(STRING)) {
      const text = (match[1] ?? match[2] ?? match[3]).replace(/\\'/g, "'");
      if (!CYRILLIC.test(text) || text.includes('${')) continue;
      dataStrings++;
      check(text, file);
    }
  }
}

/* 3. Разметка: translateDom ходит по текстовым узлам и подписям. */
const html = await read('index.html');
const body = html.slice(html.indexOf('<body'));
const withoutScripts = body.replace(/<script[\s\S]*?<\/script>/g, '');
let markup = 0;
for (const chunk of withoutScripts.split(/<[^>]*>/)) {
  const text = chunk.replace(/&nbsp;/g, ' ').trim();
  if (!text || !CYRILLIC.test(text)) continue;
  markup++;
  check(text, 'index.html');
}
for (const match of withoutScripts.matchAll(/(?:aria-label|placeholder|title)="([^"]+)"/g)) {
  if (!CYRILLIC.test(match[1])) continue;
  markup++;
  check(match[1].trim(), 'index.html');
}

if (missing.length) {
  throw new Error(`Нет английского перевода (${missing.length}):\n  ${missing.join('\n  ')}`);
}
console.log(`i18n test passed: ${keys} keys in code, ${dataStrings} data strings and ${markup} markup strings are translated; ${Object.keys(EN).length} entries in the dictionary.`);
