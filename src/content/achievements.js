/* Достижения — такая же таблица данных, как уровни.
   Каждое считается по одному счётчику: игра только увеличивает счётчики,
   а решение «выдано или нет» принимается здесь. Поэтому у любого достижения
   всегда есть понятный прогресс вида «12 / 50», а не загадочная галочка. */

/* Счётчики, которые копит сохранение. Всё остальное (главы, кампания, рекорд)
   выводится из уже имеющегося прогресса и потому засчитывается задним числом. */
export const TRACKED_STATS = Object.freeze({
  refuels: 0,
  coffee: 0,
  snacks: 0,
  hotdogs: 0,
  sodas: 0,
  restocks: 0,
  spills: 0,
  repairs: 0,
  blackouts: 0,
  bags: 0,
  vans: 0,
  tankers: 0,
  hurried: 0,
  bikes: 0,
  trucks: 0,
  buses: 0,
  busLoads: 0,
  rainNights: 0,
  served: 0,
  shifts: 0,
  flawless: 0,
  flawlessExams: 0,
  rushes: 0,
  endless: 0,
  earned: 0,
  jumps: 0,
});

const money = (value) => `₽${Math.floor(value)}`;

const define = ({ id, icon, name, description, stat, target, format }) => Object.freeze({
  id, icon, name, description, stat, target, format: format ?? null,
});

export const ACHIEVEMENTS = Object.freeze([
  // Первые разы: по одному на каждую механику смены.
  define({ id: 'first-tank', icon: '⛽', name: 'Первый бак', description: 'Заправить первую машину', stat: 'refuels', target: 1 }),
  define({ id: 'first-night', icon: '🌙', name: 'Первая ночь', description: 'Закрыть первую смену', stat: 'shifts', target: 1 }),
  define({ id: 'barista', icon: '☕', name: 'Бариста', description: 'Выдать 25 стаканов кофе', stat: 'coffee', target: 25 }),
  define({ id: 'night-kitchen', icon: '🥪', name: 'Ночная кухня', description: 'Выдать 25 сэндвичей', stat: 'snacks', target: 25 }),
  define({ id: 'grill-master', icon: '🌭', name: 'Гриль-мастер', description: 'Выдать 20 хот-догов', stat: 'hotdogs', target: 20 }),
  define({ id: 'cold-shelf', icon: '🥤', name: 'Холодная полка', description: 'Выдать 20 бутылок газировки', stat: 'sodas', target: 20 }),
  define({ id: 'stock-keeper', icon: '📦', name: 'Кладовщик', description: 'Десять раз принести запас со склада', stat: 'restocks', target: 10 }),
  define({ id: 'clean-floor', icon: '🧽', name: 'Чистый пол', description: 'Убрать десять пятен', stat: 'spills', target: 10 }),
  define({ id: 'mechanic', icon: '🔧', name: 'Механик', description: 'Починить пять колонок', stat: 'repairs', target: 5 }),
  define({ id: 'electrician', icon: '⚡', name: 'Электрик', description: 'Пять раз перезапустить щиток', stat: 'blackouts', target: 5 }),
  define({ id: 'honest-find', icon: '🎒', name: 'Честная находка', description: 'Вернуть пять забытых сумок', stat: 'bags', target: 5 }),
  define({ id: 'nobody-inside', icon: '👁', name: 'Внутри никого', description: 'Проверить странный фургон', stat: 'vans', target: 1 }),
  define({ id: 'delivery', icon: '🛢', name: 'Приёмка', description: 'Принять пять бензовозов', stat: 'tankers', target: 5 }),

  // Мастерство смены.
  define({ id: 'flawless', icon: '✨', name: 'Никого не упустил', description: 'Пройти уровень, не потеряв ни одного клиента', stat: 'flawless', target: 1 }),
  define({ id: 'flawless-five', icon: '💎', name: 'Пять безупречных', description: 'Пять уровней без потерянных клиентов', stat: 'flawless', target: 5 }),
  define({ id: 'clean-exam', icon: '🎓', name: 'Экзамен без потерь', description: 'Сдать экзамен, не потеряв ни одного клиента', stat: 'flawlessExams', target: 1 }),
  define({ id: 'rush-hour', icon: '🚦', name: 'Час пик', description: 'Пережить десять наплывов', stat: 'rushes', target: 10 }),
  define({ id: 'no-waiting', icon: '⏱', name: 'Не задерживаю', description: 'Обслужить 15 спешащих клиентов', stat: 'hurried', target: 15 }),
  define({ id: 'long-haul', icon: '🚛', name: 'Дальнобой', description: 'Заправить десять фур', stat: 'trucks', target: 10 }),
  define({ id: 'two-wheels', icon: '🏍', name: 'Два колеса', description: 'Заправить 15 мотоциклов', stat: 'bikes', target: 15 }),
  define({ id: 'full-house', icon: '🚌', name: 'Полный салон', description: 'Отпустить автобус, выдав все три заказа', stat: 'busLoads', target: 1 }),
  define({ id: 'downpour', icon: '🌧', name: 'Под дождём', description: 'Отработать три смены в дождь', stat: 'rainNights', target: 3 }),
  define({ id: 'regular', icon: '🛣', name: 'Свой на трассе', description: 'Обслужить 100 клиентов', stat: 'served', target: 100 }),
  define({ id: 'tanker', icon: '⛽', name: 'Цистерна', description: 'Заправить 50 машин', stat: 'refuels', target: 50 }),

  // Деньги.
  define({ id: 'good-night', icon: '📈', name: 'Удачная ночь', description: 'Заработать ₽800 за одну смену', stat: 'best', target: 800, format: money }),
  define({ id: 'cash-box', icon: '💰', name: 'Касса', description: 'Заработать ₽10000 за всё время', stat: 'earned', target: 10000, format: money }),

  // Кампания: засчитывается по пройденным главам, поэтому виден весь путь.
  define({ id: 'chapter-1', icon: '①', name: 'Первые ночи', description: 'Пройти главу 1', stat: 'chapters', target: 1 }),
  define({ id: 'chapter-2', icon: '②', name: 'Магазин', description: 'Пройти главу 2', stat: 'chapters', target: 2 }),
  define({ id: 'chapter-3', icon: '③', name: 'Очередь', description: 'Пройти главу 3', stat: 'chapters', target: 3 }),
  define({ id: 'chapter-4', icon: '④', name: 'Железо', description: 'Пройти главу 4', stat: 'chapters', target: 4 }),
  define({ id: 'chapter-5', icon: '⑤', name: 'Темнота', description: 'Пройти главу 5', stat: 'chapters', target: 5 }),
  define({ id: 'chapter-6', icon: '⑥', name: 'Хаос', description: 'Пройти главу 6', stat: 'chapters', target: 6 }),
  define({ id: 'dawn', icon: '🏁', name: 'Рассвет', description: 'Пройти все 30 уровней кампании', stat: 'levelsCleared', target: 30 }),
  define({ id: 'endless-nights', icon: '♾', name: 'Без конца', description: 'Отработать три ночи в бесконечном режиме', stat: 'endless', target: 3 }),

  // Просто так.
  define({ id: 'warm-up', icon: '🦘', name: 'Разминка', description: 'Подпрыгнуть 100 раз', stat: 'jumps', target: 100 }),
]);

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
const BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

