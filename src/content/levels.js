/* Кампания из 30 уровней, шесть глав по пять ночей.
   Уровень — это данные, а не ветка в игровом цикле: набор целей, окно терпения,
   расписание гарантированных событий и наплывов. Механики открываются постепенно
   через эти же поля: нет заказов — orderIntensity 0, нет склада — полные полки,
   нет поломок — событие не входит в allowedEvents, третий пост закрыт — pumpsOnline 2. */

export const CHAPTERS = Object.freeze([
  Object.freeze({ number: 1, title: 'Первые ночи', subtitle: 'Колонка, пистолет и один клиент за раз' }),
  Object.freeze({ number: 2, title: 'Магазин', subtitle: 'Кофе, еда и склад на втором этаже' }),
  Object.freeze({ number: 3, title: 'Три поста', subtitle: 'Очередь, левая колонка и те, кто спешит' }),
  Object.freeze({ number: 4, title: 'Железо', subtitle: 'Колонки ломаются, а топливо привозят по ночам' }),
  Object.freeze({ number: 5, title: 'Темнота', subtitle: 'Свет гаснет, а трасса не ждёт' }),
  Object.freeze({ number: 6, title: 'Хаос', subtitle: 'Всё сразу и до самого рассвета' }),
]);

/* Погода — это не только вид из окна: в дождь и туман ночь читается иначе,
   а расписание уровня добавляет к ней своих происшествий. */
export const WEATHER = Object.freeze({
  clear: Object.freeze({ id: 'clear', label: 'Ясно', tag: 'ясно', note: '' }),
  rain: Object.freeze({ id: 'rain', label: 'Дождь', tag: 'дождь', note: 'Идёт дождь: с колёс на пол несут грязь.' }),
  fog: Object.freeze({ id: 'fog', label: 'Туман', tag: 'туман', note: 'Станцию затянуло туманом — фары видно в последний момент.' }),
});

/* Спешащий клиент платит вдвое, но ждать почти не станет. */
export const HURRY_PATIENCE = 0.55;
export const HURRY_PAYOUT = 1.9;

/* Цели уровня. Каждая описывает себя сама, чтобы игрок до старта знал,
   что от него хотят, а на итогах — что именно не получилось. */
const GOAL_RULES = Object.freeze({
  served: {
    label: 'Обслужено',
    describe: (target) => `Обслужить ${target} машин`,
    value: (stats) => stats.served,
    ok: (stats, target) => stats.served >= target,
    fail: (stats, target) => `Обслужено ${stats.served} из ${target} машин`,
  },
  earn: {
    label: 'Выручка',
    describe: (target) => `Заработать ₽${target}`,
    value: (stats) => stats.earned,
    format: (value) => `₽${Math.floor(value)}`,
    ok: (stats, target) => stats.earned >= target,
    fail: (stats, target) => `Заработано ₽${Math.floor(stats.earned)} из ₽${target}`,
  },
  rep: {
    label: 'Репутация',
    describe: (target) => `Удержать репутацию ${target.toFixed(1)}★`,
    value: (stats) => stats.rep,
    format: (value) => `${value.toFixed(1)}★`,
    ok: (stats, target) => stats.rep >= target - 0.001,
    fail: (stats, target) => `Репутация ${stats.rep.toFixed(1)}★ ниже нужных ${target.toFixed(1)}★`,
  },
  maxLost: {
    label: 'Потеряно',
    describe: (target) => target === 0 ? 'Не упустить ни одного клиента' : `Упустить не больше ${target} клиентов`,
    value: (stats) => stats.lost,
    countdown: true,
    ok: (stats, target) => stats.lost <= target,
    fail: (stats, target) => `Упущено клиентов: ${stats.lost}, допустимо ${target}`,
  },
});

export const GOAL_ORDER = Object.freeze(['served', 'earn', 'rep', 'maxLost']);

const range = (value) => Object.freeze([value[0], value[1]]);

