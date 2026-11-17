 if(wrappers.length)throw Error('Missing closing environment for '+wrappers.at(-1).env+'.');
 const namedKinds=['Theorem','Lemma','Proposition','Corollary','Claim','Definition','Remark','Example','Exercise'];
 const first=closed.find(w=>w.depth===0&&w.first===0);
 const firstProof=closed.find(w=>w.depth===0&&w.env.replace(/\*$/,'')==='proof');
 // The statement box accepts inline math. Preserve displays, lists, a preface and
 // multiple theorems as regular editable blocks when lifting them would reorder the paper.
 const simpleStatement=first&&namedKinds.includes(first.heading)&&
  !/\\(?:begin\s*\{|\[)|\$\$/.test(first.source)&&!author;
 let proofSetup={entries:imported,statement:'',proofStyle:'steps',qed:false};
 if(simpleStatement){
  const statement=first.source.split(/(\\\([\s\S]*?\\\)|(?<!\\)\$(?:\\[\s\S]|[^$\\])+\$)/g)
   .map((part,index)=>index%2?(part.startsWith('\\(')?'$'+part.slice(2,-2)+'$':part):plain(part)).join('');
  const conventional=firstProof&&firstProof.first===first.end&&firstProof.end===imported.length&&!firstProof.caption;
  proofSetup={
   statementKind:first.heading,statement:(first.caption?'('+first.caption+') ':'')+statement,
   proofStyle:conventional?'paper':'steps',qed:!!conventional,
   entries:imported.slice(first.end+(conventional?1:0))
  };
 }else if(first?.env.replace(/\*$/,'')==='proof'&&!first.caption&&first.end===imported.length){
  proofSetup={statement:'',proofStyle:'paper',qed:true,entries:imported.slice(1)};
 }
 return {title,entries:imported,proofSetup};
