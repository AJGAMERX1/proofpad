"""Install the course-document importer and the searchable PDF layer."""
from pathlib import Path

HERE = Path(__file__).parent


def install_course_paper(source):
    def js(name):
        return (HERE / name).read_text()

    def once(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError(f"Expected one course-import/PDF insertion point: {old[:80]}")
        source = source.replace(old, new, 1)

    once('<label>Add to <select id="texDestination">',
         '<label>Workspace <select id="texDestination">')
    once('<p id="texInfo" role="status"></p>',
         '<label>Import as <select id="texAction"><option value="new">Open as new document</option>'
         '<option value="append">Append to current draft</option></select></label>'
         '<p id="texInfo" role="status"></p>')
    once('value="proofs">Proofs</option></select></label>\n<label>Import as',
         'value="proofs">Proofs</option><option value="calculator">2D Calculator</option>'
         '<option value="surface">3D Graph</option></select></label>\n<label>Import as')
    once('id="texConfirm" disabled>Append to draft','id="texConfirm" disabled>Open document')
    once('<option>Claim</option><option>Corollary</option>',
         '<option>Claim</option><option>Corollary</option><option>Definition</option>'
         '<option>Remark</option><option>Example</option><option>Exercise</option>')
    once("['Theorem','Proposition','Lemma','Claim','Corollary'].includes(d.statementKind)",
         "['Theorem','Proposition','Lemma','Claim','Corollary','Definition','Remark','Example','Exercise'].includes(d.statementKind)")
    once(' const imported=[],lists=[];', r""" body=body.replace(/\\(?:label\s*\{[^{}]*\}|qedhere\b)/g,'');
 const imported=[],lists=[];""" + '\n' + js('course-theorems.js'))
    once("   if(['multicols','multicols*'].includes(env)){",
         "   const wrapped=wrappedEnvironment(env,opening,cursor);\n"
         "   if(wrapped!==null)cursor=wrapped;\n"
         "   else if(['multicols','multicols*'].includes(env)){")
    once(' return {title,entries:imported};',js('course-proof-setup.js').rstrip())
    once(" importSource.value=value;$('#texFile').value='';previewImport();",
         " $('#texDestination').value=workspaceMode;$('#texAction').value='new';refreshImportAction();\n"
         " importSource.value=value;$('#texFile').value='';previewImport();")
    old = source[source.index("$('#texConfirm').onclick=()=>{"):source.index('const looksLikeTexDocument=')]
    once(old,js('course-document-import.js'))
    once('}runs.push({...run});','}runs.push({...run,pdfText:readablePrintRun(token.latex)});')
    once('lineNode.append(svg)}lines.push({node:lineNode,',
         'lineNode.append(svg)}if(forPrint)markPrintLine(lineNode,line,pad+gutter,lineY+line.baseline,p.size);'
         'lines.push({node:lineNode,')
    once("$('#downloadPdf').onclick=async()=>{",js('course-pdf.js')+"\n$('#downloadPdf').onclick=async()=>{")
    once("paper.height,undefined,'FAST');canvas.width=canvas.height=0;",
         "paper.height,undefined,'FAST');canvas.width=canvas.height=0;addPrintText(pdf,pages[i],paper);")
    return source
