/* Быстрая проверка без браузера: файлы на месте, разметка совпадает с кодом.
   Содержимое кампании проверяет tests/levels.mjs. */
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CAMPAIGN_SHIFTS, CAMPAIGN_SHIFT_COUNT, EVENT_TYPES, PLAY_MODE, getShiftConfig } from '../src/content/shifts.js';
import { SAVE_VERSION, migrateProgress } from '../src/content/progress.js';
import { VEHICLE_ASSETS, VEHICLE_IDS, VEHICLES } from '../src/content/vehicles.js';
import { AD_COOLDOWN } from '../src/gamepush.js';

const required = ['index.html', 'src/main.js', 'src/gamepush.js', 'scripts/pack.mjs', 'src/content/shifts.js', 'src/content/progress.js', 'src/content/levels.js',
  'public/models/station.glb', 'public/models/second_floor.glb', 'public/models/pump.glb', 'public/models/car.glb',
  'public/models/mystery_van.glb', 'public/models/tanker.glb', 'public/models/worker.glb', 'public/models/bag.glb', 'public/models/cleaning_kit.glb',
  ...VEHICLE_ASSETS.map((name) => `public/models/${name}.glb`)];
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
const modelNames = modelList[1].split(',').map((part) => part.trim().replace(/'/g, ''))
  .flatMap((name) => (name === '...VEHICLE_ASSETS' ? VEHICLE_ASSETS : [name]));
for (const name of modelNames) await stat(resolve('public/models', `${name}.glb`));
if (!VEHICLE_IDS.every((id) => modelNames.includes(VEHICLES[id].asset))) throw new Error('A vehicle type has no model in the load list');

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

// Старые прибавки превратились в выкуп станции: ботинки остались, остальное вернулось деньгами.
const legacy = migrateProgress({ money: 321, shift: 9, rep: 4.2, upgrades: { speed: 2, coffee: 1 }, tutorial: true, sound: false, best: 99 });
if (legacy.saveVersion !== SAVE_VERSION || legacy.campaignComplete || legacy.sound !== false
  || !Array.isArray(legacy.upgrades) || !legacy.upgrades.includes('boots') || legacy.money !== 321 + 200 + 180) {
  throw new Error('Legacy save migration failed');
}
const endless = migrateProgress({ shift: 12, playMode: PLAY_MODE.ENDLESS, campaignComplete: true });
if (endless.shift !== 12 || endless.campaignComplete || getShiftConfig(endless.shift, endless.playMode).mode !== PLAY_MODE.ENDLESS) {
  throw new Error('Endless mode preparation failed');
}

/* ─────────── Готовность к площадке ───────────
   Требования GamePush и Пикабу Игр: название на обложке совпадает с названием игры,
   иконка без надписей, скриншоты нужного размера, никаких внешних ссылок в разметке,
   полноэкранная реклама не чаще чем раз в три минуты. */
const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
if (!pkg.scripts.release?.includes('pack.mjs')) throw new Error('npm run release does not build the platform archive');
if (AD_COOLDOWN < 180000) throw new Error('Fullscreen ads must not run more often than once every three minutes');
const initCall = sources[0].match(/initGamePush\([\s\S]*?\}\);/)?.[0] ?? '';
if (initCall.includes('bindAdPause')) throw new Error('Ad pause must not depend on a cloud save being present');
if (!sources[0].split(/\r?\n/).some((line) => line.startsWith('bindAdPause('))) throw new Error('Ads do not pause the shift');

const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
if (title !== 'Ночная заправка 3D') throw new Error(`Page title does not match the game name: ${title}`);
const menuTitle = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
if (menuTitle !== 'НОЧНАЯ ЗАПРАВКА 3D') throw new Error(`Menu title does not match the game name: ${menuTitle}`);
if (!html.includes('id="rotate"')) throw new Error('Portrait phones are not asked to rotate');
const external = [...html.matchAll(/(?:href|src)="(https?:)?\/\/[^"]+"/g)].map((match) => match[0]);
if (external.length) throw new Error(`index.html must not link out of the game: ${external.join(', ')}`);

/* Размеры промо-материалов заданы площадкой, а пересобираются они скриптом съёмки. */
const pngSize = async (file) => {
  const head = (await readFile(resolve(file))).subarray(16, 24);
  return `${head.readUInt32BE(0)}x${head.readUInt32BE(4)}`;
};
if (await pngSize('promo/icon-1024x1024.png') !== '1024x1024') throw new Error('Icon must be 1024x1024');
if (await pngSize('promo/cover-1920x1080.png') !== '1920x1080') throw new Error('Cover must be 1920x1080');
const shots = (await readdir(resolve('promo/screenshots'))).filter((name) => name.endsWith('.png'));
if (shots.length < 4) throw new Error('At least four screenshots are required');
for (const shot of shots) {
  if (await pngSize(`promo/screenshots/${shot}`) !== '1280x720') throw new Error(`Screenshot ${shot} must be 1280x720`);
}

console.log(`Smoke test passed: ${required.length} required files, ${referenced.size} interface elements, ${CAMPAIGN_SHIFT_COUNT} levels and the store package are valid.`);
