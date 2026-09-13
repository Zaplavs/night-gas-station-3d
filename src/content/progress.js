import { CAMPAIGN_SHIFT_COUNT, PLAY_MODE } from './shifts.js';

export const SAVE_VERSION = 2;

export const DEFAULT_PROGRESS = Object.freeze({
  saveVersion: SAVE_VERSION,
  playMode: PLAY_MODE.CAMPAIGN,
  campaignComplete: false,
  campaignEarnings: 0,
  campaignServed: 0,
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
  const playMode = source.playMode === PLAY_MODE.ENDLESS ? PLAY_MODE.ENDLESS : PLAY_MODE.CAMPAIGN;
  const requestedShift = Math.max(1, Math.floor(finiteNumber(source.shift, DEFAULT_PROGRESS.shift)));
  const completedLegacyCampaign = playMode === PLAY_MODE.CAMPAIGN && requestedShift > CAMPAIGN_SHIFT_COUNT;
  const campaignComplete = playMode === PLAY_MODE.CAMPAIGN
    ? Boolean(source.campaignComplete || completedLegacyCampaign)
    : false;
  const shift = playMode === PLAY_MODE.CAMPAIGN
    ? (campaignComplete ? CAMPAIGN_SHIFT_COUNT : Math.min(requestedShift, CAMPAIGN_SHIFT_COUNT))
    : requestedShift;
  const upgrades = source.upgrades && typeof source.upgrades === 'object' ? source.upgrades : {};

  return {
    ...DEFAULT_PROGRESS,
    ...source,
    saveVersion: SAVE_VERSION,
    playMode,
    campaignComplete,
    campaignEarnings: nonNegativeInt(source.campaignEarnings),
    campaignServed: nonNegativeInt(source.campaignServed),
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
