/** JavaScript coercion puzzles. `expr` is evaluated by the test-suite to prove each answer. */
export interface Puzzle { expr: string; answer: string; why: string; choices: string[] }
export const PUZZLES: Puzzle[] = [
  { expr: '"5" + 3', answer: '"53"', why: "+ with a string concatenates: 3 becomes \"3\".", choices: ["8", '"53"', "NaN"] },
  { expr: '"5" - 3', answer: "2", why: "- only does arithmetic, so \"5\" becomes the number 5.", choices: ["2", '"53"', "NaN"] },
  { expr: "[] + []", answer: '""', why: "Both arrays become empty strings, and \"\" + \"\" is \"\".", choices: ["[]", '""', "0"] },
  { expr: "[] == false", answer: "true", why: "== coerces: [] becomes \"\" then 0, and false becomes 0.", choices: ["true", "false", "TypeError"] },
  { expr: "[] === false", answer: "false", why: "=== never coerces: an array is not a boolean.", choices: ["true", "false", "TypeError"] },
  { expr: "null == undefined", answer: "true", why: "A special rule: loose equality treats null and undefined as equal to each other only.", choices: ["true", "false", "NaN"] },
  { expr: "null >= 0", answer: "true", why: "Relational operators convert null to 0, so >= is true even though null == 0 is false.", choices: ["true", "false", "NaN"] },
  { expr: "typeof null", answer: '"object"', why: "A 1995 bug that can never be fixed without breaking the web.", choices: ['"null"', '"object"', '"undefined"'] },
  { expr: "0.1 + 0.2 === 0.3", answer: "false", why: "Binary floating point cannot store 0.1 or 0.2 exactly; the sum is 0.30000000000000004.", choices: ["true", "false", "NaN"] },
  { expr: "NaN === NaN", answer: "false", why: "NaN is the only value not equal to itself. Use Number.isNaN().", choices: ["true", "false", "NaN"] },
  { expr: '"b" + "a" + +"a" + "a"', answer: '"baNaNa"', why: "The unary + turns \"a\" into NaN, and NaN is then joined as text.", choices: ['"baaa"', '"baNaNa"', "NaN"] },
  { expr: "[10, 9, 1].sort().join()", answer: '"1,10,9"', why: "sort() compares as strings by default: \"1\" < \"10\" < \"9\". Pass a number comparator.", choices: ['"1,9,10"', '"1,10,9"', '"10,9,1"'] },
  { expr: "parseInt('08') + parseInt('0x10')", answer: "24", why: "parseInt reads decimal 8 and recognises the 0x prefix as hex 16.", choices: ["8", "24", "NaN"] },
  { expr: "[1, 2, 3] + 4", answer: '"1,2,34"', why: "The array becomes the string \"1,2,3\" and 4 is appended as text.", choices: ["[1, 2, 3, 4]", '"1,2,34"', "10"] },
];
/** Format a value the way the puzzle answers are written. */
export function show(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(show).join(", ") + "]";
  return String(v);
}
