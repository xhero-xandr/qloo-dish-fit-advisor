// Code-side check on what a cited sentence says. The agent must cite facts, and the code already
// verifies the ids exist; this adds a second, mechanical test: every number the sentence states
// must also appear in the facts it cites. A sentence that quotes a rating, count or price the cited
// facts do not contain is not backed by them, whatever the ids say.

const NUMBER = /\d+(?:[.,]\d+)*/g;

function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map((n) => {
    const plain = n.replace(/,/g, "");
    return plain.includes(".") ? plain.replace(/0+$/, "").replace(/\.$/, "") : plain;
  });
}

/** Numbers stated in `text` that none of `factTexts` contain. Empty when the sentence is backed. */
export function unsupportedNumbers(text: string, factTexts: string[]): string[] {
  const known = new Set(factTexts.flatMap(numbersIn));
  return Array.from(new Set(numbersIn(text).filter((n) => !known.has(n))));
}
