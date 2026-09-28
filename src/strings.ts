import { SITE_NAME } from "./config";
import type { Difficulty } from "./core/difficulty";

export const strings = {
  siteName: SITE_NAME,
  play: "Play now",
  continue: "Continue",
  levelWithDifficulty: (n: number, difficulty: string) => `Level ${n} \u00b7 ${difficulty}`,
  startOver: "Start from level 1",
  comingSoon: "More games coming soon",
  support: "Support the project",
  supportShort: "Support",
  shareFeedback: "Share your feedback",

  menu: "Menu",
  paused: "Game paused",
  resume: "Resume",
  restartLevel: "Restart level",
  backToGames: "Back to home",

  level: (n: number) => `Level ${n}`,
  start: "Start",
  nextLevel: "Next level",
  tryAgain: "Try again",
  ok: "OK",
  pressEnter: "(press Enter)",
  solved: (ok: number, total: number) => `Tasks solved: ${ok} of ${total}`,

  difficulty: {
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    hardcore: "Hardcore",
  } satisfies Record<Difficulty, string>,
  difficultyLine: (name: string) => `Difficulty: ${name}`,
  selectDifficulty: "Select difficulty",
  back: "Back",

  stl: {
    title: "Save the Light",
    description:
      "Find the exit of a maze. Solve math tasks to keep your candle burning!",
    introGoal: "Find the exit. Solve tasks to keep your candle burning!",
    controls:
      "Move: arrow keys, WASD, or tap/click inside the light. Answer: keys 1-4 or tap. Menu: Esc.",
    levelComplete: "You found the exit!",
    candleOut: "Your candle went out...",
    candleOutHint: "Moving burns the candle faster — pause to solve, or answer as you go.",
    exitHint: "Look for the door out of the maze.",
    exitLocked: "The door is locked.",
    exitLockedHint: "Solve at least one math task to open the door.",
    mapFound: "You found a map!",
    mapFoundHint: "Solve one more task to decrypt it.",
    mapDecryptedArrow: "Map decrypted — follow the dashed path to the exit.",
    mapDecryptedReveal: "Map decrypted — the maze is revealed!",
    difficultyHints: {
      easy: "Small mazes, gentle math. The candle burns faster when you move.",
      normal: "Bigger mazes, math grows quicker. Rushing without solving will snuff you out.",
      hard: "Large mazes, harder math from the start. Keep answering or the flame dies.",
      hardcore: "Huge mazes, a tiny flickering light, tough math. Every step costs you. Good luck!",
    } satisfies Record<Difficulty, string>,
  },
};