const defineLevel = ({
  number,
  chapter,
  name,
  brief,
  duration,
  goal,
  carSpawn,
  queueSize = 1,
  customerPatience,
  hurryChance = 0,
  orderIntensity = 0,
  orderMenu = [],
  startStock = { coffee: 5, snack: 5 },
  pumpsOnline = 2,
  fuelReserve = null,
  weather = 'clear',
  allowedEvents = [],
  eventSpawn = { initial: [999, 999], interval: [999, 999] },
  scripted = [],
  rushes = [],
  exam = false,
}) => Object.freeze({
  number,
  chapter,
  name,
  brief,
  exam,
  mode: 'campaign',
  duration,
  goal: Object.freeze({ ...goal }),
  carSpawn: Object.freeze({
    initialDelay: carSpawn.initialDelay ?? 1,
    interval: range(carSpawn.interval),
    queueRetry: carSpawn.queueRetry ?? 2.5,
  }),
  queueSize,
  customerPatience,
  hurryChance,
  orderIntensity,
  orderMenu: Object.freeze([...orderMenu]),
  startStock: Object.freeze({ coffee: startStock.coffee, snack: startStock.snack }),
  pumpsOnline,
  fuelReserve,
  weather,
  allowedEvents: Object.freeze([...allowedEvents]),
  eventSpawn: Object.freeze({
    initial: range(eventSpawn.initial),
    interval: range(eventSpawn.interval),
  }),
  scripted: Object.freeze(scripted.map((entry, index) => Object.freeze({ id: `${number}-${index}`, at: entry.at, event: entry.event }))),
  rushes: Object.freeze(rushes.map((entry, index) => Object.freeze({
    id: `${number}-rush-${index}`,
    at: entry.at,
    duration: entry.duration,
    interval: range(entry.interval),
    queueBoost: entry.queueBoost ?? 1,
    label: entry.label,
  }))),
});

const ALL_EVENTS = ['spill', 'blackout', 'bag', 'broken', 'van', 'tanker', 'whisper'];

