/** "1 unit", "4 units" — counts read as words, not database columns. */
export function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
