/* Быстрая проверка без браузера: файлы на месте, разметка совпадает с кодом.
   Содержимое кампании проверяет tests/levels.mjs. */
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CAMPAIGN_SHIFTS, CAMPAIGN_SHIFT_COUNT, EVENT_TYPES, PLAY_MODE, getShiftConfig } from '../src/content/shifts.js';
import { SAVE_VERSION, migrateProgress } from '../src/content/progress.js';

const required = ['index.html', 'src/main.js', 'src/gamepush.js', 'src/content/shifts.js', 'src/content/progress.js', 'src/content/levels.js',
  'public/models/station.glb', 'public/models/second_floor.glb', 'public/models/pump.glb', 'public/models/car.glb',
  'public/models/mystery_van.glb', 'public/models/worker.glb', 'public/models/bag.glb', 'public/models/cleaning_kit.glb'];
for (const file of required) {
  const path = resolve(file), stats = await stat(path);
  if (!stats.size) throw new Error(`${file} is empty`);
  if (file.endsWith('.glb')) {
    const bytes = await readFile(path);
    if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file} is not a GLB`);
  }
}

const html = await readFile(resolve('index.html'), 'utf8');
if (!html.includes('GAMEPUSH_CONFIG')) throw new Error('GamePush config is missing');

/* Код обращается к элементам по id — значит, они обязаны быть в разметке. */
const sources = await Promise.all(['src/main.js', 'src/hands.js'].map((file) => readFile(resolve(file), 'utf8')));
const referenced = new Set();
for (const source of sources) for (const match of source.matchAll(/\$\('#([\w-]+)/g)) referenced.add(match[1]);
const missing = [...referenced].filter((id) => !html.includes(`id="${id}"`));
if (missing.length) throw new Error(`index.html is missing elements used by the game: ${missing.join(', ')}`);

/* Картинки обучения подставляются из кода, их отсутствие видно только в игре. */
const images = [...sources[0].matchAll(/'(tutorial\/[\w.-]+)'/g)].map((match) => match[1]);
for (const image of images) await stat(resolve('public', image));

/* Модели, которые грузит игра, должны лежать в public/models. */
const modelList = sources[0].match(/files=\[([^\]]+)\]/);
if (!modelList) throw new Error('Model list was not found in main.js');
for (const name of modelList[1].split(',').map((part) => part.trim().replace(/'/g, ''))) {
  await stat(resolve('public/models', `${name}.glb`));
}

/* Конфиг кампании должен быть пригоден к запуску: без этого игра не стартует. */
if (CAMPAIGN_SHIFT_COUNT !== CAMPAIGN_SHIFTS.length) throw new Error('Campaign length does not match the level table');
for (const level of CAMPAIGN_SHIFTS) {
  if (!(level.duration > 0 && level.carSpawn.interval[0] > 0 && level.carSpawn.interval[1] >= level.carSpawn.interval[0])) {
    throw new Error(`Level ${level.number} spawn rate is invalid`);
  }
  if (!(level.queueSize >= 1 && level.customerPatience > 0 && level.orderIntensity >= 0 && level.orderIntensity <= 1)) {
    throw new Error(`Level ${level.number} pressure config is invalid`);
  }
  if (level.allowedEvents.some((type) => !EVENT_TYPES.includes(type))) throw new Error(`Level ${level.number} event pool is invalid`);
}

const legacy = migrateProgress({ money: 321, shift: 9, rep: 4.2, upgrades: { speed: 2 }, tutorial: true, sound: false, best: 99 });
if (legacy.saveVersion !== SAVE_VERSION || legacy.campaignComplete || legacy.money !== 321 || legacy.upgrades.speed !== 2 || legacy.sound !== false) {
  throw new Error('Legacy save migration failed');
}
const endless = migrateProgress({ shift: 12, playMode: PLAY_MODE.ENDLESS, campaignComplete: true });
if (endless.shift !== 12 || endless.campaignComplete || getShiftConfig(endless.shift, endless.playMode).mode !== PLAY_MODE.ENDLESS) {
  throw new Error('Endless mode preparation failed');
}

console.log(`Smoke test passed: ${required.length} required files, ${referenced.size} interface elements and ${CAMPAIGN_SHIFT_COUNT} levels are valid.`);
