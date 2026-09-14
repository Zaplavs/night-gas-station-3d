/* Кто именно приехал — отдельная механика, а не перекраска кузова.
   У каждого типа свои габариты, своё время у колонки, свои деньги, своё терпение
   и свой разговор с магазином. Крупным нужен третий пост: под навес они не встают,
   а разворачиваться между двумя занятыми колонками им негде. */

const define = (spec) => Object.freeze({
  orders: 1,
  big: false,
  hatch: 0,
  park: 0,
  patience: 1,
  payout: 1,
  ...spec,
  paint: Object.freeze([...spec.paint]),
  lights: Object.freeze({ ...spec.lights }),
});

export const VEHICLES = Object.freeze({
  car: define({
    id: 'car', asset: 'car', name: 'легковая', accusative: 'машину', tag: 'легковые', stat: null,
    halfWidth: 1.18, halfLength: 2.2,
    fuelTime: 2.7, payout: 1, patience: 1, orders: 1,
    paint: [0xb52f28, 0x2e6380, 0xd0a343, 0x4f555b, 0x315d3f, 0x8d8f92, 0x2a2f35],
    lights: {}, engine: [105, 0.35],
    note: '',
  }),
  bike: define({
    id: 'bike', asset: 'bike', name: 'мотоцикл', accusative: 'мотоцикл', tag: 'мотоциклы', stat: 'bikes',
    halfWidth: 0.42, halfLength: 1.05,
    // Полторы минуты на всё: бак крошечный, денег мало, ждать он не станет.
    fuelTime: 1.1, payout: 0.5, patience: 0.7, orders: 0,
    paint: [0x1d2226, 0xb52f28, 0x2e6380, 0xe0e2e4],
    lights: { front: -0.95, back: 0.95, width: 0.16, y: 0.62 }, engine: [168, 0.28],
    note: 'Мотоцикл: бак маленький и денег мало, зато уедет быстро — если успеете.',
  }),
  truck: define({
    id: 'truck', asset: 'truck', name: 'фура', accusative: 'фуру', tag: 'фуры', stat: 'trucks',
    // Длинному носу нужен свой метр: иначе кабина въезжает в столбики у горловины.
    halfWidth: 1.3, halfLength: 4.0, hatch: 1.2, park: -0.7, big: true,
    // Долго стоит и занимает весь левый пост, но платит за всех сразу.
    fuelTime: 5.4, payout: 2.2, patience: 1.45, orders: 1,
    paint: [0xb52f28, 0x2e6380, 0xe6e3d8, 0x3f7d5a],
    lights: { front: -3.95, back: 3.95, width: 0.95, y: 0.86 }, engine: [72, 0.5],
    note: 'Фура идёт на третий пост: заправка долгая, но платит вдвое.',
  }),
  bus: define({
    id: 'bus', asset: 'bus', name: 'автобус', accusative: 'автобус', tag: 'автобусы', stat: 'buses',
    halfWidth: 1.25, halfLength: 3.45, hatch: -1.4, park: -0.7, big: true,
    // Пока идёт заправка, у прилавка стоит целый салон.
    fuelTime: 3.6, payout: 1.5, patience: 1.3, orders: 3,
    paint: [0xd8a52c, 0xd4d7d2, 0x2e6380, 0xb8562c],
    lights: { front: -3.4, back: 3.4, width: 1.05, y: 0.95 }, engine: [88, 0.45],
    note: 'Автобус: пока стоит под заправкой, из него выйдет целый салон.',
  }),
});

export const VEHICLE_IDS = Object.freeze(Object.keys(VEHICLES));
export const DEFAULT_FLEET = Object.freeze({ car: 1 });
/* Модели, которые грузит игра: у типа может быть свой файл, у легковой — общий. */
export const VEHICLE_ASSETS = Object.freeze([...new Set(VEHICLE_IDS.map((id) => VEHICLES[id].asset))]);

export function getVehicle(id) {
  return VEHICLES[id] ?? VEHICLES.car;
}

/* Состав потока уровня: {car: 1, truck: .35} — это веса, а не проценты. */
export function normalizeFleet(fleet) {
  const entries = Object.entries(fleet ?? {}).filter(([id, weight]) => VEHICLES[id] && weight > 0);
  if (!entries.length) return Object.freeze({ ...DEFAULT_FLEET });
  return Object.freeze(Object.fromEntries(entries.map(([id, weight]) => [id, weight])));
}

export function fleetIds(fleet) {
  return Object.keys(normalizeFleet(fleet));
}

/* Кто приедет следующим. Крупных отсекают снаружи: пока один такой стоит
   в очереди, второго звать некуда — третий пост всего один. */
export function rollVehicle(fleet, { allowBig = true, random = Math.random } = {}) {
  const entries = Object.entries(normalizeFleet(fleet)).filter(([id]) => allowBig || !VEHICLES[id].big);
  if (!entries.length) return 'car';
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

/* Длина линии в очереди считается по тем, кто в ней стоит: фура сдвигает всех,
   кто приехал после неё, а мотоцикл почти не занимает места. */
export function queueOffsets(halfLengths, gap) {
  const centers = [];
  let cursor = 0;
  halfLengths.forEach((halfLength, index) => {
    cursor = index === 0 ? 0 : cursor + halfLengths[index - 1] + gap + halfLength;
    centers.push(cursor);
  });
  return centers;
}
