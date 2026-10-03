import type { Difficulty } from "../../core/difficulty";

export interface Strings {
  siteName: string;
  play: string;
  continue: string;
  levelWithDifficulty: (n: number, difficulty: string) => string;
  startOver: string;
  comingSoon: string;
  support: string;
  supportShort: string;
  shareFeedback: string;

  hubHeadline: string;
  hubIntro: string;
  hubNote: string;
  playGame: (title: string) => string;
  homeTitle: string;
  homeDescription: string;

  menu: string;
  paused: string;
  resume: string;
  restartLevel: string;
  backToGames: string;

  level: (n: number) => string;
  start: string;
  nextLevel: string;
  tryAgain: string;
  ok: string;
  pressEnter: string;
  solved: (ok: number, total: number) => string;

  difficulty: Record<Difficulty, string>;
  difficultyLine: (name: string) => string;
  selectDifficulty: string;
  back: string;
  customSetupTitle: string;
  customOperations: string;
  customMultiplication: string;
  customDivision: string;
  customTables: string;
  customNeedSelection: string;
  customLoadMore: string;

  chrome: {
    about: string;
    feedback: string;
    language: string;
    termsPrivacy: string;
    menuAria: string;
    notFoundTitle: string;
    notFoundHeading: string;
    notFoundBody: string;
    notFoundCta: string;
    walletCopied: string;
    walletFailed: string;
  };

  stl: {
    title: string;
    description: string;
    introGoal: string;
    controls: string;
    levelComplete: string;
    candleOut: string;
    candleOutHint: string;
    exitHint: string;
    exitLocked: string;
    exitLockedHint: string;
    mapFound: string;
    mapFoundHint: string;
    mapDecryptedArrow: string;
    mapDecryptedReveal: string;
    mapDecryptedToast: string;
    coachSolveHint: string;
    coachSolveButton: string;
    coachMeterHint: string;
    difficultyHints: Record<Difficulty, string>;
  };
}
