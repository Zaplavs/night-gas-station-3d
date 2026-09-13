/* Проверка кампании как данных: 30 уровней, честные цели, постепенное открытие
   механик и миграция старых сохранений. Браузер для этого не нужен. */
import {
  CAMPAIGN_LEVELS, CAMPAIGN_LEVEL_COUNT, CHAPTERS, LEVELS_PER_CHAPTER,
  getLevel, getChapter, goalLines, goalProgress, evaluateGoal, hardFailure,
  activeRush, dueScripted, nextLevel, isLevelUnlocked, chapterLevels,
} from '../src/content/levels.js';
import { EVENT_TYPES, PLAY_MODE, createEndlessShift, getShiftConfig, isFinalCampaignShift } from '../src/content/shifts.js';
import { migrateProgress, DEFAULT_PROGRESS, SAVE_VERSION, LEGACY_CAMPAIGN_LENGTH } from '../src/content/progress.js';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

/* ─── Структура кампании ─── */
check(CAMPAIGN_LEVEL_COUNT === 30, `Уровней должно быть 30, а не ${CAMPAIGN_LEVEL_COUNT}`);
check(CHAPTERS.length === 6, `Глав должно быть 6, а не ${CHAPTERS.length}`);
check(LEVELS_PER_CHAPTER === 5, `В главе должно быть 5 уровней, а не ${LEVELS_PER_CHAPTER}`);

const EXAMS = [5, 10, 15, 20, 25, 30];
const seenSignatures = [];

CAMPAIGN_LEVELS.forEach((level, index) => {
  const at = `Уровень ${level.number}`;
  check(level.number === index + 1, `${at}: номера уровней должны идти подряд`);
  check(level.chapter === Math.floor(index / LEVELS_PER_CHAPTER) + 1, `${at}: глава не совпадает с позицией`);
  check(typeof level.name === 'string' && level.name.length > 2, `${at}: нужно название`);
  check(typeof level.brief === 'string' && level.brief.length > 10, `${at}: нужен брифинг`);
  check(level.duration >= 150 && level.duration <= 400, `${at}: странная длительность ${level.duration}`);
  check(level.customerPatience > 20, `${at}: клиенты не могут ждать ${level.customerPatience}с`);
  check(level.queueSize >= 1 && level.queueSize <= 3, `${at}: очередь ${level.queueSize} вне диапазона`);
  check(level.pumpsOnline === 1 || level.pumpsOnline === 2, `${at}: колонок в работе ${level.pumpsOnline}`);
  check(getChapter(level).number === level.chapter, `${at}: глава не находится по уровню`);
  check(getLevel(level.number) === level, `${at}: getLevel возвращает другой уровень`);

  // Цель обязана быть и обязана описываться словами.
  const goalKeys = Object.keys(level.goal);
  check(goalKeys.length > 0, `${at}: у уровня нет цели`);
  check(goalLines(level.goal).length === goalKeys.length, `${at}: цель не описана текстом`);

  // Цель должна быть достижима: машин за ночь приезжает не меньше, чем нужно обслужить.
  if (level.goal.served !== undefined) {
    const rushCars = level.rushes.reduce((total, rush) => total + rush.duration / rush.interval[0], 0);
    const baseTime = level.duration - level.rushes.reduce((total, rush) => total + rush.duration, 0);
    const maxCars = Math.floor(baseTime / level.carSpawn.interval[0] + rushCars);
    check(level.goal.served <= maxCars * 0.8,
      `${at}: цель ${level.goal.served} машин против ${maxCars} приезжающих — недостижимо`);
    check(level.goal.served >= 3, `${at}: цель ${level.goal.served} слишком мелкая`);
  }

  // События: только известные типы, и гарантированное событие должно быть разрешено на уровне.
  level.allowedEvents.forEach((type) => check(EVENT_TYPES.includes(type), `${at}: неизвестное событие ${type}`));
  level.scripted.forEach((entry) => {
    check(EVENT_TYPES.includes(entry.event), `${at}: неизвестное сценарное событие ${entry.event}`);
    check(level.allowedEvents.includes(entry.event), `${at}: сценарное ${entry.event} не входит в allowedEvents`);
    check(entry.at > 10 && entry.at < level.duration - 25,
      `${at}: событие ${entry.event} на ${entry.at}с не помещается в смену`);
  });

  // Наплывы обязаны заканчиваться до рассвета и быть плотнее обычного потока.
  level.rushes.forEach((rush) => {
    check(rush.at + rush.duration <= level.duration, `${at}: наплыв «${rush.label}» выходит за смену`);
    check(rush.interval[0] < level.carSpawn.interval[0], `${at}: наплыв «${rush.label}» не плотнее обычного потока`);
    check(typeof rush.label === 'string' && rush.label.length > 3, `${at}: у наплыва нет названия`);
  });

  check(level.exam === EXAMS.includes(level.number), `${at}: экзаменом должен быть каждый пятый уровень`);

  // Каждый уровень должен отличаться от предыдущего не только числами в одном поле.
  const signature = [
    level.queueSize, level.pumpsOnline, level.orderIntensity, level.customerPatience,
    level.orderMenu.join('+'), level.startStock.coffee, level.startStock.snack,
    level.allowedEvents.join('+'), level.scripted.length, level.rushes.length,
  ].join('|');
  check(signature !== seenSignatures[index - 1], `${at}: повторяет предыдущий уровень один в один`);
  seenSignatures.push(signature);
});

