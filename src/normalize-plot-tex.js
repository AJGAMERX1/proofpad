// Normalize layout only in the calculator's parsing copy. Keep TeX's token
// boundaries: deleting a spacer literally would turn "\pi\,x" into "\pix".
function normalizeCalculationLatex(value) {
 if(!value.includes('\\'))return value;
 const spacers=new Set([' ', ',', ':', ';', '!', '>', 'space', 'nobreakspace',
  'quad', 'qquad', 'enspace', 'enskip', 'thinspace', 'medspace', 'thickspace',
  'negthinspace', 'negmedspace', 'negthickspace']);
 const literalArgs=new Set(['text','textrm','textnormal','textsf','texttt','textbf',
  'textit','textsl','textsc','mbox','hbox','operatorname','mathrm','mathit',
  'mathbf','mathsf','mathtt','mathbb','mathcal','mathfrak','mathscr','begin','end']);
 // Accept literal TeX lengths only. Unknown or incomplete arguments stay in
 // the source so normal parse errors remain visible while a formula is edited.
 const bracedLength=/\s*\{\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:mu|em|ex|pt|pc|in|bp|cm|mm|dd|cc|sp)\s*\}/y;
 const bareLength=/\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:mu|em|ex|pt|pc|in|bp|cm|mm|dd|cc|sp)/y;
 const tokens=/\\([A-Za-z]+|[\s\S])|%[^\r\n]*/g;
 let start=0,output='',match;
 while((match=tokens.exec(value))){
  const name=match[1];
  if(!name)continue; // TeX comment.
  let end=tokens.lastIndex;
  if(literalArgs.has(name)){
   if(name==='operatorname' && value[end]==='*')end++;
   while(end<value.length && /\s/.test(value[end]))end++;
   if(value[end]==='{'){
    let depth=1;
    while(++end<value.length && depth){
     const ch=value[end];
     if(ch==='\\')end++;
     else if(ch==='%'){while(end+1<value.length && !/[\r\n]/.test(value[end+1]))end++;}
     else if(ch==='{')depth++;
     else if(ch==='}')depth--;
    }
   }else if(value[end]==='\\'){
    end++;
    if(/[A-Za-z]/.test(value.charAt(end))){while(end<value.length && /[A-Za-z]/.test(value[end]))end++;}
    else end++;
   }else if(end<value.length)end++;
   tokens.lastIndex=end;
   continue;
  }
  if(name==='verb'){
   if(value[end]==='*')end++;
   if(end<value.length && !/\s/.test(value[end])){
    const delimiter=value[end++];
    while(end<value.length && value[end]!==delimiter && !/[\r\n]/.test(value[end]))end++;
    tokens.lastIndex=value[end]===delimiter?end+1:end;
   }
   continue;
  }
  if(name==='hspace'||name==='kern'||name==='mkern'){
   if(name==='hspace' && value[end]==='*')end++;
   bracedLength.lastIndex=bareLength.lastIndex=end;
   const length=bracedLength.exec(value)||(name!=='hspace'&&bareLength.exec(value));
   if(!length)continue;
   end+=length[0].length;
  }else if(!spacers.has(name))continue;
  output+=value.slice(start,match.index)+' ';
  start=tokens.lastIndex=end;
 }
 return start?output+value.slice(start):value;
}
