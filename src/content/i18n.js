import { EN } from './en.js';

/* Язык смены. Русский — родной: на нём написаны все строки в коде и данных.
   Площадки требуют, чтобы любой неизвестный язык считался английским, поэтому
   выбор тут всегда двоичный. */
export const LANGS = ['ru', 'en'];
const DICTS = { ru: null, en: EN };
let lang = 'ru';

export function setLanguage(code) {
  const short = String(code || '').trim().toLowerCase().slice(0, 2);
  lang = short === 'ru' ? 'ru' : 'en';
  return lang;
}
export function language() { return lang; }

/* Ключ перевода — сам русский текст. Строка остаётся на своём месте в коде,
   а пропущенный перевод показывает русский вместо пустоты. Подстановки идут
   через {имя}: собранную строку в словаре не найти. */
export function t(text, vars) {
  const dict = DICTS[lang];
  let out = dict && dict[text] !== undefined ? dict[text] : text;
  if (vars) for (const [name, value] of Object.entries(vars)) out = out.split(`{${name}}`).join(value);
  return out;
}

/* Разметка переводится тем же словарём: у текстовых узлов и подписей ключ —
   их русский текст. Оригинал запоминается, иначе назад на русский не вернуться. */
const ATTRS = ['aria-label', 'placeholder', 'title'];
const originals = new WeakMap();

function original(node, key, value) {
  let stored = originals.get(node);
  if (!stored) originals.set(node, (stored = {}));
  if (stored[key] === undefined) stored[key] = value;
  return stored[key];
}

export function translateDom(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  for (const node of nodes) {
    const source = original(node, 'text', node.nodeValue), key = source.trim();
    if (!key) continue;
    node.nodeValue = source.replace(key, t(key));
  }
  for (const element of root.querySelectorAll(`[${ATTRS.join('],[')}]`)) {
    for (const attr of ATTRS) {
      const value = element.getAttribute(attr);
      if (value === null) continue;
      element.setAttribute(attr, t(original(element, attr, value).trim()));
    }
  }
}

/* Чем полнее словарь, тем меньше смешанного языка на экране: тест сверяет
   каждую строку исходников с этим списком. */
export function translationKeys() { return Object.keys(EN); }
