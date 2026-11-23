// Remove external presentation attributes, retaining the grouped mathematical
// content. Match complete TeX control words so e.g. \\textstyle is untouched.
function plainMathMarkup(source) {
 if (typeof source!=='string' || !/\\(?:style|class|html(?:Class|Style|Data|Id)|cssId)(?![A-Za-z])/.test(source)) return source;
 const tokens=/\\([A-Za-z]+|[\s\S])|%[^\r\n]*/g;
 const wrappers=new Set(['style','class','htmlStyle','htmlClass','htmlData','cssId','htmlId']);
 const parts=[];
 let from=0, token;
 while ((token=tokens.exec(source))) {
  if (!wrappers.has(token[1])) continue;
  parts.push(source.slice(from,token.index));
  let end=tokens.lastIndex;
  while (end<source.length && /\s/.test(source[end])) end++;
  if(source[end]==='{') {
   let depth=1;
   for(end++;end<source.length && depth;end++){
    if(source[end]==='\\')end++;
    else if(source[end]==='{')depth++;
    else if(source[end]==='}')depth--;
   }
  } else if(source[end]==='\\') {
   end++;
   if(/[A-Za-z]/.test(source.charAt(end)))while(/[A-Za-z]/.test(source.charAt(end)))end++;
   else end++;
  } else if(end<source.length && source[end]!=='}')end++;
  from=tokens.lastIndex=Math.min(end,source.length);
 }
 return parts.length?parts.join('')+source.slice(from):source;
}

function protectMathField(field) {
 field.addEventListener('paste',event=>{
  const data=event.clipboardData;
  if(!data)return;
  const latex=data.getData('application/x-latex'), source=latex||data.getData('text/plain');
  const cleaned=plainMathMarkup(source);
  if(source===cleaned)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  field.insert(cleanPastedMath(cleaned),{format:'latex',selectionMode:'after'});
  choose(field);schedule();
 },true);
 field.addEventListener('input',()=>{
  const source=field.value, cleaned=plainMathMarkup(source);
  if(source===cleaned)return;
  const position=field.position, mode=field.mode;
  field.setValue(cleaned,{mode:'math',format:'latex',silenceNotifications:true});
  field.position=Math.min(position,field.lastOffset);
  if(mode==='text')field.executeCommand(['switchMode','text']);
 },true);
}
