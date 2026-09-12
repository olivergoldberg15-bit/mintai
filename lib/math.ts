/**
 * Small expression parser for the calculator and the grapher.
 *
 * Recursive descent rather than eval(), so nothing the user types can execute.
 * Supports + - * / ^ % !, parentheses, unary minus, implicit multiplication
 * (2x, 3(4+1), 2sin(x)), the usual functions, pi/e, and the variable x.
 */

type Tok =
  | { t: "num"; v: number }
  | { t: "name"; v: string }
  | { t: "op"; v: string }
  | { t: "(" }
  | { t: ")" };

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
};

const TRIG = new Set(["sin", "cos", "tan"]);
const INV_TRIG = new Set(["asin", "acos", "atan"]);

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");

  while (i < s.length) {
    const c = s[i];

    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      // scientific notation: 1e-5
      if (s[j] === "e" && /[0-9+\-]/.test(s[j + 1] ?? "")) {
        j++;
        if (/[+\-]/.test(s[j])) j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      const v = Number(s.slice(i, j));
      if (Number.isNaN(v)) throw new Error("Bad number");
      out.push({ t: "num", v });
      i = j;
      continue;
    }

    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++;
      out.push({ t: "name", v: s.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }

    if (c === "(") { out.push({ t: "(" }); i++; continue; }
    if (c === ")") { out.push({ t: ")" }); i++; continue; }
    if ("+-*/^%!".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }

    throw new Error(`Unexpected "${c}"`);
  }

  return out;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

export function evaluate(src: string, vars: Record<string, number> = {}, degrees = false): number {
  const toks = tokenize(src);
  let p = 0;

  const peek = () => toks[p];
  const eat = () => toks[p++];

  /** A value can be directly followed by another value: 2x, 3(4), 2sin(x). */
  const startsValue = (tok: Tok | undefined) =>
    !!tok && (tok.t === "num" || tok.t === "name" || tok.t === "(");

  function parseExpr(): number {
    let left = parseTerm();
    while (peek()?.t === "op" && "+-".includes((peek() as { v: string }).v)) {
      const op = (eat() as { v: string }).v;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    for (;;) {
      const tok = peek();
      if (tok?.t === "op" && "*/%".includes(tok.v)) {
        const op = (eat() as { v: string }).v;
        const right = parseUnary();
        left = op === "*" ? left * right : op === "/" ? left / right : left % right;
      } else if (startsValue(tok)) {
        left = left * parseUnary(); // implicit multiplication
      } else {
        return left;
      }
    }
  }

  function parseUnary(): number {
    const tok = peek();
    if (tok?.t === "op" && tok.v === "-") { eat(); return -parseUnary(); }
    if (tok?.t === "op" && tok.v === "+") { eat(); return parseUnary(); }
    return parsePower();
  }

  function parsePower(): number {
    const base = parsePostfix();
    if (peek()?.t === "op" && (peek() as { v: string }).v === "^") {
      eat();
      return Math.pow(base, parseUnary()); // right associative
    }
    return base;
  }

  function parsePostfix(): number {
    let v = parseAtom();
    while (peek()?.t === "op" && (peek() as { v: string }).v === "!") {
      eat();
      v = factorial(v);
    }
    return v;
  }

  function parseAtom(): number {
    const tok = eat();
    if (!tok) throw new Error("Unexpected end");

    if (tok.t === "num") return tok.v;

    if (tok.t === "(") {
      const v = parseExpr();
      if (peek()?.t !== ")") throw new Error("Missing )");
      eat();
      return v;
    }

    if (tok.t === "name") {
      const name = tok.v;

      if (name === "pi" || name === "π") return Math.PI;
      if (name === "e" && !startsValue(peek()) && peek()?.t !== "(") return Math.E;
      if (name in vars) return vars[name];

      const fn = FUNCS[name];
      if (fn) {
        // sin2 is fine, sin(2) is fine, sin 2 is fine.
        const arg = peek()?.t === "(" ? (eat(), (() => {
          const v = parseExpr();
          if (peek()?.t !== ")") throw new Error("Missing )");
          eat();
          return v;
        })()) : parseUnary();

        const input = degrees && TRIG.has(name) ? (arg * Math.PI) / 180 : arg;
        const out = fn(input);
        return degrees && INV_TRIG.has(name) ? (out * 180) / Math.PI : out;
      }

      throw new Error(`Unknown "${name}"`);
    }

    throw new Error("Unexpected symbol");
  }

  const result = parseExpr();
  if (p < toks.length) throw new Error("Unexpected trailing input");
  return result;
}

/** Formats a result the way a calculator would — no 0.30000000000000004. */
export function format(n: number): string {
  if (!Number.isFinite(n)) return Number.isNaN(n) ? "Undefined" : n > 0 ? "∞" : "-∞";
  if (n === 0) return "0";

  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-9) return n.toExponential(6).replace(/\.?0+e/, "e");

  const rounded = Number(n.toPrecision(12));
  return String(rounded);
}
