// The small, language-neutral notation learners type in Write mode, e.g.
//   if j >= w[i] then max(dp[i-1][j], dp[i-1][j-w[i]] + v[i]) else dp[i-1][j]
// A hand-written parser and tree-walking interpreter run it; nothing is passed to eval.
//
// Every value carries the multiset of items that built it, so a run can show the moment
// an item is used twice.

export type Dims = 1 | 2;

type BinOp = '+' | '-' | '*' | '<' | '<=' | '>' | '>=' | '==' | '!=' | 'and' | 'or';

export type Node =
  | { t: 'num'; value: number; pos: number }
  | { t: 'var'; name: 'i' | 'j' | 'n' | 'W' | 'INF'; pos: number }
  | { t: 'arr'; name: 'w' | 'v' | 'dp'; idx: Node[]; pos: number }
  | { t: 'call'; fn: 'max' | 'min'; args: Node[]; pos: number }
  | { t: 'neg'; e: Node; pos: number }
  | { t: 'not'; e: Node; pos: number }
  | { t: 'bin'; op: BinOp; a: Node; b: Node; pos: number }
  | { t: 'if'; c: Node; a: Node; b: Node; pos: number };

export class NotationError extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message);
  }
}

type Tok = { k: 'num'; v: number; pos: number } | { k: 'id'; v: string; pos: number } | { k: 'op'; v: string; pos: number } | { k: 'eof'; pos: number };

const UNICODE_OPS: Record<string, string> = { '≤': '<=', '≥': '>=', '≠': '!=', '−': '-', '–': '-', '×': '*', '←': ':=' };
const TWO_CHAR_OPS = ['<=', '>=', '==', '!=', '&&', '||', ':='];
const ONE_CHAR_OPS = '+-*()[],<>!?:=';

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let p = 0;
  while (p < src.length) {
    const ch = src[p];
    if (/\s/.test(ch)) {
      p++;
    } else if (/[0-9]/.test(ch)) {
      const start = p;
      while (p < src.length && /[0-9]/.test(src[p])) p++;
      toks.push({ k: 'num', v: Number(src.slice(start, p)), pos: start });
    } else if (/[A-Za-z_]/.test(ch)) {
      const start = p;
      while (p < src.length && /[A-Za-z0-9_]/.test(src[p])) p++;
      toks.push({ k: 'id', v: src.slice(start, p), pos: start });
    } else if (UNICODE_OPS[ch]) {
      toks.push({ k: 'op', v: UNICODE_OPS[ch], pos: p });
      p++;
    } else if (TWO_CHAR_OPS.includes(src.slice(p, p + 2))) {
      toks.push({ k: 'op', v: src.slice(p, p + 2), pos: p });
      p += 2;
    } else if (ONE_CHAR_OPS.includes(ch)) {
      toks.push({ k: 'op', v: ch, pos: p });
      p++;
    } else {
      throw new NotationError(`The character “${ch}” is not part of the notation.`, p);
    }
  }
  toks.push({ k: 'eof', pos: src.length });
  return toks;
}

const KEYWORDS = new Set(['if', 'then', 'else', 'and', 'or', 'not']);

function describe(t: Tok): string {
  if (t.k === 'eof') return 'the end of the formula';
  return `“${t.v}”`;
}

function unknownName(name: string, pos: number): NotationError {
  const lower = name.toLowerCase();
  let tip = '';
  if (['c', 'cap', 'capacity', 'm'].includes(lower)) tip = ' The capacity is W; the current capacity is j.';
  else if (['weight', 'wt'].includes(lower)) tip = ' Write the weight of item i as w[i].';
  else if (['value', 'val', 'price'].includes(lower)) tip = ' Write the value of item i as v[i].';
  else if (lower === 'f' || lower === 'd' || lower === 'opt') tip = ' The table is called dp.';
  return new NotationError(`Unknown name “${name}”.${tip} You can use i, j, n, W, w[k], v[k], dp[…], max, min, INF.`, pos);
}

