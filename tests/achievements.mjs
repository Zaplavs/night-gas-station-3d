/* Достижения как данные: таблица непротиворечива, счётчики чистятся,
   прогресс считается, а старый сейв получает заслуженное задним числом. */
import {
  ACHIEVEMENTS, ACHIEVEMENT_COUNT, TRACKED_STATS, getAchievement, createStats,
  sanitizeAchievements, achievementStats, achievementProgress, earnedAchievements, newlyUnlocked,
} from '../src/content/achievements.js';
import { migrateProgress, DEFAULT_PROGRESS, SAVE_VERSION } from '../src/content/progress.js';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

/* ─── Таблица ─── */
const DERIVED = ['levelsCleared', 'chapters', 'best'];
const ids = new Set();
check(ACHIEVEMENT_COUNT >= 20, `Достижений должно быть хотя бы 20, а не ${ACHIEVEMENT_COUNT}`);
for (const item of ACHIEVEMENTS) {
  const at = `Достижение ${item.id}`;
  check(!ids.has(item.id), `${at}: повторяющийся идентификатор`);
  ids.add(item.id);
  check(typeof item.name === 'string' && item.name.length > 2, `${at}: нужно название`);
  check(typeof item.description === 'string' && item.description.length > 8, `${at}: нужно описание`);
  check(typeof item.icon === 'string' && item.icon.length > 0, `${at}: нужен значок`);
  check(Number.isFinite(item.target) && item.target > 0, `${at}: цель должна быть положительной`);
  // Недостижимое достижение — худший вид: счётчик обязан существовать.
  check(item.stat in TRACKED_STATS || DERIVED.includes(item.stat), `${at}: считает несуществующий счётчик ${item.stat}`);
  check(getAchievement(item.id) === item, `${at}: не находится по идентификатору`);
}
check(getAchievement('нет такого') === null, 'Неизвестный идентификатор не должен ничего возвращать');
check(ACHIEVEMENTS.some((item) => item.stat === 'chapters'), 'Прохождение глав должно отмечаться');
check(ACHIEVEMENTS.filter((item) => item.stat === 'chapters').length === 6, 'Должно быть по достижению на главу');

/* Каждая механика смены должна быть чем-то отмечена. */
for (const stat of ['refuels', 'coffee', 'snacks', 'restocks', 'spills', 'repairs', 'blackouts', 'bags', 'vans', 'rushes', 'endless', 'jumps']) {
  check(ACHIEVEMENTS.some((item) => item.stat === stat), `Механика ${stat} не отмечена ни одним достижением`);
}

/* ─── Счётчики ─── */
const dirty = createStats({ refuels: 12, coffee: -5, snacks: 'нет', jumps: 3.7, взлом: 999 });
check(dirty.refuels === 12, 'Нормальный счётчик должен сохраняться');
check(dirty.coffee === 0, 'Отрицательный счётчик должен обнуляться');
check(dirty.snacks === 0, 'Нечисловой счётчик должен обнуляться');
check(dirty.jumps === 3, 'Дробный счётчик округляется вниз');
check(!('взлом' in dirty), 'Чужие ключи в счётчики не попадают');
check(Object.keys(dirty).length === Object.keys(TRACKED_STATS).length, 'Набор счётчиков фиксирован');
check(createStats(null).refuels === 0, 'Пустой источник даёт нулевые счётчики');

check(sanitizeAchievements(['first-tank', 'first-tank', 'выдуманное', 7]).length === 1, 'Список наград чистится от дублей и выдумок');
check(sanitizeAchievements('не массив').length === 0, 'Не массив — пустой список');

/* ─── Прогресс ─── */
const stats = achievementStats({ stats: { refuels: 20, earned: 4000 }, levelsCleared: 12, best: 640 });
check(stats.chapters === 2, `Из 12 пройденных уровней должно получиться 2 главы, а не ${stats.chapters}`);
check(stats.levelsCleared === 12 && stats.best === 640, 'Прогресс кампании должен попадать в счётчики');
const tanker = getAchievement('tanker'), progress = achievementProgress(tanker, stats);
check(progress.text === '20 / 50', `Прогресс читается неверно: ${progress.text}`);
check(!progress.done && Math.abs(progress.ratio - 0.4) < 1e-9, 'Незавершённое достижение не должно засчитываться');
const rich = achievementProgress(getAchievement('cash-box'), stats);
check(rich.text === '₽4000 / ₽10000', `Деньги должны показываться рублями: ${rich.text}`);
const capped = achievementProgress(getAchievement('first-tank'), stats);
check(capped.done && capped.value === 1 && capped.ratio === 1, 'Перевыполненное достижение не должно уезжать за 100%');

/* ─── Выдача ─── */
const earned = earnedAchievements({ stats: { refuels: 60, shifts: 3 }, levelsCleared: 10, best: 0 });
check(earned.includes('first-tank') && earned.includes('tanker'), 'Оба порога одного счётчика должны срабатывать');
check(earned.includes('chapter-1') && earned.includes('chapter-2') && !earned.includes('chapter-3'),
  'Главы должны засчитываться ровно по пройденному');
check(!earned.includes('dawn'), 'Финал кампании не должен выдаваться раньше времени');

const fresh = { stats: createStats({ refuels: 1 }), levelsCleared: 0, best: 0, achievements: [] };
check(newlyUnlocked(fresh).join() === 'first-tank', 'Новая награда должна выдаваться один раз');
check(newlyUnlocked({ ...fresh, achievements: ['first-tank'] }).length === 0, 'Выданное второй раз не выдаётся');
check(newlyUnlocked({ stats: createStats({}), levelsCleared: 0, best: 0, achievements: [] }).length === 0,
  'Без прогресса выдавать нечего');

/* ─── Сохранение ─── */
const migrated = migrateProgress({ saveVersion: 3, levelsCleared: 12, shift: 13, best: 900, stats: { refuels: 40, взлом: 5 }, achievements: ['first-tank', 'чужое'] });
check(migrated.saveVersion === SAVE_VERSION, 'Сейв должен подняться до текущей версии');
check(migrated.stats.refuels === 40 && !('взлом' in migrated.stats), 'Счётчики должны переезжать очищенными');
check(migrated.achievements.join() === 'first-tank', 'Награды должны переезжать очищенными');
check(migrated.levelsCleared === 12 && migrated.shift === 13, 'Прогресс кампании не должен пострадать');
const retro = newlyUnlocked(migrated);
check(retro.includes('chapter-1') && retro.includes('chapter-2') && retro.includes('good-night'),
  'Старому сейву положено получить заслуженное задним числом');
check(!retro.includes('first-tank'), 'Уже выданное задним числом не повторяется');

const old = migrateProgress({ money: 100, shift: 3 });
check(Array.isArray(old.achievements) && old.achievements.length === 0, 'Сейв без наград должен получить пустой список');
check(Object.keys(old.stats).length === Object.keys(TRACKED_STATS).length, 'Сейв без счётчиков должен получить нулевые');
check(migrateProgress(DEFAULT_PROGRESS).stats.refuels === 0, 'Значения по умолчанию проходят миграцию');
check(DEFAULT_PROGRESS.achievements.length === 0, 'Новая игра начинается без наград');

if (failures.length) {
  console.error(`Проверка достижений не прошла (${failures.length}):`);
  failures.forEach((message) => console.error(` • ${message}`));
  process.exit(1);
}
console.log(`Achievements test passed: ${ACHIEVEMENT_COUNT} achievements, counters, progress and retroactive unlocking are consistent.`);
