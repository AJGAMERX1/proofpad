"""Apply accessible labels and recover unsupported LaTeX in the archived base."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def install_external_audit(source):
    def change(before, after):
        nonlocal source
        if source.count(before) != 1:
            raise ValueError('Unexpected audit integration point: ' + before[:85])
        source = source.replace(before, after, 1)

    policy = ("default-src 'none'; script-src 'self' 'unsafe-inline' data: blob:; "
              "style-src 'self' 'unsafe-inline' blob:; img-src 'self' data: blob:; "
              "font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; "
              "frame-src 'self' blob: https://live.lean-lang.org; base-uri 'none'; form-action 'none'")
    change('<meta charset="utf-8">', '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'">')
    change('</head>', '<style>\n' + (ROOT/'audit-access.css').read_text() + '</style>\n</head>')
    # The workspace buttons already have visible titles and descriptions.
    source = re.sub(r'(<button class="mode-tab"[^>]*?) aria-label="[^"]+ workspace"', r'\1', source)
    change('id="textMode" aria-label="Toggle text entry"', 'id="textMode"')
    change(";$('#textMode').setAttribute('aria-label',text?'Switch to math mode':'Switch to text mode')", '')
    change('aria-label="Return to baseline"', 'aria-label="Back to baseline →"')
    change("b.className='key';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);",
           "b.className='key';b.textContent=label;b.title=title;b.setAttribute('aria-label',label===title?title:label+' · '+title);")
    source = re.sub(r'(<button data-calc-key="[^"]+" aria-label=")([^"]+)(">)([^<]+)(</button>)',
                    lambda m: m[1]+m[4]+' · '+m[2]+m[3]+m[4]+m[5], source)
    change("result.className='calc-result';", "result.className='calc-result';result.setAttribute('role','math');")
    change("output.textContent=data.error||'Enter an expression';output.setAttribute('aria-label','Result');",
           "output.textContent=data.error||'Enter an expression';output.setAttribute('aria-label',output.textContent);")
    change("output.setAttribute('aria-label','Result '+(data.approx?'approximately ':'equals ')+data.latex)",
           "output.setAttribute('aria-label','Result '+(data.approx?'approximately ':'equals ')+proofpadSpokenMath(data.latex))")
    change("catch{output.textContent=(data.approx?'≈ ':'= ')+data.latex}",
           "catch{output.textContent=(data.approx?'≈ ':'= ')+data.latex;output.setAttribute('aria-label','Result '+(data.approx?'approximately ':'equals ')+proofpadSpokenMath(data.latex))}")
    change('function parseTexDocument(source) {', (ROOT/'audit-import.js').read_text()+'\nfunction parseTexDocument(source) {')
    change(r""" const clean=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/(\\[\s\S])|%[^\n]*(?:\n|$)/g,(match,escaped)=>escaped||'');""",
           r""" const original=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),comments=[],labels=[];
 const clean=removeImportTokens(original,/(\\[\s\S])|%[^\n]*(?:\n|$)/g,comments);""")
    change(r""" body=body.replace(/\\(?:label\s*\{[^{}]*\}|qedhere\b)/g,'');""",
           r""" const bodyStart=start?start.index+start[0].length:0;
 body=removeImportTokens(body,/\\(?:label\s*\{[^{}]*\}|qedhere\b)/g,labels);
 const originalOffset=(offset,atStart)=>beforeImportRemoval(bodyStart+beforeImportRemoval(offset,labels,atStart),comments,atStart);""")
    change("function paragraphLatex(source) {", "function paragraphLatex(source) {\n if (source.includes('\\\\textbackslash{}') && importedParagraphSource(source)!==null) return source;")
    change("const field=active, value=savedFieldValue(field,field.getValue(field.selection)||field.value);",
           """const field=active, selected=field.getValue(field.selection), encoded=savedFieldValue(field,selected||field.value);
 const value=field.classList.contains('explanation-field')?(importedParagraphSource(encoded)??encoded):encoded;""")
    change("const key=size+':'+token.latex;let run=runCache.get(key);",
           "const originalToken=token.latex, key=size+':'+originalToken;let run=runCache.get(key);if(!run)token.latex=renderParagraphToken(originalToken);")
    change("readablePrintRun(token.latex);runs.push", "readablePrintRun(originalToken);runs.push")
    change(r"\\(?:begin|end)\{[^}]+\}|\\item", r"\\(?:begin|end)\s*\{[^}]+\}|\\item")
    change('const imported=[],lists=[];', 'const imported=[],lists=[],preserved=new Set();')
    change(' function display(raw){', r""" function preserveTex(start,end,names){
  const literal=(pendingLabel?pendingLabel+' ':'')+original.slice(originalOffset(start,true),originalOffset(end,false));
  add('text',literal.split('\n').map(textLatex).join('\\\\'));
  pendingLabel='';for(const name of names)preserved.add(name);
 }
 function display(raw,start,end){
  // Also recover an unsupported table nested inside a display or equation.
  const registry=window.MathJax?.startup?.document?.inputJax?.[0]?.parseOptions?.handlers?.get('environment');
  if(registry){
   const unknown=[...raw.matchAll(/\\begin\s*\{([^{}]+)\}/g)].map(match=>match[1]).filter(name=>!registry.lookup(name));
   if(unknown.length){preserveTex(start,end,unknown);return;}
  }""")
    change('display(body.slice(cursor,end));cursor=end+marker.length;', 'display(body.slice(cursor,end),m.index,end+marker.length);cursor=end+marker.length;')
    change(r"""    const marker='\\end{'+env+'}',end=body.indexOf(marker,cursor);if(end<0)throw Error('Missing '+marker+'.');
    display(body.slice(m.index,end+marker.length));cursor=end+marker.length;""",
           r"""    const end=importEnvironmentEnd(body,env,cursor);if(end<0)throw Error('Missing \\end{'+env+'}.');
    display(body.slice(m.index,end),m.index,end);cursor=end;""")
    change("""}else throw Error('Unsupported environment "'+env+'". Paste a smaller excerpt or remove that wrapper.');""",
           """}else{
    const closing=opening?importEnvironmentEnd(body,env,cursor):-1;
    const end=closing<0?cursor:closing;
    preserveTex(m.index,end,[env]);cursor=end;
   }""")
    change("+' text lines';", "+' text lines'+(importCandidate.warning?' · '+importCandidate.warning:'');")
    return source