class Parser {
  private k = 0;
  constructor(
    private toks: Tok[],
    private dims: Dims,
  ) {}

  private peek(): Tok {
    return this.toks[this.k];
  }
  private next(): Tok {
    return this.toks[this.k++];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return t.k === 'op' && t.v === v;
  }
  private isKw(v: string): boolean {
    const t = this.peek();
    return t.k === 'id' && t.v.toLowerCase() === v;
  }
  private expectOp(v: string, context: string): void {
    const t = this.next();
    if (t.k !== 'op' || t.v !== v) throw new NotationError(`Expected “${v}” ${context}, but found ${describe(t)}.`, t.pos);
  }

  /** Skip an optional left side such as "dp[i][j] =" so learners can write a full assignment. */
  skipLhs(): void {
    const t0 = this.toks[0];
    if (t0.k !== 'id' || t0.v !== 'dp') return;
    let p = 1;
    let groups = 0;
    while (this.toks[p].k === 'op' && (this.toks[p] as { v: string }).v === '[') {
      let depth = 0;
      do {
        const t = this.toks[p];
        if (t.k === 'eof') return;
        if (t.k === 'op' && t.v === '[') depth++;
        if (t.k === 'op' && t.v === ']') depth--;
        p++;
      } while (depth > 0);
      groups++;
    }
    const eq = this.toks[p];
    if (groups > 0 && eq.k === 'op' && (eq.v === '=' || eq.v === ':=')) {
      if (groups !== this.dims) {
        throw new NotationError(
          this.dims === 1 ? 'In the one-array version, dp has one index: dp[j].' : 'In the table version, dp has two indices: dp[i][j].',
          t0.pos,
        );
      }
      this.k = p + 1;
    }
  }

  parseAll(): Node {
    this.skipLhs();
    if (this.peek().k === 'eof') throw new NotationError('The formula is empty.', this.peek().pos);
    const e = this.expr();
    const t = this.peek();
    if (t.k !== 'eof') {
      if (t.k === 'op' && t.v === ')') throw new NotationError('This “)” has no matching “(”.', t.pos);
      throw new NotationError(`Unexpected ${describe(t)}. Is an operator such as + or a comma missing?`, t.pos);
    }
    return e;
  }

  private expr(): Node {
    if (this.isKw('if')) {
      const pos = this.next().pos;
      const c = this.expr();
      if (!this.isKw('then')) throw new NotationError(`Expected “then” after the condition, but found ${describe(this.peek())}.`, this.peek().pos);
      this.next();
      const a = this.expr();
      if (!this.isKw('else')) throw new NotationError(`Expected “else” after the “then” part, but found ${describe(this.peek())}.`, this.peek().pos);
      this.next();
      const b = this.expr();
      return { t: 'if', c, a, b, pos };
    }
    const c = this.or();
    if (this.isOp('?')) {
      const pos = this.next().pos;
      const a = this.expr();
      this.expectOp(':', 'between the two choices of “? :”');
      const b = this.expr();
      return { t: 'if', c, a, b, pos };
    }
    return c;
  }

  private or(): Node {
    let a = this.and();
    while (this.isKw('or') || this.isOp('||')) {
      const pos = this.next().pos;
      a = { t: 'bin', op: 'or', a, b: this.and(), pos };
    }
    return a;
  }

  private and(): Node {
    let a = this.cmp();
    while (this.isKw('and') || this.isOp('&&')) {
      const pos = this.next().pos;
      a = { t: 'bin', op: 'and', a, b: this.cmp(), pos };
    }
    return a;
  }

  private cmp(): Node {
    const a = this.add();
    const t = this.peek();
    if (t.k === 'op' && ['<', '<=', '>', '>=', '==', '!='].includes(t.v)) {
      this.next();
      return { t: 'bin', op: t.v as BinOp, a, b: this.add(), pos: t.pos };
    }
    if (t.k === 'op' && t.v === '=') {
      throw new NotationError('Use == to compare two numbers. A single = may only follow dp[…] at the start.', t.pos);
    }
    return a;
  }

