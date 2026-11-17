"""Build the Proofpad website in docs/ for GitHub Pages."""
import hashlib,json,re
from pathlib import Path
from bundle_offline import VENDOR, PACKAGES, CDN, verify, replace_once, local_worker, local_math
HERE=Path(__file__).resolve().parent
OUTPUT=HERE.parent/'docs'
def website(source):
    files={}
    def asset(name,data):
        if isinstance(data,str): data=data.encode()
        p=Path(name); key=f'assets/{p.stem}.{hashlib.sha256(data).hexdigest()[:12]}{p.suffix}'
        files[key]=data;return key
    h=local_math(source,'./assets'); urls={name:asset(name+'.js',(VENDOR/(name+'.js')).read_bytes()) for name in [*PACKAGES,'compute-engine']}
    for name,url in PACKAGES.items():
        if name=='jspdf':
            h=replace_once(h,f'<script defer src="{CDN+url}"></script>','')
        else:h=replace_once(h,'src="'+CDN+url+'"','src="'+urls[name]+'"')
    css=re.sub(r'url\((fonts/[\w-]+\.woff2)\)',lambda m:'url('+asset(Path(m[1]).name,(VENDOR/m[1]).read_bytes()).split('/')[-1]+')',(VENDOR/'fonts.css').read_text())
    h=replace_once(h,'</head>','<link rel="stylesheet" href="'+asset('fonts.css',css)+'"></head>')
    h=local_worker(h,"const dependency=new URL("+json.dumps(urls['compute-engine'])+",document.baseURI).href;\n const url=URL.createObjectURL(new Blob(['importScripts('+JSON.stringify(dependency)+');\\n',source],{type:'text/javascript'}));")
    pdf_hook="if(!window.jspdf?.jsPDF)throw new Error("
    h=replace_once(h,pdf_hook,"if(!window.jspdf?.jsPDF)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src="+json.dumps(urls['jspdf'])+";script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('Could not load PDF tools. Retry or use Print / Save PDF.'));};document.head.append(script);});\n  "+pdf_hook)
    word=re.search(r'<script type="text/plain" id="spellingWords">([\s\S]*?)</script>',h)
    path=asset('dictionary.txt',word[1]);h=h[:word.start()]+h[word.end():]
    h=replace_once(h,r"new Set(document.getElementById('spellingWords').textContent.trim().split(/\s+/))","new Set()")
    h=replace_once(h,'const mathWords =',"""let dictionaryReady=false,dictionaryPending=null;
function loadWordList(){
 if(!dictionaryPending)dictionaryPending=fetch("""+json.dumps(path)+r""").then(r=>{if(!r.ok)throw Error('Dictionary unavailable');return r.text()}).then(text=>{for(const word of text.trim().split(/\s+/))spellingWords.add(word);dictionaryReady=true;return true}).catch(()=>{dictionaryPending=null;return false});
 return dictionaryPending;
}
const mathWords =""")
    h=replace_once(h,'spellingTimer=setTimeout(()=>{\n  const issues=spellingIssues();',"""spellingTimer=setTimeout(async()=>{
  if(!dictionaryReady){
   if(!spellingSources().some(s=>s.element.value && proseRanges(s.element.value,s.latex).some(([a,b])=>/[A-Za-z]{2}/.test(s.element.value.slice(a,b)))))return;
   if(!await loadWordList()){$('#spellReview').textContent='Check spelling · retry';return;}
  }
  if(!$('#spellEnabled').checked)return;
  const issues=spellingIssues();""")
    h=replace_once(h,"$('#spellReview').onclick=showSpelling;","$('#spellReview').onclick=async()=>{if(dictionaryReady||await loadWordList())showSpelling();else status('Could not load the spelling dictionary. Try again.',true);};")
    files['THIRD-PARTY-NOTICES.txt']=(VENDOR/'NOTICES.txt').read_bytes()
    files['index.html']=h.encode()
    return files
def main():
    from build_graphing import s as assembled_html

    verify()
    files = website(assembled_html)
    for name, data in files.items():
        path = OUTPUT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    (OUTPUT / '.nojekyll').touch()
    print(f'Built {len(files)} release files in docs/')

if __name__ == '__main__':
    main()
