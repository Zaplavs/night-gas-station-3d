/* Станция растёт на заработанное. Каждое улучшение покупается один раз, стоит
   заметных денег и меняет саму заправку, а не цифру в невидимой формуле:
   его видно на площадке и слышно по работе. Порядок в списке — порядок открытия. */

const define = (spec) => Object.freeze({
  /* На каком уровне кампании улучшение появляется в списке. */
  unlock: 1,
  ...spec,
});

export const UPGRADES = Object.freeze([
  define({
    id: 'boots', icon: '▲', name: 'Рабочие ботинки', cost: 700, unlock: 1,
    hint: 'Ходить по станции на 18% быстрее',
    note: 'Первое, на что тратят ночную выручку: между колонкой и прилавком бегать всю ночь.',
  }),
  define({
    id: 'coffeeBar', icon: '☕', name: 'Вторая кофемашина', cost: 1200, unlock: 3,
    hint: 'Кофе готовится вдвое быстрее',
    note: 'Вторая машина на прилавке: два стакана варятся разом, очередь у кассы тает.',
  }),
  define({
    id: 'floodlights', icon: '☀', name: 'Прожекторы над площадкой', cost: 2000, unlock: 5,
    hint: 'Клиенты ждут на 12% дольше',
    note: 'Свет на мачтах по краям площадки. Видно, что работа идёт, и ждут спокойнее.',
  }),
  define({
    id: 'roadSign', icon: '◆', name: 'Щит на трассе', cost: 2800, unlock: 8,
    hint: 'Машины сворачивают к вам чаще',
    note: 'Подсвеченный щит у дороги. Ночью его видно за километр — поток плотнее.',
  }),
  define({
    id: 'fastPumps', icon: '⛽', name: 'Скоростные насосы', cost: 4200, unlock: 11,
    hint: 'Заправка на четверть быстрее',
    note: 'Новые пистолеты на всех постах: бак наполняется заметно быстрее.',
  }),
  define({
    id: 'thirdBay', icon: '③', name: 'Третий пост навсегда', cost: 6000, unlock: 12,
    hint: 'Левый пост открыт каждую ночь',
    note: 'Пост выкуплен насовсем. Не работает только в те ночи, когда колонки закрыты аварией.',
  }),
  define({
    id: 'cart', icon: '▤', name: 'Тележка для коробок', cost: 8500, unlock: 14,
    hint: 'Один подъём на склад пополняет все запасы',
    note: 'Тележка у стеллажей: грузите на неё всё, что кончилось, и спускаетесь один раз.',
  }),
]);

export const UPGRADE_IDS = Object.freeze(UPGRADES.map((upgrade) => upgrade.id));
export const UPGRADE_COUNT = UPGRADES.length;
const BY_ID = Object.freeze(Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, upgrade])));

export function getUpgrade(id) {
  return BY_ID[id] ?? null;
}

/* В сохранении лежит список купленного: порядок и мусор значения не имеют. */
export function sanitizeUpgrades(list) {
  const owned = new Set(Array.isArray(list) ? list : []);
  return Object.freeze(UPGRADE_IDS.filter((id) => owned.has(id)));
}

export function hasUpgrade(progress, id) {
  return Array.isArray(progress?.upgrades) && progress.upgrades.includes(id);
}

/* Список открывается постепенно: до своего уровня улучшение не показывают,
   чтобы первая ночь не выглядела как витрина магазина. */
export function isUpgradeVisible(upgrade, levelsCleared) {
  return (upgrade?.unlock ?? 1) <= Math.max(1, levelsCleared + 1);
}

export function visibleUpgrades(levelsCleared) {
  return UPGRADES.filter((upgrade) => isUpgradeVisible(upgrade, levelsCleared));
}

export function affordableUpgrades(progress) {
  const owned = new Set(progress?.upgrades ?? []);
  return visibleUpgrades(progress?.levelsCleared ?? 0)
    .filter((upgrade) => !owned.has(upgrade.id) && (progress?.money ?? 0) >= upgrade.cost);
}

/* Эффекты, которые меняют саму смену. Всё остальное живёт в игровом коде,
   но здесь видно одним списком, за что игрок платит. */
export const UPGRADE_EFFECTS = Object.freeze({
  bootsSpeed: 1.18,
  coffeeSpeed: 0.5,
  patience: 1.12,
  trafficInterval: 0.88,
  fuelSpeed: 0.75,
});

/* Ночь с выкупленным постом. Уровни про аварию (bayLock) остаются как были:
   там закрытая колонка — это задание, а не нехватка денег. */
export function applyUpgradesToShift(config, owned) {
  const has = (id) => Array.isArray(owned) && owned.includes(id);
  const patched = { ...config };
  if (has('thirdBay') && !config.bayLock) patched.pumpsOnline = Math.max(config.pumpsOnline, 3);
  if (has('floodlights')) patched.customerPatience = Math.round(config.customerPatience * UPGRADE_EFFECTS.patience);
  if (has('roadSign')) {
    const scale = UPGRADE_EFFECTS.trafficInterval;
    patched.carSpawn = {
      ...config.carSpawn,
      interval: [config.carSpawn.interval[0] * scale, config.carSpawn.interval[1] * scale],
    };
    patched.rushes = config.rushes.map((rush) => ({
      ...rush,
      interval: [rush.interval[0] * scale, rush.interval[1] * scale],
    }));
  }
  return patched;
}
