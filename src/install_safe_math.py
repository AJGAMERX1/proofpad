"""Ignore arbitrary HTML styling wrappers wherever LaTeX enters the editor or export."""
from pathlib import Path


def install_safe_math(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Safe math hook: ' + old[:90])
        source = source.replace(old, new, 1)

    js = Path(__file__).with_name('safe-math.js').read_text()
    change('function addRow(', js + '\nfunction addRow(')
    start = "field.value=type==='text'?"
    end = ";field.classList.toggle('explanation-field',type==='text');"
    a = source.index(start)
    b = source.index(end,a)
    change(source[a:b]+end, 'protectMathField(field);field.value=plainMathMarkup('+source[a+len('field.value='):b]+')'+end)
    change("active.setValue($('#latex').value.replace(", "active.setValue(plainMathMarkup($('#latex').value).replace(")
    change('function cleanPastedMath(value){return value.trim()', 'function cleanPastedMath(value){return plainMathMarkup(value).trim()')
    change("statement:$('#statement').value,statementKind:",
           "statement:plainMathMarkup($('#statement').value),statementKind:")
    change("$('#statement').value=d.statement||'';", "$('#statement').value=plainMathMarkup(d.statement||'');")
    change("$('#statement').oninput=schedule;", "$('#statement').oninput=schedule;$('#statement').onchange=event=>{event.target.value=plainMathMarkup(event.target.value);schedule()};")
    # Statement text can carry inline formulae independently of the row editor.
    change('MathJax.tex2svgPromise(token.latex,','MathJax.tex2svgPromise(plainMathMarkup(token.latex),')
    change('MathJax.tex2svgPromise(entry.value,','MathJax.tex2svgPromise(plainMathMarkup(entry.value),')
    return source