export const CAMPAIGN_LEVELS = Object.freeze([
  /* ── Глава 1. Первые ночи: одна машина за раз, ничего не отвлекает ── */
  defineLevel({
    number: 1, chapter: 1, name: 'Первая заправка',
    brief: 'Снимите пистолет с колонки, заправьте машину и проводите её.',
    duration: 170, goal: { served: 3 },
    carSpawn: { initialDelay: 1.5, interval: [24, 30] },
    customerPatience: 62,
  }),
  defineLevel({
    number: 2, chapter: 1, name: 'Ритм колонки',
    brief: 'Машины пошли чаще. Возвращайте пистолет и сразу идите к следующей.',
    duration: 185, goal: { served: 5, rep: 2.8 },
    carSpawn: { initialDelay: 1.2, interval: [19, 25] },
    customerPatience: 58,
  }),
  defineLevel({
    number: 3, chapter: 1, name: 'Кофе для дальнобойщика',
    brief: 'После заправки просят кофе. Аппарат — у прилавка под табличкой «КОФЕ».',
    duration: 200, goal: { served: 6 },
    carSpawn: { initialDelay: 1, interval: [18, 24] },
    customerPatience: 56, orderIntensity: 0.55, orderMenu: ['coffee'],
  }),
  defineLevel({
    number: 4, chapter: 1, name: 'Дождь над трассой',
    brief: 'Первый дождь за смену: с колёс несут грязь, и пол чистым долго не будет.',
    duration: 200, goal: { served: 6, rep: 3 },
    carSpawn: { initialDelay: 1, interval: [17, 23] },
    customerPatience: 54, orderIntensity: 0.5, orderMenu: ['coffee'], weather: 'rain',
    allowedEvents: ['spill'], eventSpawn: { initial: [70, 85], interval: [70, 90] },
    scripted: [{ at: 34, event: 'spill' }],
  }),
  defineLevel({
    number: 5, chapter: 1, name: 'Ночь без пауз', exam: true,
    brief: 'Экзамен первой главы: поток не прерывается, а в середине ночи придёт колонна.',
    duration: 215, goal: { served: 8, maxLost: 1 },
    carSpawn: { initialDelay: 0.8, interval: [15, 20] },
    customerPatience: 50, orderIntensity: 0.55, orderMenu: ['coffee'],
    allowedEvents: ['spill'], eventSpawn: { initial: [55, 70], interval: [60, 80] },
    scripted: [{ at: 40, event: 'spill' }],
    rushes: [{ at: 110, duration: 32, interval: [7, 10], label: 'Колонна с трассы' }],
  }),

  /* ── Глава 2. Магазин: еда, пустые полки и склад наверху ── */
  defineLevel({
    number: 6, chapter: 2, name: 'Сэндвич в дорогу',
    brief: 'К кофе добавилась еда. Витрина — справа от прилавка, под табличкой «ЕДА».',
    duration: 215, goal: { served: 7 },
    carSpawn: { initialDelay: 1, interval: [17, 22] },
    customerPatience: 52, orderIntensity: 0.6, orderMenu: ['coffee', 'snack'],
  }),
  defineLevel({
    number: 7, chapter: 2, name: 'Пустая полка',
    brief: 'Кофе в аппарате почти нет. Запас лежит на складе — по лестнице справа.',
    duration: 225, goal: { served: 7, earn: 520 },
    carSpawn: { initialDelay: 1, interval: [17, 22] },
    customerPatience: 52, orderIntensity: 0.65, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 1, snack: 4 },
  }),
  defineLevel({
    number: 8, chapter: 2, name: 'Склад наверху',
    brief: 'Полки пустые с самого начала. Сходите наверх заранее, пока нет очереди.',
    duration: 230, goal: { served: 8, rep: 3 },
    carSpawn: { initialDelay: 1.4, interval: [16, 21] },
    customerPatience: 50, orderIntensity: 0.7, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 0, snack: 1 },
    allowedEvents: ['spill'], eventSpawn: { initial: [75, 95], interval: [75, 95] },
  }),
  defineLevel({
    number: 9, chapter: 2, name: 'Туман и забытая сумка',
    brief: 'Туман сел на трассу, а у входа кто-то оставил сумку. Ящик «НАХОДКИ» — справа в магазине.',
    duration: 230, goal: { served: 8, maxLost: 2 },
    carSpawn: { initialDelay: 1, interval: [15, 20] },
    customerPatience: 48, orderIntensity: 0.65, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 3, snack: 3 }, weather: 'fog',
    allowedEvents: ['spill', 'bag'], eventSpawn: { initial: [60, 75], interval: [55, 75] },
    scripted: [{ at: 45, event: 'bag' }],
  }),
  defineLevel({
    number: 10, chapter: 2, name: 'Перед рассветом', exam: true,
    brief: 'Экзамен второй главы: пустые полки, наплыв и никакого запаса времени.',
    duration: 250, goal: { served: 11, maxLost: 2 },
    carSpawn: { initialDelay: 0.8, interval: [14, 19] },
    customerPatience: 46, orderIntensity: 0.7, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 1, snack: 1 },
    allowedEvents: ['spill', 'bag'], eventSpawn: { initial: [50, 65], interval: [50, 70] },
    scripted: [{ at: 38, event: 'spill' }],
    rushes: [{ at: 130, duration: 36, interval: [7, 9.5], label: 'Автобус на заправке' }],
  }),

  /* ── Глава 3. Три поста: очередь, левая колонка и те, кто спешит ── */
  defineLevel({
    number: 11, chapter: 3, name: 'Двое в очереди',
    brief: 'Теперь в очередь встают двое. Обслуживайте по порядку, первый ждёт дольше всех.',
    duration: 235, goal: { served: 9 },
    carSpawn: { initialDelay: 0.9, interval: [14, 19] }, queueSize: 2,
    customerPatience: 48, orderIntensity: 0.6, orderMenu: ['coffee', 'snack'],
  }),
  defineLevel({
    number: 12, chapter: 3, name: 'Третий пост',
    brief: 'Слева открыли третий пост под собственной мачтой. Машин влезает больше, зато и бегать дальше.',
    duration: 240, goal: { served: 11, earn: 820 },
    carSpawn: { initialDelay: 0.8, interval: [13, 17] }, queueSize: 3, pumpsOnline: 3,
    customerPatience: 48, orderIntensity: 0.65, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 3, snack: 3 },
    allowedEvents: ['spill', 'bag'], eventSpawn: { initial: [60, 80], interval: [55, 75] },
  }),
  defineLevel({
    number: 13, chapter: 3, name: 'Кто-то очень спешит',
    brief: 'Часть клиентов сегодня торопится: платят вдвое, но ждут вдвое меньше. Их машины — жёлтые.',
    duration: 240, goal: { served: 10, maxLost: 2 },
    carSpawn: { initialDelay: 0.8, interval: [14, 18] }, queueSize: 2, pumpsOnline: 3,
    customerPatience: 46, hurryChance: 0.4, orderIntensity: 0.55, orderMenu: ['coffee', 'snack'],
    allowedEvents: ['spill'], eventSpawn: { initial: [65, 80], interval: [60, 80] },
  }),
  defineLevel({
    number: 14, chapter: 3, name: 'Заказ за заказом',
    brief: 'Третий пост закрыт на профилактику, зато почти каждый просит кофе или сэндвич.',
    duration: 245, goal: { served: 11, rep: 3.2 },
    carSpawn: { initialDelay: 0.8, interval: [13, 17] }, queueSize: 2,
    customerPatience: 46, orderIntensity: 0.92, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 2, snack: 2 },
    allowedEvents: ['spill', 'bag'], eventSpawn: { initial: [55, 70], interval: [50, 70] },
  }),
  defineLevel({
    number: 15, chapter: 3, name: 'Колонна фур', exam: true,
    brief: 'Экзамен третьей главы: три поста, две волны подряд и спешащие водители.',
    duration: 265, goal: { served: 14, maxLost: 2 },
    carSpawn: { initialDelay: 0.7, interval: [12, 16] }, queueSize: 3, pumpsOnline: 3,
    customerPatience: 44, hurryChance: 0.3, orderIntensity: 0.75, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 2, snack: 2 },
    allowedEvents: ['spill', 'bag'], eventSpawn: { initial: [50, 65], interval: [45, 65] },
    scripted: [{ at: 40, event: 'spill' }],
    rushes: [
      { at: 75, duration: 34, interval: [6.5, 9], label: 'Первая волна' },
      { at: 170, duration: 38, interval: [6, 8.5], queueBoost: 2, label: 'Вторая волна' },
    ],
  }),

  /* ── Глава 4. Железо: поломки, закрытая колонка и приёмка топлива ── */
  defineLevel({
    number: 16, chapter: 4, name: 'Заклинило',
    brief: 'Колонка встанет. Ящик с инструментом — у левой стены магазина.',
    duration: 245, goal: { served: 10 },
    carSpawn: { initialDelay: 1, interval: [14, 18] }, queueSize: 2, pumpsOnline: 3,
    customerPatience: 46, orderIntensity: 0.6, orderMenu: ['coffee', 'snack'],
    allowedEvents: ['spill', 'broken'], eventSpawn: { initial: [70, 85], interval: [55, 75] },
    scripted: [{ at: 45, event: 'broken' }],
  }),
  defineLevel({
    number: 17, chapter: 4, name: 'Одна колонка',
    brief: 'Работает только первая колонка. Вся ночь — через неё, очередь будет длинной.',
    duration: 250, goal: { served: 9, maxLost: 2 },
    carSpawn: { initialDelay: 1, interval: [15, 19] }, queueSize: 3, pumpsOnline: 1,
    customerPatience: 52, orderIntensity: 0.6, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 3, snack: 3 },
    allowedEvents: ['spill', 'bag'], eventSpawn: { initial: [60, 75], interval: [55, 75] },
  }),
  defineLevel({
    number: 18, chapter: 4, name: 'Приедет бензовоз',
    brief: 'В резервуаре осталось на восемь заправок. Ночью привезут топливо: возьмите рукав и слейте его в горловину слева.',
    duration: 255, goal: { served: 11, rep: 3 },
    carSpawn: { initialDelay: 0.9, interval: [13, 17] }, queueSize: 2,
    customerPatience: 48, orderIntensity: 0.65, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 2, snack: 2 }, fuelReserve: 8,
    allowedEvents: ['spill', 'broken', 'tanker'], eventSpawn: { initial: [60, 75], interval: [50, 70] },
    scripted: [{ at: 70, event: 'tanker' }],
  }),
  defineLevel({
    number: 19, chapter: 4, name: 'Странный фургон',
    brief: 'К дальней стоянке подъедет фургон без фар. Проверьте его, когда будет минута, — и не пропустите бензовоз.',
    duration: 255, goal: { served: 11, maxLost: 2 },
    carSpawn: { initialDelay: 0.9, interval: [13, 17] }, queueSize: 2, pumpsOnline: 3,
    customerPatience: 44, hurryChance: 0.25, orderIntensity: 0.7, orderMenu: ['coffee', 'snack'],
    fuelReserve: 12,
    allowedEvents: ['spill', 'broken', 'van', 'tanker', 'whisper'], eventSpawn: { initial: [50, 65], interval: [45, 62] },
    scripted: [{ at: 55, event: 'van' }, { at: 130, event: 'tanker' }],
  }),
  defineLevel({
    number: 20, chapter: 4, name: 'Всё сразу', exam: true,
    brief: 'Экзамен четвёртой главы: поломка, наплыв, пустые полки и приёмка топлива в одну смену.',
    duration: 275, goal: { served: 14, maxLost: 2 },
    carSpawn: { initialDelay: 0.7, interval: [12, 16] }, queueSize: 3, pumpsOnline: 3,
    customerPatience: 42, orderIntensity: 0.75, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 1, snack: 1 }, fuelReserve: 9, weather: 'rain',
    allowedEvents: ['spill', 'broken', 'bag', 'tanker', 'whisper'], eventSpawn: { initial: [45, 60], interval: [40, 55] },
    scripted: [{ at: 50, event: 'broken' }, { at: 95, event: 'tanker' }, { at: 190, event: 'spill' }],
    rushes: [{ at: 130, duration: 40, interval: [6, 8.5], queueBoost: 2, label: 'Ночной наплыв' }],
  }),

  /* ── Глава 5. Темнота: щиток, тишина и работа вслепую ── */
  defineLevel({
    number: 21, chapter: 5, name: 'Свет мигнул',
    brief: 'Ночью вырубит электричество. Без света не работает ничего — сначала щиток.',
    duration: 255, goal: { served: 11 },
    carSpawn: { initialDelay: 1, interval: [14, 18] }, queueSize: 2,
    customerPatience: 48, orderIntensity: 0.6, orderMenu: ['coffee', 'snack'],
    allowedEvents: ['spill', 'blackout'], eventSpawn: { initial: [80, 95], interval: [60, 80] },
    scripted: [{ at: 60, event: 'blackout' }],
  }),
  defineLevel({
    number: 22, chapter: 5, name: 'Во тьме',
    brief: 'Щиток выбьет дважды, и все три поста встанут вместе с ним. Руки держите свободными.',
    duration: 265, goal: { served: 12, maxLost: 2 },
    carSpawn: { initialDelay: 0.9, interval: [13, 17] }, queueSize: 2, pumpsOnline: 3,
    customerPatience: 46, orderIntensity: 0.65, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 2, snack: 2 },
    allowedEvents: ['spill', 'blackout', 'broken'], eventSpawn: { initial: [50, 65], interval: [45, 60] },
    scripted: [{ at: 45, event: 'blackout' }, { at: 165, event: 'blackout' }],
  }),
  defineLevel({
    number: 23, chapter: 5, name: 'Шёпот в тумане',
    brief: 'Туман, помехи в радио и фургон без фар. Работа при этом не отменяется.',
    duration: 265, goal: { served: 12, rep: 3.2 },
    carSpawn: { initialDelay: 0.9, interval: [13, 17] }, queueSize: 2, pumpsOnline: 3,
    customerPatience: 44, orderIntensity: 0.7, orderMenu: ['coffee', 'snack'], weather: 'fog', fuelReserve: 14,
    allowedEvents: ALL_EVENTS, eventSpawn: { initial: [40, 55], interval: [38, 52] },
    scripted: [{ at: 40, event: 'whisper' }, { at: 95, event: 'van' }, { at: 175, event: 'blackout' }],
  }),
  defineLevel({
    number: 24, chapter: 5, name: 'Одна колонка в темноте',
    brief: 'Открыт только первый пост, и свет ненадёжен. Очередь будет длинной.',
    duration: 270, goal: { served: 11, maxLost: 3 },
    carSpawn: { initialDelay: 0.9, interval: [12, 16] }, queueSize: 3, pumpsOnline: 1,
    customerPatience: 52, orderIntensity: 0.6, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 2, snack: 2 },
    allowedEvents: ['spill', 'blackout', 'bag'], eventSpawn: { initial: [55, 70], interval: [45, 62] },
    scripted: [{ at: 70, event: 'blackout' }],
  }),
  defineLevel({
    number: 25, chapter: 5, name: 'Самая длинная ночь', exam: true,
    brief: 'Экзамен пятой главы: ливень, темнота, поломки, две волны и бензовоз посреди всего этого.',
    duration: 300, goal: { served: 15, maxLost: 3 },
    carSpawn: { initialDelay: 0.7, interval: [11, 15] }, queueSize: 3, pumpsOnline: 3,
    customerPatience: 42, orderIntensity: 0.75, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 1, snack: 2 }, fuelReserve: 11, weather: 'rain',
    allowedEvents: ALL_EVENTS, eventSpawn: { initial: [40, 55], interval: [38, 52] },
    scripted: [{ at: 45, event: 'blackout' }, { at: 120, event: 'broken' }, { at: 150, event: 'tanker' }, { at: 230, event: 'spill' }],
    rushes: [
      { at: 80, duration: 36, interval: [6, 8.5], label: 'Первая волна' },
      { at: 200, duration: 40, interval: [5.5, 8], queueBoost: 2, label: 'Волна перед рассветом' },
    ],
  }),

  /* ── Глава 6. Хаос: всё выученное одновременно ── */
  defineLevel({
    number: 26, chapter: 6, name: 'Пересменка на карьере',
    brief: 'Полки пустые, половина клиентов спешит, а наплыв начнётся почти сразу.',
    duration: 275, goal: { served: 14, maxLost: 3 },
    carSpawn: { initialDelay: 0.7, interval: [11, 15] }, queueSize: 2, pumpsOnline: 3,
    customerPatience: 44, hurryChance: 0.45, orderIntensity: 0.8, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 0, snack: 1 },
    allowedEvents: ['spill', 'broken', 'bag'], eventSpawn: { initial: [40, 55], interval: [38, 52] },
    rushes: [{ at: 45, duration: 38, interval: [6, 8], queueBoost: 2, label: 'Смена на карьере' }],
  }),
  defineLevel({
    number: 27, chapter: 6, name: 'Ремонт посреди волны',
    brief: 'Дождь, полная очередь и колонка, которая сломается прямо в наплыв. Чинить или заправлять — решать вам.',
    duration: 280, goal: { served: 14, rep: 3 },
    carSpawn: { initialDelay: 0.7, interval: [11, 15] }, queueSize: 3, pumpsOnline: 3,
    customerPatience: 44, orderIntensity: 0.7, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 2, snack: 2 }, weather: 'rain',
    allowedEvents: ['spill', 'broken', 'blackout'], eventSpawn: { initial: [45, 60], interval: [40, 55] },
    scripted: [{ at: 95, event: 'broken' }],
    rushes: [{ at: 80, duration: 45, interval: [5.5, 8], queueBoost: 2, label: 'Волна с трассы' }],
  }),
  defineLevel({
    number: 28, chapter: 6, name: 'Темно и тесно',
    brief: 'Один пост, туман до самой трассы и два отключения света за ночь.',
    duration: 285, goal: { served: 13, maxLost: 3 },
    carSpawn: { initialDelay: 0.8, interval: [11, 14] }, queueSize: 3, pumpsOnline: 1,
    customerPatience: 50, orderIntensity: 0.65, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 1, snack: 1 }, weather: 'fog',
    allowedEvents: ['spill', 'blackout', 'bag'], eventSpawn: { initial: [50, 65], interval: [42, 58] },
    scripted: [{ at: 55, event: 'blackout' }, { at: 185, event: 'blackout' }],
    rushes: [{ at: 130, duration: 35, interval: [7, 9], label: 'Затор на въезде' }],
  }),
  defineLevel({
    number: 29, chapter: 6, name: 'Ночь всех событий',
    brief: 'Пятно, сумка, фургон, поломка, темнота и бензовоз. По одному разу и всё за смену.',
    duration: 300, goal: { served: 15, maxLost: 3 },
    carSpawn: { initialDelay: 0.7, interval: [10.5, 14] }, queueSize: 2, pumpsOnline: 3,
    customerPatience: 42, hurryChance: 0.3, orderIntensity: 0.8, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 1, snack: 2 }, fuelReserve: 12,
    allowedEvents: ALL_EVENTS, eventSpawn: { initial: [35, 50], interval: [35, 48] },
    scripted: [
      { at: 30, event: 'spill' }, { at: 70, event: 'bag' }, { at: 110, event: 'tanker' },
      { at: 150, event: 'broken' }, { at: 185, event: 'van' }, { at: 235, event: 'blackout' },
    ],
    rushes: [{ at: 140, duration: 40, interval: [6, 8], queueBoost: 2, label: 'Ночной поток' }],
  }),
  defineLevel({
    number: 30, chapter: 6, name: 'Рассвет', exam: true,
    brief: 'Последняя ночь. Ливень, три волны, темнота, пустой склад и два бензовоза. Дотяните до утра.',
    duration: 330, goal: { served: 18, maxLost: 4, rep: 3 },
    carSpawn: { initialDelay: 0.6, interval: [10, 13.5] }, queueSize: 3, pumpsOnline: 3,
    customerPatience: 42, hurryChance: 0.35, orderIntensity: 0.85, orderMenu: ['coffee', 'snack'],
    startStock: { coffee: 0, snack: 0 }, fuelReserve: 12, weather: 'rain',
    allowedEvents: ALL_EVENTS, eventSpawn: { initial: [35, 48], interval: [33, 46] },
    scripted: [
      { at: 40, event: 'broken' }, { at: 85, event: 'tanker' }, { at: 120, event: 'blackout' },
      { at: 190, event: 'spill' }, { at: 215, event: 'tanker' }, { at: 260, event: 'blackout' },
    ],
    rushes: [
      { at: 60, duration: 35, interval: [6, 8], label: 'Первая волна' },
      { at: 150, duration: 40, interval: [5.5, 7.5], queueBoost: 2, label: 'Вторая волна' },
      { at: 255, duration: 45, interval: [5, 7], queueBoost: 2, label: 'Последний рывок' },
    ],
  }),
]);

