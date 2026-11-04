/**
 * Interpolation of the values scrubbed effects write: numbers, lengths and
 * the `inset()` and `polygon()` shapes of the catalogue, including mixed
 * units (`inset(50svh 50% calc(100% - 50svh) 50%)` → `inset(0 0
 * calc(100% - 100svh) 0)`). Pure, so the clip maths is unit-tested.
 *
 * A length is kept as a sum per unit (`calc(100% - 50svh)` is
 * `{ "%": 100, svh: -50 }`), so two lengths in different units interpolate
 * term by term, the way the browser would inside `calc()`.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number) => clamp(value, 0, 1);

export const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** Unit → value; the empty unit is a plain number. */
type Length = Record<string, number>;

type Token = { kind: "length"; value: Length } | { kind: "text"; value: string };

type Parsed = { fn: string | null; tokens: Token[] };

const numberWithUnit = /^(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)([a-z%]*)$/i;

function parseLength(text: string): Length | null {
  const simple = numberWithUnit.exec(text);
  if (simple) return { [simple[2]!.toLowerCase()]: Number(simple[1]) };
  const calc = /^calc\((.*)\)$/i.exec(text);
  if (!calc) return null;
  // Terms joined by " + " and " - " (CSS requires the spaces).
  const terms = calc[1]!.trim().split(/\s+([+-])\s+/);
  const sum: Length = {};
  let sign = 1;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i]!;
    if (i % 2 === 1) {
      sign = term === "-" ? -1 : 1;
      continue;
    }
    const length = parseLength(term);
    if (!length) return null;
    for (const [unit, value] of Object.entries(length)) sum[unit] = (sum[unit] ?? 0) + sign * value;
  }
  return sum;
}

/** Splits at top-level spaces and commas, keeping `calc(...)` whole. */
function split(text: string): Token[] {
  const tokens: Token[] = [];
  let depth = 0;
  let word = "";
  const flush = () => {
    if (!word) return;
    const length = parseLength(word);
    tokens.push(length ? { kind: "length", value: length } : { kind: "text", value: word });
    word = "";
  };
  for (const char of text.trim()) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth === 0 && (char === " " || char === ",")) {
      flush();
      if (char === ",") tokens.push({ kind: "text", value: "," });
      continue;
    }
    word += char;
  }
  flush();
  return tokens;
}

/** `inset()` with one to four lengths means the same as with four. */
function expandInset(tokens: Token[]): Token[] {
  const end = tokens.findIndex((token) => token.kind === "text");
  const lengths = end === -1 ? tokens : tokens.slice(0, end);
  const rest = end === -1 ? [] : tokens.slice(end);
  const [top, right = top, bottom = top, left = right] = lengths;
  if (!top || !right || !bottom || !left) return tokens;
  return [top, right, bottom, left, ...rest];
}

function parse(input: string | number): Parsed {
  const text = String(input).trim();
  const fn = /^([a-z-]+)\((.*)\)$/i.exec(text);
  if (fn && fn[1] !== "calc") {
    const name = fn[1]!.toLowerCase();
    const tokens = split(fn[2]!);
    return { fn: name, tokens: name === "inset" ? expandInset(tokens) : tokens };
  }
  return { fn: null, tokens: split(text) };
}

/** Up to four decimals, without trailing zeros, so equal values compare equal. */
function format(value: number): string {
  const rounded = Math.round(value * 1e4) / 1e4;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function serializeLength(length: Length): string {
  const terms = Object.entries(length).filter(([, value]) => Math.abs(value) > 1e-6);
  if (terms.length === 0) return "0";
  if (terms.length === 1) return `${format(terms[0]![1])}${terms[0]![0]}`;
  const [first, ...others] = terms;
  let out = `${format(first![1])}${first![0]}`;
  for (const [unit, value] of others) {
    out += value < 0 ? ` - ${format(-value)}${unit}` : ` + ${format(value)}${unit}`;
  }
  return `calc(${out})`;
}

function serialize({ fn, tokens }: Parsed): string {
  let out = "";
  for (const token of tokens) {
    if (token.kind === "text" && token.value === ",") out += ",";
    else
      out += `${out && !out.endsWith("(") ? " " : ""}${token.kind === "length" ? serializeLength(token.value) : token.value}`;
  }
  return fn ? `${fn}(${out})` : out;
}

function mixLength(from: Length, to: Length, t: number): Length {
  const out: Length = {};
  for (const unit of new Set([...Object.keys(from), ...Object.keys(to)])) {
    out[unit] = mix(from[unit] ?? 0, to[unit] ?? 0, t);
  }
  return out;
}

/**
 * A function from progress (0…1, or beyond for unclamped effects) to the CSS
 * value between `from` and `to`. Both must have the same shape: the same
 * function, the same number of lengths and the same keywords. A plain `0`
 * matches a length in any unit.
 */
export function interpolate(from: string | number, to: string | number): (t: number) => string {
  const a = parse(from);
  const b = parse(to);
  const same =
    a.fn === b.fn &&
    a.tokens.length === b.tokens.length &&
    a.tokens.every((token, i) => {
      const other = b.tokens[i]!;
      return token.kind === other.kind && (token.kind === "length" || token.value === other.value);
    });
  if (!same) throw new Error(`Cannot interpolate "${from}" to "${to}": different shapes`);
  return (t) =>
    serialize({
      fn: a.fn,
      tokens: a.tokens.map((token, i) => {
        const other = b.tokens[i]!;
        return token.kind === "length" && other.kind === "length"
          ? { kind: "length", value: mixLength(token.value, other.value, t) }
          : token;
      }),
    });
}