  private add(): Node {
    let a = this.mul();
    for (;;) {
      const t = this.peek();
      if (t.k === 'op' && (t.v === '+' || t.v === '-')) {
        this.next();
        a = { t: 'bin', op: t.v, a, b: this.mul(), pos: t.pos };
      } else return a;
    }
  }

  private mul(): Node {
    let a = this.unary();
    while (this.isOp('*')) {
      const pos = this.next().pos;
      a = { t: 'bin', op: '*', a, b: this.unary(), pos };
    }
    return a;
  }

  private unary(): Node {
    if (this.isOp('-')) {
      const pos = this.next().pos;
      return { t: 'neg', e: this.unary(), pos };
    }
    if (this.isOp('!') || this.isKw('not')) {
      const pos = this.next().pos;
      return { t: 'not', e: this.unary(), pos };
    }
    return this.primary();
  }

  private index(name: string): Node {
    this.expectOp('[', `after ${name}`);
    if (this.isOp(']')) throw new NotationError(`The brackets after ${name} are empty.`, this.peek().pos);
    const e = this.expr();
    this.expectOp(']', `to close the index of ${name}`);
    return e;
  }

  private primary(): Node {
    const t = this.next();
    if (t.k === 'num') return { t: 'num', value: t.v, pos: t.pos };
    if (t.k === 'op' && t.v === '(') {
      const e = this.expr();
      this.expectOp(')', 'to close “(”');
      return e;
    }
    if (t.k !== 'id') throw new NotationError(`Expected a number, a name, or “(”, but found ${describe(t)}.`, t.pos);

    const name = t.v;
    const lower = name.toLowerCase();
    if (KEYWORDS.has(lower)) throw new NotationError(`“${name}” cannot be used here.`, t.pos);
    if (name === 'i' || name === 'j' || name === 'n' || name === 'W') return { t: 'var', name, pos: t.pos };
    if (lower === 'inf' || lower === 'infinity') return { t: 'var', name: 'INF', pos: t.pos };
    if (lower === 'max' || lower === 'min') {
      this.expectOp('(', `after ${lower}`);
      const args: Node[] = [];
      if (!this.isOp(')')) {
        args.push(this.expr());
        while (this.isOp(',')) {
          this.next();
          args.push(this.expr());
        }
      }
      this.expectOp(')', `to close ${lower}(…)`);
      if (args.length < 2) throw new NotationError(`${lower}(…) needs at least two choices separated by a comma.`, t.pos);
      return { t: 'call', fn: lower, args, pos: t.pos };
    }
    if (name === 'w' || name === 'v') {
      if (!this.isOp('[')) throw new NotationError(`${name} is a list; write ${name}[i] for item i.`, t.pos);
      const idx = [this.index(name)];
      if (this.isOp('[')) throw new NotationError(`${name}[…] takes one index.`, this.peek().pos);
      return { t: 'arr', name, idx, pos: t.pos };
    }
    if (name === 'dp') {
      if (!this.isOp('[')) throw new NotationError('dp is the table; write dp[…] with an index.', t.pos);
      const idx: Node[] = [];
      while (this.isOp('[')) idx.push(this.index('dp'));
      if (idx.length !== this.dims) {
        throw new NotationError(
          this.dims === 1 ? 'In the one-array version, dp has one index: dp[j].' : 'In the table version, dp has two indices: dp[i][j].',
          t.pos,
        );
      }
      return { t: 'arr', name: 'dp', idx, pos: t.pos };
    }
    if (name === 'V' || name === 'w_i' || name === 'v_i') {
      throw new NotationError(`Write weights and values as w[i] and v[i].`, t.pos);
    }
    throw unknownName(name, t.pos);
  }
}

export function parse(src: string, dims: Dims): Node {
  return new Parser(lex(src), dims).parseAll();
}

