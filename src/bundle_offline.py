"""Build a file:// edition using only checksum-pinned, local release inputs."""
import argparse, base64, re, json, hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
VENDOR=HERE/'release-inputs/vendor'
PACKAGES={'jspdf':'jspdf@2.5.2/dist/jspdf.umd.min.js','mathjax':'mathjax@3.2.2/es5/tex-svg.js','mathlive':'mathlive@0.111.1/mathlive.min.js'}
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
def bundle(source,destination):
    verify()
    if source.resolve()==destination.resolve(): raise ValueError('Separate output required.')
    html=local_math(source.read_text(),'.')
    for name,url in PACKAGES.items():
        html=replace_once(html,'src="'+CDN+url+'"','src="data:text/javascript;base64,'+b64((VENDOR/(name+'.js')).read_bytes())+'"')
    css=re.sub(r'url\((fonts/[\w-]+\.woff2)\)',lambda m:'url(data:font/woff2;base64,'+b64((VENDOR/m[1]).read_bytes())+')',(VENDOR/'fonts.css').read_text())
    html=replace_once(html,'</head>','<style>'+css+'</style>\n</head>')
    marker='<script type="text/plain" id="spellingWords">'
    html=replace_once(html,marker,'<script type="text/plain" id="offlineNotices">'+(VENDOR/'NOTICES.txt').read_text()+'</script>\n<script type="text/plain" id="offlineEngine">'+b64((VENDOR/'compute-engine.js').read_bytes())+'</script>\n'+marker)
    html=local_worker(html,r"""const encoded=document.getElementById('offlineEngine').textContent;
 const engineBytes=Uint8Array.from(atob(encoded), char=>char.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([engineBytes,'\n',source],{type:'text/javascript'}));""")
    html=html.replace('Calculator could not load. Check your connection and try again.','Calculator could not start. Reload this file and try again.').replace('The math libraries could not load. Check your internet connection and reload.','The embedded math libraries could not start. Reload this file to retry.')
    destination.write_text(html)
    return destination.stat().st_size
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path)
    a=parser.parse_args();print(bundle(a.source,a.destination))
