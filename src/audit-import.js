// Recover literal source from the reversible textLatex() representation used for
// unsupported environments. Keep the rest of a mixed prose/math row as LaTeX.
function importedParagraphSource(encoded) {
 if (!encoded.includes('\\textbackslash{}')) return null;
 const line = /\\text\{((?:[^{}\\]|\\(?:textbackslash|textasciitilde|textasciicircum)\{\}|\\[%$#&_{}])*)\}/gy;
 const special = {textbackslash:'\\',textasciitilde:'~',textasciicircum:'^'};
 const lines = [];
 let pos = 0;
 while (pos < encoded.length) {
  line.lastIndex = pos;
  const match = line.exec(encoded);
  if (!match) return null;
  lines.push(match[1].replace(/\\(?:(textbackslash|textasciitilde|textasciicircum)\{\}|([%$#&_{}]))/g,
   (_,name,char) => name ? special[name] : char));
  pos = line.lastIndex;
  if (pos === encoded.length) break;
  if (encoded.slice(pos,pos+2) !== '\\\\') return null;
  pos += 2;
 }
 const source = lines.join('\n');
 return /\\(?:begin|end)\s*\{[^{}]+\}/.test(source) ? source : null;
}

// MathLive can edit these ordinary text macros; MathJax supports them only
// in math mode. Emit the corresponding literal glyph between text runs.
function renderParagraphToken(latex) {
 if (!latex.startsWith('\\text{')) return latex;
 const points = {textbackslash:'005C',textasciitilde:'007E',textasciicircum:'005E'};
 return latex.replace(/\\(textbackslash|textasciitilde|textasciicircum)\{\}/g,
  (_,name) => '}\\unicode{x'+points[name]+'}\\text{');
}

// The importer removes comments and layout labels before parsing. Record only
// the gaps so a recovered environment can be copied from the original source.
function removeImportTokens(text, regexp, gaps) {
 let removed = 0;
 return text.replace(regexp,(match,...args) => {
  if (args.length > 2 && args[0]) return match;
  const at = args.at(-2) - removed;
  removed += match.length;
  gaps.push([at,removed]);
  return '';
 });
}
function beforeImportRemoval(position, gaps, atStart) {
 let low=0,high=gaps.length;
 while (low<high) {
  const mid=(low+high)>>>1, at=gaps[mid][0];
  if (at<position || (at===position && atStart)) low=mid+1;
  else high=mid;
 }
 return position+(low?gaps[low-1][1]:0);
}

function importEnvironmentEnd(body, name, from) {
 const delimiters = /\\(begin|end)\s*\{([^{}]+)\}/g;
 delimiters.lastIndex=from;
 let depth=1, match;
 while ((match=delimiters.exec(body))) {
  if (match[2] !== name) continue;
  depth += match[1] === 'begin' ? 1 : -1;
  if (!depth) return delimiters.lastIndex;
 }
 return -1;
}
