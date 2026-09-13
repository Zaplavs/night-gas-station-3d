import { CAMPAIGN_SHIFT_COUNT, PLAY_MODE } from './shifts.js';

/* v3: кампания выросла с 7 смен до 30 уровней, в сохранении появился
   номер пройденного уровня. Старые сейвы поднимаются сюда без потерь. */
export const SAVE_VERSION = 3;
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
  upgrades: Object.freeze({ speed: 0, service: 0, coffee: 0 }),
  tutorial: false,
  sound: true,
  musicVolume: 80,
  best: 0,
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
  const legacyCampaignDone = version < SAVE_VERSION && playMode === PLAY_MODE.CAMPAIGN
    && (Boolean(source.campaignComplete) || requestedShift > LEGACY_CAMPAIGN_LENGTH);
  const campaignComplete = playMode === PLAY_MODE.CAMPAIGN && !legacyCampaignDone
    ? Boolean(source.campaignComplete) && requestedShift >= CAMPAIGN_SHIFT_COUNT
    : false;

  let shift = requestedShift;
  if (playMode === PLAY_MODE.CAMPAIGN) {
    if (legacyCampaignDone) shift = Math.min(CAMPAIGN_SHIFT_COUNT, LEGACY_CAMPAIGN_LENGTH + 1);
    else if (campaignComplete) shift = CAMPAIGN_SHIFT_COUNT;
    else shift = Math.min(requestedShift, CAMPAIGN_SHIFT_COUNT);
  }

  const upgrades = source.upgrades && typeof source.upgrades === 'object' ? source.upgrades : {};
  const clearedFallback = playMode === PLAY_MODE.CAMPAIGN ? shift - 1 : 0;

  return {
    ...DEFAULT_PROGRESS,
    ...source,
    saveVersion: SAVE_VERSION,
    playMode,
    campaignComplete,
    campaignEarnings: nonNegativeInt(source.campaignEarnings),
    campaignServed: nonNegativeInt(source.campaignServed),
    levelsCleared: Math.min(
      CAMPAIGN_SHIFT_COUNT,
      Math.max(nonNegativeInt(source.levelsCleared, clearedFallback), clearedFallback),
    ),
    money: nonNegativeInt(source.money),
    shift,
    rep: Math.max(1, Math.min(5, finiteNumber(source.rep, DEFAULT_PROGRESS.rep))),
    upgrades: {
      speed: Math.min(3, nonNegativeInt(upgrades.speed)),
      service: Math.min(3, nonNegativeInt(upgrades.service)),
      coffee: Math.min(3, nonNegativeInt(upgrades.coffee)),
    },
    tutorial: Boolean(source.tutorial),
    sound: source.sound !== false,
    musicVolume: Math.max(0, Math.min(100, finiteNumber(source.musicVolume, DEFAULT_PROGRESS.musicVolume))),
    best: nonNegativeInt(source.best),
  };
}