/* ─── Механики открываются постепенно ─── */
const firstWith = (predicate) => CAMPAIGN_LEVELS.find(predicate)?.number ?? Infinity;
check(CAMPAIGN_LEVELS[0].orderIntensity === 0, 'Первый уровень должен учить только заправке');
check(CAMPAIGN_LEVELS[0].allowedEvents.length === 0, 'На первом уровне не должно быть случайных событий');
check(firstWith((l) => l.orderMenu.includes('coffee')) === 3, 'Кофе должен открываться на 3 уровне');
check(firstWith((l) => l.orderMenu.includes('snack')) === 6, 'Еда должна открываться на 6 уровне');
check(firstWith((l) => l.startStock.coffee < 5 || l.startStock.snack < 5) === 7, 'Склад должен становиться нужен с 7 уровня');
check(firstWith((l) => l.allowedEvents.includes('spill')) === 4, 'Уборка должна открываться на 4 уровне');
check(firstWith((l) => l.allowedEvents.includes('bag')) === 9, 'Находки должны открываться на 9 уровне');
check(firstWith((l) => l.queueSize > 1) === 11, 'Очередь из двух машин — с 11 уровня');
check(firstWith((l) => l.allowedEvents.includes('broken')) === 16, 'Поломки — с 16 уровня');
check(firstWith((l) => l.pumpsOnline === 1) === 17, 'Закрытая колонка — с 17 уровня');
check(firstWith((l) => l.allowedEvents.includes('van')) === 19, 'Странный фургон — с 19 уровня');
check(firstWith((l) => l.allowedEvents.includes('blackout')) === 21, 'Отключение света — с 21 уровня');
check(firstWith((l) => l.rushes.length > 0) === 5, 'Первый наплыв — на экзамене 5 уровня');
check(firstWith((l) => l.rushes.length > 1) === 15, 'Две волны за смену — с 15 уровня');

/* Экзамен должен быть заметно тяжелее предыдущей четвёрки уровней. */
EXAMS.forEach((number) => {
  const exam = getLevel(number);
  const before = CAMPAIGN_LEVELS.slice(number - 5, number - 1);
  const hardestGoal = Math.max(...before.map((level) => level.goal.served ?? 0));
  check((exam.goal.served ?? 0) > hardestGoal, `Экзамен ${number}: цель не выше, чем на обычных уровнях главы`);
  check(exam.rushes.length > 0 || exam.scripted.length >= 2, `Экзамен ${number}: ничего особенного не происходит`);
});

/* Финал должен собирать механики вместе. */
const final = getLevel(30);
check(final.rushes.length >= 3, 'Финал: нужно несколько волн');
check(final.scripted.length >= 3, 'Финал: нужны гарантированные события');
check(final.allowedEvents.length === EVENT_TYPES.length, 'Финал: должны быть доступны все события');
check(final.startStock.coffee === 0 && final.startStock.snack === 0, 'Финал: склад должен быть пуст');
check(isFinalCampaignShift(final), 'Финал должен определяться как последний уровень кампании');

