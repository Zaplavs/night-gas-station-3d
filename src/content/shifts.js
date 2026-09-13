import {
  CAMPAIGN_LEVELS, CAMPAIGN_LEVEL_COUNT, CHAPTERS, LEVELS_PER_CHAPTER,
  getChapter, getLevel, goalLines, goalProgress, evaluateGoal, hardFailure,
  activeRush, dueScripted, nextLevel, isLevelUnlocked, chapterLevels,
} from './levels.js';

export const PLAY_MODE = Object.freeze({
  CAMPAIGN: 'campaign',
  ENDLESS: 'endless',
});

export const EVENT_TYPES = Object.freeze([
  'spill',
  'blackout',
  'bag',
  'broken',
  'van',
  'whisper',
]);

export {
  CAMPAIGN_LEVELS, CHAPTERS, LEVELS_PER_CHAPTER,
  getChapter, getLevel, goalLines, goalProgress, evaluateGoal, hardFailure,
  activeRush, dueScripted, nextLevel, isLevelUnlocked, chapterLevels,
};

/* Кампания — это таблица уровней; смена и уровень здесь одно и то же. */
export const CAMPAIGN_SHIFTS = CAMPAIGN_LEVELS;
export const CAMPAIGN_SHIFT_COUNT = CAMPAIGN_LEVEL_COUNT;

export function randomFromRange([min, max], random = Math.random) {
  return min + (max - min) * random();
}

/* Бесконечный режим включается после 30-го уровня и живёт по тем же полям,
   только без цели: играют на счёт, пока не кончится ночь. */
export function createEndlessShift(round = 1) {
  const number = Math.max(1, Math.floor(Number(round) || 1));
  const pressure = Math.min(8, Math.max(0, number - 1));

  return Object.freeze({
    number,
    chapter: CHAPTERS.length,
    name: `Бесконечная ночь ${number}`,
    brief: 'Цели нет — работайте, пока не рассветёт, и держите репутацию.',
    exam: false,
    mode: PLAY_MODE.ENDLESS,
    duration: 300,
    goal: Object.freeze({}),
    carSpawn: Object.freeze({
      initialDelay: 0.6,
      interval: Object.freeze([
        Math.max(6.5, 11 - pressure * 0.45),
        Math.max(9.5, 15 - pressure * 0.6),
      ]),
      queueRetry: 2,
    }),
    queueSize: number > 3 ? 3 : 2,
    customerPatience: Math.max(34, 44 - pressure * 1.2),
    orderIntensity: Math.min(0.9, 0.7 + pressure * 0.025),
    orderMenu: Object.freeze(['coffee', 'snack']),
    startStock: Object.freeze({ coffee: 2, snack: 2 }),
    pumpsOnline: 2,
    allowedEvents: EVENT_TYPES,
    eventSpawn: Object.freeze({
      initial: Object.freeze([20, 30]),
      interval: Object.freeze([
        Math.max(26, 40 - pressure * 1.6),
        Math.max(36, 54 - pressure * 2),
      ]),
    }),
    scripted: Object.freeze([]),
    rushes: Object.freeze([
      Object.freeze({
        id: `endless-${number}-rush`,
        at: 110,
        duration: 40,
        interval: Object.freeze([Math.max(5, 7 - pressure * 0.2), Math.max(7.5, 9.5 - pressure * 0.25)]),
        queueBoost: 2,
        label: 'Наплыв',
      }),
    ]),
  });
}

export function getShiftConfig(number, mode = PLAY_MODE.CAMPAIGN) {
  if (mode === PLAY_MODE.ENDLESS) return createEndlessShift(number);
  return getLevel(number);
}

export function isFinalCampaignShift(config) {
  return config.mode === PLAY_MODE.CAMPAIGN && config.number === CAMPAIGN_SHIFT_COUNT;
}