export const CAMPAIGN_LEVEL_COUNT = CAMPAIGN_LEVELS.length;
export const LEVELS_PER_CHAPTER = Math.round(CAMPAIGN_LEVEL_COUNT / CHAPTERS.length);

export function getLevel(number) {
  const index = Math.max(0, Math.min(CAMPAIGN_LEVEL_COUNT - 1, Math.floor(Number(number) || 1) - 1));
  return CAMPAIGN_LEVELS[index];
}

/* Кампания идёт по порядку: открыт следующий за пройденным уровень.
   Всё, что уже пройдено, можно переиграть в любой момент. */
export function nextLevel(levelsCleared = 0) {
  const cleared = Math.max(0, Math.floor(Number(levelsCleared) || 0));
  return Math.min(CAMPAIGN_LEVEL_COUNT, cleared + 1);
}

export function isLevelUnlocked(number, levelsCleared = 0) {
  return Math.floor(Number(number) || 0) <= nextLevel(levelsCleared);
}

export function chapterLevels(chapterNumber) {
  return CAMPAIGN_LEVELS.filter((level) => level.chapter === chapterNumber);
}

export function getChapter(level) {
  return CHAPTERS.find((chapter) => chapter.number === level?.chapter) ?? CHAPTERS[0];
}

export function weatherOf(level) {
  return WEATHER[level?.weather] ?? WEATHER.clear;
}

