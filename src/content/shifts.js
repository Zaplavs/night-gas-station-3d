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

const freezeRange = (range) => Object.freeze([...range]);

const defineShift = ({
  number,
  duration,
  carSpawn,
  queueSize,
  customerPatience,
  allowedEvents,
  eventSpawn,
  orderIntensity,
  mode = PLAY_MODE.CAMPAIGN,
}) => Object.freeze({
  number,
  mode,
  duration,
  carSpawn: Object.freeze({
    initialDelay: carSpawn.initialDelay,
    interval: freezeRange(carSpawn.interval),
    queueRetry: carSpawn.queueRetry ?? 2.5,
  }),
  queueSize,
  customerPatience,
  allowedEvents: Object.freeze([...allowedEvents]),
  eventSpawn: Object.freeze({
    initial: freezeRange(eventSpawn.initial),
    interval: freezeRange(eventSpawn.interval),
  }),
  orderIntensity,
});

export const CAMPAIGN_SHIFTS = Object.freeze([
  defineShift({
    number: 1,
    duration: 210,
    carSpawn: { initialDelay: 0.8, interval: [20, 28] },
    queueSize: 1,
    customerPatience: 46,
    allowedEvents: ['spill', 'bag', 'whisper'],
    eventSpawn: { initial: [28, 36], interval: [42, 56] },
    orderIntensity: 0.35,
  }),
  defineShift({
    number: 2,
    duration: 225,
    carSpawn: { initialDelay: 0.8, interval: [18, 25] },
    queueSize: 1,
    customerPatience: 44,
    allowedEvents: ['spill', 'bag', 'broken', 'whisper'],
    eventSpawn: { initial: [26, 34], interval: [39, 52] },
    orderIntensity: 0.45,
  }),
  defineShift({
    number: 3,
    duration: 240,
    carSpawn: { initialDelay: 0.7, interval: [16, 23] },
    queueSize: 2,
    customerPatience: 42,
    allowedEvents: ['spill', 'blackout', 'bag', 'broken', 'whisper'],
    eventSpawn: { initial: [24, 32], interval: [36, 49] },
    orderIntensity: 0.52,
  }),
  defineShift({
    number: 4,
    duration: 240,
    carSpawn: { initialDelay: 0.7, interval: [14, 21] },
    queueSize: 2,
    customerPatience: 40,
    allowedEvents: ['spill', 'blackout', 'bag', 'broken', 'van', 'whisper'],
    eventSpawn: { initial: [22, 30], interval: [34, 46] },
    orderIntensity: 0.6,
  }),
  defineShift({
    number: 5,
    duration: 255,
    carSpawn: { initialDelay: 0.6, interval: [12.5, 19] },
    queueSize: 2,
    customerPatience: 38,
    allowedEvents: EVENT_TYPES,
    eventSpawn: { initial: [20, 28], interval: [31, 43] },
    orderIntensity: 0.68,
  }),
  defineShift({
    number: 6,
    duration: 255,
    carSpawn: { initialDelay: 0.6, interval: [11, 17] },
    queueSize: 2,
    customerPatience: 36,
    allowedEvents: EVENT_TYPES,
    eventSpawn: { initial: [18, 26], interval: [28, 40] },
    orderIntensity: 0.76,
  }),
  defineShift({
    number: 7,
    duration: 300,
    carSpawn: { initialDelay: 0.5, interval: [9.5, 15] },
    queueSize: 2,
    customerPatience: 34,
    allowedEvents: EVENT_TYPES,
    eventSpawn: { initial: [16, 24], interval: [25, 37] },
    orderIntensity: 0.85,
  }),
]);

export const CAMPAIGN_SHIFT_COUNT = CAMPAIGN_SHIFTS.length;

export function randomFromRange([min, max], random = Math.random) {
  return min + (max - min) * random();
}

export function createEndlessShift(round = 1) {
  const number = Math.max(1, Math.floor(Number(round) || 1));
  const pressure = Math.min(6, Math.max(0, number - 1));

  return defineShift({
    number,
    mode: PLAY_MODE.ENDLESS,
    duration: 300,
    carSpawn: {
      initialDelay: 0.5,
      interval: [Math.max(7, 9.5 - pressure * 0.35), Math.max(11, 15 - pressure * 0.5)],
      queueRetry: 2,
    },
    queueSize: 2,
    customerPatience: Math.max(27, 34 - pressure),
    allowedEvents: EVENT_TYPES,
    eventSpawn: {
      initial: [14, 22],
      interval: [Math.max(20, 25 - pressure), Math.max(30, 37 - pressure)],
    },
    orderIntensity: Math.min(0.95, 0.85 + pressure * 0.015),
  });
}

export function getShiftConfig(number, mode = PLAY_MODE.CAMPAIGN) {
  if (mode === PLAY_MODE.ENDLESS) return createEndlessShift(number);

  const index = Math.max(0, Math.min(
    CAMPAIGN_SHIFT_COUNT - 1,
    Math.floor(Number(number) || 1) - 1,
  ));
  return CAMPAIGN_SHIFTS[index];
}

export function isFinalCampaignShift(config) {
  return config.mode === PLAY_MODE.CAMPAIGN && config.number === CAMPAIGN_SHIFT_COUNT;
}