// ---------------------------------------------------------------------------
// Interpreter

export interface Val {
  v: number;
  /** items[k] = copies of item k + 1 inside this value; null = none. */
  items: number[] | null;
}

export type EvalErrorKind = 'oob' | 'unset' | 'item' | 'nan';

export class EvalError extends Error {
  constructor(
    public kind: EvalErrorKind,
    message: string,
    public idx: number[] = [],
  ) {
    super(message);
  }
}

export interface Env {
  i: number;
  j: number;
  n: number;
  W: number;
  w: number[];
  v: number[];
  /** Reads dp at idx; throws EvalError('oob' | 'unset'). */
  read(idx: number[]): Val;
}

function plain(v: number): Val {
  return { v, items: null };
}

function mergeItems(a: number[] | null, b: number[] | null): number[] | null {
  if (!a) return b;
  if (!b) return a;
  return a.map((c, k) => c + b[k]);
}

function asIndex(x: number, what: string): number {
  if (!Number.isFinite(x) || !Number.isInteger(x)) throw new EvalError('nan', `The index of ${what} is not a whole number.`);
  return x;
}

function itemIndex(env: Env, k: number, name: string): number {
  if (k < 1 || k > env.n) {
    throw new EvalError('item', `${name}[${k}] does not exist: items are numbered 1 to ${env.n}.`);
  }
  return k;
}

export function evaluate(node: Node, env: Env): Val {
  switch (node.t) {
    case 'num':
      return plain(node.value);
    case 'var':
      if (node.name === 'INF') return plain(Infinity);
      return plain(env[node.name]);
    case 'arr': {
      if (node.name === 'dp') {
        const idx = node.idx.map((e) => asIndex(evaluate(e, env).v, 'dp'));
        return env.read(idx);
      }
      const k = itemIndex(env, asIndex(evaluate(node.idx[0], env).v, node.name), node.name);
      if (node.name === 'w') return plain(env.w[k - 1]);
      const items = Array(env.n).fill(0);
      items[k - 1] = 1;
      return { v: env.v[k - 1], items };
    }
    case 'call': {
      let best = evaluate(node.args[0], env);
      for (const a of node.args.slice(1)) {
        const x = evaluate(a, env);
        if (node.fn === 'max' ? x.v > best.v : x.v < best.v) best = x;
      }
      return best;
    }
    case 'neg': {
      const a = evaluate(node.e, env);
      return { v: -a.v, items: a.items };
    }
    case 'not':
      return plain(evaluate(node.e, env).v ? 0 : 1);
    case 'if':
      return evaluate(node.c, env).v ? evaluate(node.a, env) : evaluate(node.b, env);
    case 'bin': {
      if (node.op === 'and') return plain(evaluate(node.a, env).v && evaluate(node.b, env).v ? 1 : 0);
      if (node.op === 'or') return plain(evaluate(node.a, env).v || evaluate(node.b, env).v ? 1 : 0);
      const a = evaluate(node.a, env);
      const b = evaluate(node.b, env);
      let out: Val;
      switch (node.op) {
        case '+':
          out = { v: a.v + b.v, items: mergeItems(a.items, b.items) };
          break;
        case '-':
          out = { v: a.v - b.v, items: a.items };
          break;
        case '*':
          out = { v: a.v * b.v, items: a.items ?? b.items };
          break;
        case '<':
          return plain(a.v < b.v ? 1 : 0);
        case '<=':
          return plain(a.v <= b.v ? 1 : 0);
        case '>':
          return plain(a.v > b.v ? 1 : 0);
        case '>=':
          return plain(a.v >= b.v ? 1 : 0);
        case '==':
          return plain(a.v === b.v ? 1 : 0);
        case '!=':
          return plain(a.v !== b.v ? 1 : 0);
      }
      if (Number.isNaN(out.v)) throw new EvalError('nan', 'The result is not a number (∞ − ∞ or similar).');
      return out;
    }
  }
}