/* Чем эта ночь отличается от соседних — короткими метками для меню уровней.
   Порядок важен: в плитку помещаются только первые четыре, и редкое идёт вперёд. */
export function featureTags(level) {
  if (!level) return [];
  const tags = [];
  if (level.pumpsOnline >= 3) tags.push('3 поста');
  else if (level.pumpsOnline === 1) tags.push('один пост');
  if (level.weather !== 'clear') tags.push(weatherOf(level).tag);
  if (level.hurryChance > 0) tags.push('спешат');
  if (level.fuelReserve !== null) tags.push('бензовоз');
  if (level.allowedEvents.includes('blackout')) tags.push('темнота');
  else if (level.allowedEvents.includes('broken')) tags.push('поломки');
  if (level.rushes.length > 1) tags.push(`${level.rushes.length} волны`);
  else if (level.rushes.length === 1) tags.push('наплыв');
  if (level.queueSize > 1) tags.push('очередь');
  if (level.startStock.coffee + level.startStock.snack < 8) tags.push('склад');
  if (level.orderIntensity >= 0.8) tags.push('поток заказов');
  else if (level.orderMenu.includes('snack')) tags.push('кофе и еда');
  else if (level.orderMenu.includes('coffee')) tags.push('кофе');
  if (!tags.length) tags.push('основы');
  return tags.slice(0, 4);
}