/* ─── Цели: прогресс и разбор провала ─── */
const stats = { served: 4, lost: 3, rep: 2.6, earned: 300 };
const goal = { served: 8, earn: 500, rep: 3, maxLost: 2 };
const progress = goalProgress(goal, stats);
check(progress.length === 4, 'В прогрессе должны быть все четыре цели');
check(progress.every((part) => part.done === false), 'Недовыполненные цели не должны отмечаться зачётом');
check(progress[0].text === '4 / 8', `Прогресс цели читается неверно: ${progress[0].text}`);
const verdict = evaluateGoal(goal, stats);
check(!verdict.passed, 'Невыполненная цель должна быть провалом');
check(verdict.failures.length === 4, 'Каждая невыполненная цель должна объясняться отдельно');
check(verdict.failures[0].includes('4') && verdict.failures[0].includes('8'), 'Провал должен называть числа');
check(evaluateGoal(goal, { served: 8, lost: 2, rep: 3, earned: 500 }).passed, 'Ровно выполненная цель должна засчитываться');
check(evaluateGoal({}, stats).passed, 'Без цели уровень провалить нельзя');
check(hardFailure(goal, stats) !== null, 'Перебор по упущенным клиентам должен закрывать смену сразу');
check(hardFailure(goal, { ...stats, lost: 2 }) === null, 'Пока лимит не превышен, смена продолжается');
check(hardFailure({ served: 5 }, stats) === null, 'Без лимита на потери досрочного провала быть не может');

/* ─── Расписание ─── */
const scheduled = getLevel(29);
const fired = new Set();
const due = dueScripted(scheduled, scheduled.scripted[0].at + 1, fired);
check(due.length >= 1, 'Событие по расписанию должно срабатывать после своей отметки');
fired.add(due[0].id);
check(!dueScripted(scheduled, scheduled.scripted[0].at + 1, fired).includes(due[0]), 'Сработавшее событие не повторяется');
check(dueScripted(scheduled, 0, new Set()).length === 0, 'В начале смены расписание пустое');
const rushLevel = getLevel(30), rush = rushLevel.rushes[0];
check(activeRush(rushLevel, rush.at + 1) === rush, 'Наплыв должен включаться в своё время');
check(activeRush(rushLevel, rush.at - 1) === null, 'До своего времени наплыв не активен');
check(activeRush(rushLevel, rush.at + rush.duration + 1) !== rush, 'Наплыв должен заканчиваться');
check(activeRush(getLevel(1), 100) === null, 'На первом уровне наплывов нет');

/* ─── Доступ к уровням для меню выбора ─── */
check(nextLevel(0) === 1, 'Без прогресса открыт только первый уровень');
check(nextLevel(7) === 8, 'После семи пройденных ночей открыта восьмая');
check(nextLevel(CAMPAIGN_LEVEL_COUNT) === CAMPAIGN_LEVEL_COUNT, 'За тридцатый уровень кампания не уходит');
check(isLevelUnlocked(1, 0) && !isLevelUnlocked(2, 0), 'В начале доступен ровно один уровень');
check(isLevelUnlocked(4, 9) && isLevelUnlocked(10, 9) && !isLevelUnlocked(11, 9),
  'Пройденное переигрывается, следующее открыто, дальше закрыто');
check(CHAPTERS.every((chapter) => chapterLevels(chapter.number).length === LEVELS_PER_CHAPTER),
  'В каждой главе должно быть по пять уровней');
check(chapterLevels(3).every((level) => level.chapter === 3), 'Глава не должна подбирать чужие уровни');
check(CHAPTERS.flatMap((chapter) => chapterLevels(chapter.number)).length === CAMPAIGN_LEVEL_COUNT,
  'Главы вместе должны покрывать всю кампанию');

