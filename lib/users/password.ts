// Generátor náhodného hesla pro admin user management.
// 16 znaků z a-zA-Z0-9!@#$% — garantuje aspoň 1 z každé skupiny.

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomInt(max: number): number {
  // Preferuj crypto (browser i Node 19+), fallback na Math.random.
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function generatePassword(length = 16): string {
  const required = [
    LOWER[randomInt(LOWER.length)],
    UPPER[randomInt(UPPER.length)],
    DIGITS[randomInt(DIGITS.length)],
    SYMBOLS[randomInt(SYMBOLS.length)],
  ];
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(ALL[randomInt(ALL.length)]);
  }
  // Zamíchej, ať povinné znaky nejsou vždy na začátku (Fisher–Yates).
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
