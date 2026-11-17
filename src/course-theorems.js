 const theoremKinds=new Map(Object.entries({
  theorem:'Theorem',thm:'Theorem',lemma:'Lemma',lem:'Lemma',proposition:'Proposition',prop:'Proposition',
  corollary:'Corollary',cor:'Corollary',claim:'Claim',definition:'Definition',remark:'Remark',
  example:'Example',exercise:'Exercise',proof:'Proof'
 }));
 for(const declaration of pre.matchAll(/\\newtheorem\*?\s*\{([^{}]+)\}\s*(?:\[[^\]]*\]\s*)?\{([^{}]+)\}/g)){
  theoremKinds.set(declaration[1],plain(declaration[2]).trim());
 }
 const wrappers=[],closed=[];
 function wrappedEnvironment(env,opening,pos){
  const heading=theoremKinds.get(env)||theoremKinds.get(env.replace(/\*$/,''));
  if(!heading)return null;
  if(opening){
   const note=/^\s*\[([^\]]*)\]/.exec(body.slice(pos));
   const next=pos+(note?.[0].length||0);
   const caption=note?plain(note[1]).trim():'';
   const wrapper={env,heading,caption,first:imported.length,start:next,depth:wrappers.length};
   wrappers.push(wrapper);
   const namedProof=env.replace(/\*$/,'')==='proof'&&caption;
   buffer=namedProof?caption:(caption?heading+' ('+caption+')':heading);
   if(!/[.!?]$/.test(buffer))buffer+='.';
   flush();
   return next;
  }
  const wrapper=wrappers.pop();
  if(!wrapper||wrapper.env!==env)throw Error('Mismatched '+env+' environment.');
  wrapper.end=imported.length;wrapper.source=body.slice(wrapper.start,m.index).trim();closed.push(wrapper);
  return pos;
 }
