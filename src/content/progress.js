import { CAMPAIGN_SHIFT_COUNT, PLAY_MODE } from './shifts.js';
import { TRACKED_STATS, createStats, sanitizeAchievements } from './achievements.js';
import { sanitizeUpgrades } from './upgrades.js';

/* v3: кампания выросла с 7 смен до 30 уровней, в сохранении появился номер
   пройденного уровня. v4: добавились счётчики достижений. v5: мелкие прибавки
   заменились выкупом самой станции — старые уровни улучшений возвращаются
   деньгами, а ботинки, которые никуда не делись, остаются купленными.
   Старые сейвы поднимаются сюда без потерь. */
export const SAVE_VERSION = 5;
export const STATION_UPGRADES_VERSION = 5;
/* Сколько стоили старые прибавки: столько же и вернётся в кассу. */
const LEGACY_UPGRADE_PRICES = Object.freeze({ speed: 200, service: 250, coffee: 180 });
export const CAMPAIGN_30_VERSION = 3;
export const LEGACY_CAMPAIGN_LENGTH = 7;

export const DEFAULT_PROGRESS = Object.freeze({
  saveVersion: SAVE_VERSION,
  playMode: PLAY_MODE.CAMPAIGN,
  campaignComplete: false,
  campaignEarnings: 0,
  campaignServed: 0,
  levelsCleared: 0,
  money: 0,
  shift: 1,
  rep: 3,
  upgrades: Object.freeze([]),
  tutorial: false,
  sound: true,
  musicVolume: 80,
  best: 0,
  achievements: Object.freeze([]),
  stats: Object.freeze({ ...TRACKED_STATS }),
});

const finiteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nonNegativeInt = (value, fallback = 0) => Math.max(0, Math.floor(finiteNumber(value, fallback)));

export function migrateProgress(saved) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const version = nonNegativeInt(source.saveVersion, 0);
  const playMode = source.playMode === PLAY_MODE.ENDLESS ? PLAY_MODE.ENDLESS : PLAY_MODE.CAMPAIGN;
  const requestedShift = Math.max(1, Math.floor(finiteNumber(source.shift, DEFAULT_PROGRESS.shift)));
  // Сейв из семисменной кампании: зачёт сохраняем, но ночи 8-30 ещё впереди.
  const legacyCampaignDone = version < CAMPAIGN_30_VERSION && playMode === PLAY_MODE.CAMPAIGN
    && (Boolean(source.campaignComplete) || requestedShift > LEGACY_CAMPAIGN_LENGTH);
  let shift = requestedShift;
  if (playMode === PLAY_MODE.CAMPAIGN) {
    shift = legacyCampaignDone
      ? Math.min(CAMPAIGN_SHIFT_COUNT, LEGACY_CAMPAIGN_LENGTH + 1)
      : Math.min(requestedShift, CAMPAIGN_SHIFT_COUNT);
  }

  const rawUpgrades = source.upgrades;
  const legacyUpgrades = rawUpgrades && !Array.isArray(rawUpgrades) && typeof rawUpgrades === 'object' ? rawUpgrades : null;
  const upgrades = legacyUpgrades
    ? sanitizeUpgrades(nonNegativeInt(legacyUpgrades.speed) > 0 ? ['boots'] : [])
    : sanitizeUpgrades(rawUpgrades);
  // Возврат за то, чего больше нет: ботинки остаются, остальное — деньгами.
  const refund = legacyUpgrades
    ? Math.min(3, nonNegativeInt(legacyUpgrades.service)) * LEGACY_UPGRADE_PRICES.service
      + Math.min(3, nonNegativeInt(legacyUpgrades.coffee)) * LEGACY_UPGRADE_PRICES.coffee
      + Math.max(0, Math.min(3, nonNegativeInt(legacyUpgrades.speed)) - 1) * LEGACY_UPGRADE_PRICES.speed
    : 0;
  const clearedFallback = playMode === PLAY_MODE.CAMPAIGN ? shift - 1 : 0;
  const levelsCleared = Math.min(
    CAMPAIGN_SHIFT_COUNT,
    Math.max(nonNegativeInt(source.levelsCleared, clearedFallback), clearedFallback),
  );
  const campaignComplete = playMode === PLAY_MODE.CAMPAIGN && !legacyCampaignDone
    && (Boolean(source.campaignComplete) || levelsCleared >= CAMPAIGN_SHIFT_COUNT);

  return {
    ...DEFAULT_PROGRESS,
    ...source,
    saveVersion: SAVE_VERSION,
    playMode,
    campaignComplete,
    campaignEarnings: nonNegativeInt(source.campaignEarnings),
    campaignServed: nonNegativeInt(source.campaignServed),
    levelsCleared,
    money: nonNegativeInt(source.money) + refund,
    shift,
    rep: Math.max(1, Math.min(5, finiteNumber(source.rep, DEFAULT_PROGRESS.rep))),
    upgrades,
    tutorial: Boolean(source.tutorial),
    sound: source.sound !== false,
    musicVolume: Math.max(0, Math.min(100, finiteNumber(source.musicVolume, DEFAULT_PROGRESS.musicVolume))),
    best: nonNegativeInt(source.best),
    achievements: sanitizeAchievements(source.achievements),
    stats: createStats(source.stats),
  };
}
