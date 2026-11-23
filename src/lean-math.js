// Convert only notation whose meaning can be preserved as a real-number relation.
// Every piece of Lean syntax comes from this grammar. Unknown notation stays for review.
// Callers must prove the returned domain conditions for ordinary real division.
function parseLeanRelation(latex) {
  if (typeof latex !== 'string' || latex.length > 4096) return null;
  const unsupported = Symbol('unsupported');
  const reject = () => { throw unsupported; };
  const relations = new Set(['=', '≠', '<', '>', '≤', '≥']);
  const greek = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
    eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
    nu: 'ν', xi: 'ξ', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ',
    chi: 'χ', psi: 'ψ', omega: 'ω'
  };
  const commands = {
    cdot: '*', times: '*', div: '/', leq: '≤', le: '≤', geq: '≥', ge: '≥',
    neq: '≠', ne: '≠', lt: '<', gt: '>', frac: 'frac', dfrac: 'frac', tfrac: 'frac'
  };
  const identifiers = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const greekSymbols = new Map(Object.entries(greek).map(([name, glyph]) => [glyph, 'v_' + name]));
  const tokens = [];
  const variables = new Set();
  const conditions = new Set();
  const number = value => typeof value === 'string' && /^\d/.test(value);
  const variable = value => identifiers.has(value) || (typeof value === 'string' && value.startsWith('v_'));

  function tokenize() {
    const source = latex.trim()
      .replace(/[₀-₉]+/g, digits => '_{' + Array.from(digits, d => '₀₁₂₃₄₅₆₇₈₉'.indexOf(d)).join('') + '}')
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, digits => '^{' + Array.from(digits, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d)).join('') + '}');
    const lex = /\s+|\\left\s*\(|\\right\s*\)|\\[A-Za-z]+|\\[,;:! ]|\d+(?:\.\d+)?|\.\d+|[A-Za-z]+|<=|>=|!=|./gyu;
    for (const match of source.matchAll(lex)) {
      const t = match[0];
      if (/^\s|^\\[,;:! ]$/.test(t)) continue;
      if (tokens.length > 400) reject();
      if (t.startsWith('\\left') && t.endsWith('(')) tokens.push('(');
      else if (t.startsWith('\\right') && t.endsWith(')')) tokens.push(')');
      else if (t[0] === '\\') {
        const name = t.slice(1);
        if (Object.hasOwn(commands, name)) tokens.push(commands[name]);
        else if (Object.hasOwn(greek, name)) tokens.push('v_' + name);
        else reject();
      } else if (/^[A-Za-z]+$/.test(t)) {
        // Common classroom products like MA and xy; leave names and functions for review.
        if (t.length > 2 || /^(ln|lg|if|by|of|in|or)$/i.test(t) || /^d[a-z]$/.test(t)) reject();
        tokens.push(...t);
      } else if (greekSymbols.has(t)) tokens.push(greekSymbols.get(t));
      else if (/^[.\d]/.test(t)) {
        if (t === '.' || t.length > 30) reject();
        tokens.push(t[0] === '.' ? '0' + t : t);
      } else {
        const aliases = { '<=': '≤', '>=': '≥', '!=': '≠', '−': '-', '·': '*', '×': '*', '÷': '/' };
        const token = aliases[t] || t;
        if (!relations.has(token) && !'+-*/^_(){}'.includes(token)) reject();
        tokens.push(token);
      }
    }
  }

  let at = 0;
  function take(expected) {
    if (tokens[at] !== expected) return false;
    at++;
    return true;
  }
  function group(open, close) {
    if (!take(open)) reject();
    const result = sum();
    if (!take(close)) reject();
    return result;
  }
  function binary(left, op, right) {
    if (op === '/') {
      if (right.literal === 0) reject();
      if (right.literal === undefined) conditions.add('(' + right.code + ' : ℝ) ≠ 0');
    }
    return { code: '(' + left.code + ' ' + op + ' ' + right.code + ')' };
  }
  function scriptInteger() {
    const braced = take('{');
    const value = tokens[at++];
    if (!number(value) || !/^\d+$/.test(value) || (!braced && value.length !== 1)) reject();
    if (braced && !take('}')) reject();
    return value;
  }
  function atom() {
    const t = tokens[at];
    if (number(t)) {
      at++;
      return { code: t.replace(/^0+(?=\d)/, ''), literal: Number(t), tail: 'number' };
    }
    if (variable(t)) {
      at++;
      const name = take('_') ? t + '_' + scriptInteger() : t;
      variables.add(name);
      return { code: name, tail: 'variable' };
    }
    if (t === '(') return { ...group('(', ')'), tail: 'group' };
    if (take('frac')) {
      const top = group('{', '}');
      const bottom = group('{', '}');
      return binary(top, '/', bottom);
    }
    reject();
  }
  function power() {
    const base = atom();
    if (!take('^')) return base;
    const exponent = scriptInteger().replace(/^0+(?=\d)/, '');
    if (Number(exponent) > 128) reject();
    return { code: '(' + base.code + ' ^ ' + exponent + ')', tail: base.tail };
  }
  function signed() {
    if (take('+')) return signed();
    if (!take('-')) return power();
    const term = signed();
    return {
      code: '(-' + term.code + ')',
      literal: term.literal === undefined ? undefined : -term.literal,
      tail: term.tail
    };
  }
  function product() {
    let value = signed();
    let last = value;
    let afterSlash = false;
    for (;;) {
      const next = tokens[at];
      let op = '*';
      if (next === '*' || next === '/') {
        op = next;
        at++;
      } else {
        if (!variable(next) && next !== '(' && next !== 'frac') break;
        // f(x), 1/2x and 3 followed by a stacked fraction are ambiguous.
        if (afterSlash || (last.tail === 'variable' && next === '(') ||
            (last.tail === 'number' && next === 'frac')) reject();
      }
      last = signed();
      value = binary(value, op, last);
      afterSlash = op === '/';
    }
    return value;
  }
  function sum() {
    let value = product();
    while (tokens[at] === '+' || tokens[at] === '-') {
      const op = tokens[at++];
      value = binary(value, op, product());
    }
    return value;
  }

  try {
    tokenize();
    let lhs = sum();
    const parts = [];
    while (relations.has(tokens[at])) {
      const relation = tokens[at++];
      const rhs = sum();
      // Both annotations also force scalar divisions in closed arithmetic to use ℝ.
      parts.push('(' + lhs.code + ' : ℝ) ' + relation + ' (' + rhs.code + ' : ℝ)');
      lhs = rhs;
    }
    if (!parts.length || at !== tokens.length) return null;
    const result = { proposition: parts[0], variables: [...variables], conditions: [...conditions] };
    if (parts.length > 1) {
      result.parts = parts;
      result.proposition = parts.map(part => '(' + part + ')').join(' ∧ ');
    }
    return result;
  } catch (error) {
    if (error === unsupported) return null;
    throw error;
  }
}