/* ─────── Цели: одно описание для брифинга, HUD и экрана итогов ─────── */

export function goalLines(goal) {
  return GOAL_ORDER.filter((key) => goal?.[key] !== undefined)
    .map((key) => GOAL_RULES[key].describe(goal[key]));
}

export function goalProgress(goal, stats) {
  return GOAL_ORDER.filter((key) => goal?.[key] !== undefined).map((key) => {
    const rule = GOAL_RULES[key], target = goal[key], value = rule.value(stats);
    return {
      key,
      label: rule.label,
      done: rule.ok(stats, target),
      text: rule.format
        ? `${rule.format(value)} / ${rule.format(target)}`
        : `${value} / ${target}`,
    };
  });
}

/* Провал должен читаться одной строкой: что именно не сошлось и на сколько. */
export function evaluateGoal(goal, stats) {
  const failures = GOAL_ORDER
    .filter((key) => goal?.[key] !== undefined && !GOAL_RULES[key].ok(stats, goal[key]))
    .map((key) => GOAL_RULES[key].fail(stats, goal[key]));
  return { passed: failures.length === 0, failures };
}

/* Провал по числу упущенных клиентов виден сразу: тянуть смену дальше незачем. */
export function hardFailure(goal, stats) {
  if (goal?.maxLost === undefined || stats.lost <= goal.maxLost) return null;
  return GOAL_RULES.maxLost.fail(stats, goal.maxLost);
}

export function activeRush(config, elapsed) {
  return config?.rushes?.find((rush) => elapsed >= rush.at && elapsed < rush.at + rush.duration) ?? null;
}

export function dueScripted(config, elapsed, fired) {
  return config?.scripted?.filter((entry) => entry.at <= elapsed && !fired.has(entry.id)) ?? [];
}
