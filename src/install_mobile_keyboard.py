"""Restore touch typing without changing desktop hardware-keyboard behavior."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def install_mobile_keyboard(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Mobile keyboard hook: ' + old[:90])
        source = source.replace(old, new, 1)

    change("field.mathVirtualKeyboardPolicy='manual';field.smartFence=true;",
           "field.mathVirtualKeyboardPolicy='auto';field.smartFence=true;")
    change(' applyGreekShortcuts(field);configureMathMenu(field);',
           ' applyGreekShortcuts(field);configureMathMenu(field);configureTouchKeyboard(field);')
    # Touch buttons briefly take browser focus. MathLive's focus() alone can
    # leave its internal focus flag set while the browser is focused on BODY.
    # Restore both before accepting the next virtual key, also after undo.
    for old, new in [
        ('active.focus()', 'focusMathField(active)'),
        ('active?.focus()', 'focusMathField(active)'),
        ('nextField.focus()', 'focusMathField(nextField)'),
        ('next.focus();renumber()', 'focusMathField(next);renumber()'),
        ('if (focus) field.focus()', 'if (focus) focusMathField(field)'),
        ('choose(field); field.focus()', 'choose(field); focusMathField(field)'),
        ('field.focus();field.selection=selection', 'focusMathField(field);field.selection=selection'),
        ('if(field.isConnected)field.focus()', 'if(field.isConnected)focusMathField(field)'),
        ('pasteTarget?.focus()', 'focusMathField(pasteTarget)'),
        ('f.focus();f.executeCommand', 'focusMathField(f);f.executeCommand'),
    ]:
        if old not in source:
            raise ValueError('Mobile focus hook: ' + old)
        source = source.replace(old, new)
    change('<button type="button" class="tool" id="matrixTool"',
           '<button type="button" class="tool" id="showKeyboard" aria-label="Show on-screen keyboard" aria-pressed="false"><span class="symbol" aria-hidden="true">⌨</span>Keyboard</button><button type="button" class="tool" id="matrixTool"')
    change("function syncEntryMode(){", (ROOT/'mobile-keyboard.js').read_text() + '\nfunction syncEntryMode(){')
    change('</head>', '<style>\n' + (ROOT/'mobile-keyboard.css').read_text() + '\n' + (ROOT/'mobile-layout.css').read_text() + '\n</style></head>')
    return source