/* ─── Бесконечный режим после кампании ─── */
const endless = createEndlessShift(4);
check(endless.mode === PLAY_MODE.ENDLESS, 'Бесконечный режим должен помечаться своим режимом');
check(Object.keys(endless.goal).length === 0, 'В бесконечном режиме целей нет');
check(evaluateGoal(endless.goal, { served: 0, lost: 99, rep: 1, earned: 0 }).passed, 'Бесконечный режим нельзя провалить');
['duration', 'carSpawn', 'queueSize', 'customerPatience', 'orderIntensity', 'orderMenu', 'startStock', 'pumpsOnline', 'allowedEvents', 'eventSpawn', 'scripted', 'rushes', 'name', 'brief']
  .forEach((key) => check(endless[key] !== undefined, `Бесконечный режим: не хватает поля ${key}`));
check(createEndlessShift(9).carSpawn.interval[0] < createEndlessShift(1).carSpawn.interval[0], 'Бесконечный режим должен уплотняться');
check(getShiftConfig(3, PLAY_MODE.ENDLESS).mode === PLAY_MODE.ENDLESS, 'getShiftConfig должен отдавать бесконечный режим');
check(getShiftConfig(31).number === 30, 'Запрос уровня за пределами кампании должен упираться в последний');

/* ─── Сохранения ─── */
const fresh = migrateProgress(null);
check(fresh.saveVersion === SAVE_VERSION, 'Новое сохранение должно быть текущей версии');
check(fresh.shift === 1 && fresh.levelsCleared === 0, 'Новая игра начинается с первого уровня');

const legacyDone = migrateProgress({ saveVersion: 2, shift: 7, campaignComplete: true, money: 900, upgrades: { speed: 2 }, rep: 4.1 });
check(!legacyDone.campaignComplete, 'Старая семисменная кампания больше не считается пройденной');
check(legacyDone.shift === LEGACY_CAMPAIGN_LENGTH + 1, `Старый сейв должен продолжиться с 8 уровня, а не с ${legacyDone.shift}`);
check(legacyDone.levelsCleared === LEGACY_CAMPAIGN_LENGTH, 'Пройденные смены должны зачесться как уровни');
check(legacyDone.money === 900 && legacyDone.upgrades.speed === 2, 'Деньги и улучшения должны переехать');
check(Math.abs(legacyDone.rep - 4.1) < 1e-9, 'Репутация должна сохраниться');

const legacyMid = migrateProgress({ saveVersion: 2, shift: 4, money: 120 });
check(legacyMid.shift === 4 && legacyMid.levelsCleared === 3, 'Незаконченная старая кампания продолжается с того же места');

const ancient = migrateProgress({ shift: 12, money: 50 });
check(ancient.saveVersion === SAVE_VERSION && ancient.shift === LEGACY_CAMPAIGN_LENGTH + 1,
  'Сейв без версии считается старым и продолжается после семи смен');

const modern = migrateProgress({ saveVersion: SAVE_VERSION, shift: 18, levelsCleared: 17, money: 400 });
check(modern.shift === 18 && modern.levelsCleared === 17, 'Актуальный сейв не должен трогаться');
check(migrateProgress({ saveVersion: SAVE_VERSION, shift: 99 }).shift === CAMPAIGN_LEVEL_COUNT, 'Номер уровня должен упираться в 30');
check(migrateProgress({ saveVersion: SAVE_VERSION, shift: 30, campaignComplete: true }).campaignComplete, 'Пройденная кампания из 30 уровней должна помниться');
check(migrateProgress({ playMode: PLAY_MODE.ENDLESS, shift: 12 }).shift === 12, 'Бесконечный режим не ограничен 30 уровнями');
check(migrateProgress({ saveVersion: 2, musicVolume: 45, sound: false }).musicVolume === 45, 'Настройки звука должны переживать миграцию');
check(migrateProgress(DEFAULT_PROGRESS).shift === 1, 'Значения по умолчанию должны проходить миграцию без изменений');

if (failures.length) {
  console.error(`Проверка кампании не прошла (${failures.length}):`);
  failures.forEach((message) => console.error(` • ${message}`));
  process.exit(1);
}
console.log(`Campaign test passed: ${CAMPAIGN_LEVEL_COUNT} levels in ${CHAPTERS.length} chapters, goals, schedule and save migration are consistent.`);