export function getAchievement(id) {
  return BY_ID.get(id) ?? null;
}

const nonNegative = (value) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/* Сохранение может прийти из старой версии или из чужих рук: берём только
   известные счётчики и только неотрицательные целые. */
export function createStats(source) {
  const raw = source && typeof source === 'object' ? source : {};
  const stats = {};
  for (const key of Object.keys(TRACKED_STATS)) stats[key] = nonNegative(raw[key]);
  return stats;
}

export function sanitizeAchievements(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => BY_ID.has(id)))];
}

/* Счётчики смены плюс то, что и так известно о прогрессе. */
export function achievementStats(progress) {
  const stats = createStats(progress?.stats);
  const levelsCleared = nonNegative(progress?.levelsCleared);
  return {
    ...stats,
    levelsCleared,
    chapters: Math.floor(levelsCleared / 5),
    best: nonNegative(progress?.best),
  };
}

export function achievementProgress(achievement, stats) {
  const value = Math.min(stats[achievement.stat] ?? 0, achievement.target);
  const format = achievement.format ?? ((input) => `${input}`);
  return {
    value,
    target: achievement.target,
    done: (stats[achievement.stat] ?? 0) >= achievement.target,
    text: `${format(value)} / ${format(achievement.target)}`,
    ratio: Math.max(0, Math.min(1, value / achievement.target)),
  };
}

export function earnedAchievements(progress) {
  const stats = achievementStats(progress);
  return ACHIEVEMENTS.filter((achievement) => (stats[achievement.stat] ?? 0) >= achievement.target).map((a) => a.id);
}

/* Что выдать прямо сейчас: заработанное минус уже выданное. */
export function newlyUnlocked(progress) {
  const already = new Set(sanitizeAchievements(progress?.achievements));
  return earnedAchievements(progress).filter((id) => !already.has(id));
}
