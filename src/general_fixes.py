"""Apply focused draft and block editor fixes to the standalone Proofpad HTML."""

def replace_once(html, before, after):
    if after in html:
        return html
    if html.count(before) != 1:
        raise ValueError("Unexpected Proofpad source near " + before[:90])
    return html.replace(before, after, 1)


def apply(html):
    # Never persist a partial workspace while MathLive is initializing. In
    # particular the pagehide handler can run without the load event running.
    html = replace_once(html, "function persist(){\n if(restoring)return;",
        """let draftsLoaded = false;
function persist(){
 if (restoring || !draftsLoaded) return;""")
    html = replace_once(html,
        """  startHistory();scheduleSpelling();
 }catch(e){$('#placeholder').textContent=e.message;status('The editor could not finish loading. Reload to try again.',true)}finally{$('main').inert=false}""",
        """  startHistory();scheduleSpelling();
  draftsLoaded = true;
  persist();
  $('main').inert = false;
 }catch(e){
  $('#placeholder').textContent = e.message;
  $('#saveState').textContent = 'Draft unavailable · reload to retry';
  $('#saveState').classList.add('save-error');
  status('The editor could not finish loading. Reload to try again.', true);
 }""")

    # Renumber once on bulk loads. Calling rows() inside each iteration of
    # renumber previously made restoring a long proof do cubic DOM work.
    start, end = 'function renumber(){', 'function textLatex('
    if "function renumber() {" not in html:
        a, b = html.index(start), html.index(end, html.index(start))
        html = html[:a] + """function renumber() {
 const blocks = rows(), count = blocks.length, proof = workspaceMode === 'proofs';
 blocks.forEach((row, index) => {
  const number = index + 1;
  row.querySelector('.number').textContent = number + '.';
  const label = row.dataset.type === 'math'
   ? (workspaceMode === 'calculator' ? 'Expression' : proof ? 'Math step' : 'Formula')
   : (proof ? 'Explanation' : 'Text note');
  row.querySelector('math-field,textarea').setAttribute('aria-label', label + ' ' + number);
  row.querySelector('[data-move="up"]').disabled = index === 0;
  row.querySelector('[data-move="down"]').disabled = number === count;
 });
 $('#linecount').textContent = count + ' ' + (proof ? 'step' : 'line') + (count === 1 ? '' : 's');
}
""" + html[b:]
    html = replace_once(html,
        "function addRow(value='',focus=true,type='math',format='plain',slider=null){",
        "function addRow(value='',focus=true,type='math',format='plain',slider=null,refreshList=true){")
    html = replace_once(html,
        "choose(field);schedule()});choose(field);renumber();if(focus)field.focus();return field;",
        """choose(field);schedule()});
 if (refreshList) { choose(field); renumber(); }
 if (focus) field.focus();
 return field;""")
    html = replace_once(html,
        """function replaceEntries(data){$('#rows').replaceChildren();active=null;data.forEach(e=>addRow(e.value,false,e.type,e.format,e.slider));if(!data.length)addRow('',false);schedule()}""",
        """function replaceEntries(data) {
 $('#rows').replaceChildren();
 active = null;
 let last;
 for (const entry of data) last = addRow(entry.value, false, entry.type, entry.format, entry.slider, false);
 if (!last) last = addRow('', false, workspaceMode === 'proofs' ? 'text' : 'math', 'plain', null, false);
 choose(last);
 renumber();
 schedule();
}""")

    # Removing the active row must also move visual selection, toolbar mode,
    # LaTeX source and focus to the same adjacent row.
    html = replace_once(html,
        """const wasActive=row.contains(active);row.remove();if(!rows().length)addRow('',false,workspaceMode==='proofs'?'text':'math');if(wasActive)active=document.querySelector('math-field');if(active)$('#latex').value=active.value""",
        """const wasActive = row.contains(active);
    const neighbor = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    if (!neighbor) addRow('', true, workspaceMode === 'proofs' ? 'text' : 'math');
    else if (wasActive) {
     const nextField = neighbor.querySelector('math-field');
     choose(nextField);
     nextField.focus();
    }
   """)
    return html
