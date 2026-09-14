/* Витрина магазина как данные: где готовят, из какого запаса берут, сколько
   стоит и сколько занимает времени. Уровень выбирает, что сегодня продаётся,
   а игра не знает про конкретные товары ничего, кроме этой таблицы. */

export const MAX_STOCK = 5;

const define = ({ id, name, accusative, station, stock, prep, price, carry, track }) => Object.freeze({
  id, name, accusative, station, stock, prep, price, carry, track,
});

export const MENU = Object.freeze({
  coffee: define({
    id: 'coffee', name: 'кофе', accusative: 'кофе', station: 'coffee', stock: 'coffee',
    prep: 1.5, price: 55, carry: 'coffee', track: 'coffee',
  }),
  snack: define({
    id: 'snack', name: 'сэндвич', accusative: 'сэндвич', station: 'food', stock: 'snack',
    prep: 1.05, price: 48, carry: 'snack', track: 'snacks',
  }),
  // Хот-дог дольше всех: гриль стоит у левой стены, и за ним надо идти.
  hotdog: define({
    id: 'hotdog', name: 'хот-дог', accusative: 'хот-дог', station: 'grill', stock: 'hotdog',
    prep: 2.4, price: 74, carry: 'hotdog', track: 'hotdogs',
  }),
  // Газировка быстрая и дорогая, но её запас кончается первым.
  soda: define({
    id: 'soda', name: 'газировка', accusative: 'газировку', station: 'fridge', stock: 'soda',
    prep: 0.8, price: 62, carry: 'soda', track: 'sodas',
  }),
});

export const MENU_IDS = Object.freeze(Object.keys(MENU));

/* Запасы магазина. Всё, чем торгует прилавок, лежит на складе второго этажа:
   четыре стеллажа, по одному на каждую витрину. */
export const STOCKS = Object.freeze({
  coffee: Object.freeze({
    id: 'coffee', label: 'кофе', chip: 'КОФЕ', gone: 'Кофе закончился', full: 'Кофемашина и так полная',
    source: 'upstairs', carry: 'coffeeBox', target: 'Пополните кофемашину', where: 'Склад на 2 этаже · лестница снаружи справа',
  }),
  snack: Object.freeze({
    id: 'snack', label: 'сэндвичей', chip: 'СЭНДВИЧИ', gone: 'Еда закончилась', full: 'Витрина и так полная',
    source: 'upstairs', carry: 'snackBox', target: 'Пополните витрину сэндвичей', where: 'Склад на 2 этаже · лестница снаружи справа',
  }),
  hotdog: Object.freeze({
    id: 'hotdog', label: 'хот-догов', chip: 'ХОТ-ДОГИ', gone: 'Хот-доги закончились', full: 'Гриль и так полный',
    source: 'upstairs', carry: 'hotdogBox', target: 'Пополните гриль', where: 'Склад на 2 этаже · лестница снаружи справа',
  }),
  soda: Object.freeze({
    id: 'soda', label: 'газировки', chip: 'ГАЗИРОВКА', gone: 'Газировка закончилась', full: 'Холодильник и так полный',
    source: 'upstairs', carry: 'sodaBox', target: 'Пополните холодильник', where: 'Склад на 2 этаже · лестница снаружи справа',
  }),
});

export const STOCK_IDS = Object.freeze(Object.keys(STOCKS));

export function getMenuItem(id) {
  return MENU[id] ?? null;
}

export function menuStocks(orderMenu = []) {
  return [...new Set(orderMenu.map((id) => MENU[id]?.stock).filter(Boolean))];
}

/* Сколько порций видно на витрине: полки должны пустеть на глазах. */
export function shelfCount(total, stock) {
  return Math.max(0, Math.min(total, Math.ceil(total * (stock / MAX_STOCK))));
}
