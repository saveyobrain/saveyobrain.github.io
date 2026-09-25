import { SITE_NAME } from "./config";
import type { Difficulty } from "./core/difficulty";

export const strings = {
  siteName: SITE_NAME,
  tagline: "Free games to keep your brain strong.",
  hubIntro:
    "Math is a basic skill, just like reading and writing. Play a little every day to build it up and keep it sharp.",
  play: "Play",
  continueLevel: (n: number, difficulty: string) => `Continue: level ${n} (${difficulty})`,
  startOver: "Start from level 1",
  comingSoon: "More games coming soon",
  footer: "Free forever. No ads, no accounts. Progress is saved in this browser.",

  pause: "Pause",
  paused: "Paused",
  resume: "Resume",
  restartLevel: "Restart level",
  backToGames: "Back to games",

  level: (n: number) => `Level ${n}`,
  start: "Start",
  nextLevel: "Next level",
  tryAgain: "Try again",
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
      "Find the exit of a dark maze. Solve math tasks to keep your candle burning!",
    introGoal: "Find the exit. Solve tasks to keep your candle burning!",
    controls:
      "Move: arrow keys, WASD, or tap/click inside the light. Answer: keys 1-4 or tap. Pause: Esc.",
    levelComplete: "You found the exit!",
    candleOut: "Your candle went out...",
    candleOutHint: "Solve tasks as you walk to keep the flame alive.",
    exitHint: "Look for the door out of the maze.",
    difficultyHints: {
      easy: "Small mazes, a slow candle and gentle math.",
      normal: "Bigger mazes, a faster candle, math grows quicker.",
      hard: "Large mazes, a quick candle, harder math from the start.",
      hardcore: "Huge mazes, a tiny flickering light, tough math. Good luck!",
    } satisfies Record<Difficulty, string>,
  },
};
