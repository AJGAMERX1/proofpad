"""Build a file:// edition using only checksum-pinned, local release inputs."""
import argparse, base64, re, json, hashlib, gzip
from pathlib import Path
HERE=Path(__file__).resolve().parent
VENDOR=HERE/'release-inputs/vendor'
PACKAGES={'jspdf':'jspdf@4.2.1/dist/jspdf.umd.min.js','mathjax':'mathjax@3.2.2/es5/tex-svg.js','mathlive':'mathlive@0.111.1/mathlive.min.js'}
CDN='https://cdn.jsdelivr.net/npm/'
def b64(data):return base64.b64encode(data).decode('ascii')
def replace_once(source,old,new):
    if source.count(old)!=1: raise ValueError('Missing or repeated release hook: '+old[:150])
    return source.replace(old,new,1)
def verify():
    base=VENDOR.parent
    for name,expected in json.loads((base/'SHA256SUMS.json').read_text()).items():
        if hashlib.sha256((base/name).read_bytes()).hexdigest()!=expected: raise ValueError('Vendor checksum: '+name)
def local_math(html,root):
    html=replace_once(html,"MathfieldElement.fontsDirectory='https://cdn.jsdelivr.net/npm/mathlive@0.111.1/fonts'",'MathfieldElement.fontsDirectory=null')
    return replace_once(html,'window.MathJax={startup:',f"window.MathJax={{loader:{{paths:{{mathjax:'{root}'}}}},startup:")
def local_worker(html,new_blob):
    html=replace_once(html,"import('https://cdn.jsdelivr.net/npm/@cortex-js/compute-engine@0.175.0/dist/esm-min/compute-engine.js').then(({ComputeEngine})=>{",'const ComputeEngine=self.ProofpadComputeEngine;')
    html=replace_once(html,'self.postMessage({ready:true})}).catch(()=>self.postMessage({loadError:true}));','self.postMessage({ready:true});')
    html=replace_once(html,"const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));",new_blob)
    return replace_once(html,"new Worker(url,{type:'module'})",'new Worker(url)')
def lazy_dictionary(h,read_text):
    h=replace_once(h,r"new Set(document.getElementById('spellingWords').textContent.trim().split(/\s+/))","new Set()")
    h=replace_once(h,'const mathWords =',"""let dictionaryReady=false,dictionaryPending=null;
function loadWordList(){
 if(!dictionaryPending)dictionaryPending="""+read_text+r""".then(text=>{for(const word of text.trim().split(/\s+/))spellingWords.add(word);dictionaryReady=true;return true}).catch(()=>{dictionaryPending=null;return false});
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
    return h
def packed_resource(name,data):
    payload=b64(gzip.compress(data,compresslevel=9,mtime=0))
    return f'<script type="text/plain" id="{name}" data-size="{len(data)}">{payload}</script>'

def bundle_html(html,destination):
    verify()
    html=local_math(html,'.')
    for name,url in PACKAGES.items():
        html=replace_once(html,'src="'+CDN+url+'"','src="data:text/javascript;base64,'+b64((VENDOR/(name+'.js')).read_bytes())+'"')
    css=re.sub(r'url\((fonts/[\w-]+\.woff2)\)',lambda m:'url(data:font/woff2;base64,'+b64((VENDOR/m[1]).read_bytes())+')',(VENDOR/'fonts.css').read_text())
    html=replace_once(html,'</head>','<style>'+css+'</style>\n</head>')
    words=re.search(r'<script type="text/plain" id="spellingWords">([\s\S]*?)</script>',html)
    if not words: raise ValueError('Missing standalone dictionary')
    helpers=replace_once((HERE/'offline-resources.js').read_text(),'/* STANDALONE_FFLATE_UMD */',(VENDOR/'fflate.js').read_text())
    resources=[
        '<script type="text/plain" id="offlineNotices">'+(VENDOR/'NOTICES.txt').read_text()+'</script>',
        packed_resource('offlineEngine',(VENDOR/'compute-engine.js').read_bytes()),
        packed_resource('spellingWords',words[1].encode()),
        '<script>'+helpers+'</script>',
    ]
    html=html[:words.start()]+'\n'.join(resources)+html[words.end():]
    html=lazy_dictionary(html,'offlineWordList()')
    html=replace_once(html,"$('#calcStatus').textContent='Loading calculator…';",
                      "$('#calcStatus').textContent='Loading calculator…';if(!offlineEngineReady())return;")
    html=local_worker(html,r"""const url=URL.createObjectURL(new Blob([offlineEngineBytes,'\n',source],{type:'text/javascript'}));
 offlineEngineBytes=null;""")
    html=html.replace('Calculator could not load. Check your connection and try again.','Calculator could not start. Reload this file and try again.').replace('The math libraries could not load. Check your internet connection and reload.','The embedded math libraries could not start. Reload this file to retry.')
    destination.write_text(html)
    return destination.stat().st_size
def bundle(source,destination):
    if source.resolve()==destination.resolve(): raise ValueError('Separate output required.')
    return bundle_html(source.read_text(), destination)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path,nargs='?',help='Optional preassembled HTML. Defaults to the current Proofpad source.')
    parser.add_argument('destination',type=Path,help='Output standalone .html file')
    a=parser.parse_args()
    if a.source is None:
        from build_graphing import s as assembled_html
        print(bundle_html(assembled_html,a.destination))
    else:
        print(bundle(a.source,a.destination))
