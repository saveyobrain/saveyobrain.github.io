import { SITE_NAME } from "../../config";
import type { Difficulty } from "../../core/difficulty";
import type { Strings } from "./types";

export const ua: Strings = {
  siteName: SITE_NAME,
  play: "Грати",
  continue: "Продовжити",
  levelWithDifficulty: (n, difficulty) => `Рівень ${n} \u00b7 ${difficulty}`,
  startOver: "Почати з 1 рівня",
  comingSoon: "Незабаром з'являться нові ігри",
  support: "Підтримати проєкт",
  supportShort: "Підтримати",
  shareFeedback: "Залишити відгук",

  hubHeadline: "Безкоштовні ігри, щоб тримати мозок у формі.",
  hubIntro:
    "Математика — базова навичка, як читання чи письмо. Грайте трохи щодня, щоб розвивати її й не втрачати.",
  hubNote: "Можна грати одразу, без акаунта. Прогрес зберігається у вашому браузері.",
  playGame: (title) => `Грати в «${title}»`,
  homeTitle: `${SITE_NAME} — Безкоштовні математичні ігри в браузері`,
  homeDescription:
    "Безкоштовні браузерні ігри, що допомагають дітям і дорослим розвивати та підтримувати базові математичні навички.",

  menu: "Меню",
  paused: "Гру призупинено",
  resume: "Продовжити",
  restartLevel: "Почати рівень знову",
  backToGames: "На головну",

  level: (n) => `Рівень ${n}`,
  start: "Старт",
  nextLevel: "Наступний рівень",
  tryAgain: "Спробувати ще",
  ok: "Гаразд",
  pressEnter: "(натисніть Enter)",
  solved: (ok, total) => `Розв'язано задач: ${ok} з ${total}`,

  difficulty: {
    easy: "Легкий",
    normal: "Звичайний",
    hard: "Складний",
    hardcore: "Хардкор",
  } satisfies Record<Difficulty, string>,
  difficultyLine: (name) => `Складність: ${name}`,
  selectDifficulty: "Обрати складність",
  back: "Назад",

  chrome: {
    about: "Про проєкт",
    feedback: "Відгуки",
    language: "Мова",
    termsPrivacy: "Умови та конфіденційність",
    menuAria: "Меню",
    notFoundTitle: `Сторінку не знайдено - ${SITE_NAME}`,
    notFoundHeading: "Сторінку не знайдено",
    notFoundBody: "Такої сторінки немає. Поверніться на головну й оберіть гру.",
    notFoundCta: "На головну",
    walletCopied: "Скопійовано",
    walletFailed: "Помилка",
  },

  stl: {
    title: "Врятуй світло",
    description: "Знайдіть вихід із лабіринту. Розв'язуйте математичні задачі, щоб свічка не згасла!",
    introGoal: "Знайдіть вихід. Розв'язуйте задачі, щоб свічка горіла!",
    controls:
      "Рух: стрілки, WASD або торкніться/клацніть у зоні світла. Відповідь: клавіші 1–4 або торкніться. Меню: Esc.",
    levelComplete: "Ви знайшли вихід!",
    candleOut: "Свічка згасла...",
    candleOutHint: "Під час руху свічка згорає швидше — зупиніться, щоб розв'язати задачу, або відповідайте на ходу.",
    exitHint: "Шукайте двері з лабіринту.",
    exitLocked: "Двері замкнені.",
    exitLockedHint: "Розв'яжіть хоча б одну задачу, щоб відчинити двері.",
    mapFound: "Ви знайшли мапу!",
    mapFoundHint: "Розв'яжіть ще одну задачу, щоб її розшифрувати.",
    mapDecryptedArrow: "Мапу розшифровано — йдіть пунктирною стежкою до виходу.",
    mapDecryptedReveal: "Мапу розшифровано — лабіринт видно!",
    difficultyHints: {
      easy: "Невеликі лабіринти, проста математика. Під час руху свічка згорає швидше.",
      normal: "Більші лабіринти, математика ускладнюється швидше. Поспіх без відповідей погасить полум'я.",
      hard: "Великі лабіринти, складніші задачі з самого початку. Відповідайте, інакше свічка згасне.",
      hardcore: "Вечезні лабіринти, крихітне мерехтливе світло, важка математика. Кожен крок щось коштує. Удачі!",
    } satisfies Record<Difficulty, string>,
  },
};
