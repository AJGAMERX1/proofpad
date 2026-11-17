const MATRIX_MAX_SIDE = 100;

function checkMatrixSize(rows,cols) {
 if (![rows,cols].every(n=>Number.isInteger(n)&&n>=1&&n<=MATRIX_MAX_SIDE))
  throw new Error('Enter 1–100 for both rows and columns.');
}

function readMatrixTable(source) {
 if (!source.trim()) throw new Error('Paste a table to set the rows and columns.');
 if (source.length>80000) throw new Error('Use up to 80,000 characters per pasted table.');
 const lines=source.replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n');
 const table=lines.map(line=>line.split('\t').map(cell=>cell.trim()));
 const cols=table[0].length;
 checkMatrixSize(table.length,cols);
 table.forEach((row,r)=>{
  if (row.length!==cols) throw new Error('Row '+(r+1)+' has '+row.length+' columns. The first row has '+cols+'.');
  row.forEach((cell,c)=>{
   // Table structure comes from TSV. A cell can contain LaTeX groups such as
   // fractions, but unescaped alignment and row delimiters would change its shape.
   let depth=0;
   for(let i=0;i<cell.length;i++){
    const ch=cell[i];
    if(ch==='\\'){
     if(i+1===cell.length||cell[i+1]==='\\'||/^\\(?:begin|end)\s*\{/.test(cell.slice(i))) depth=-1;
     else i++;
    }else if(ch==='{')depth++;
    else if(ch==='}')depth--;
    else if(ch==='&'||ch==='%'||ch==='#')depth=-1;
    if(depth<0)break;
   }
   if(depth!==0)throw new Error('Check the LaTeX in row '+(r+1)+', column '+(c+1)+'. Use tabs between cells.');
  });
 });
 return table;
}

function matrixTemplate(rows,cols,fence,fill,table=null) {
 checkMatrixSize(rows,cols);
 if (fill==='identity'&&rows!==cols)throw new Error('Use equal row and column counts for an identity matrix.');
 if(!['bmatrix','pmatrix','vmatrix','matrix'].includes(fence))throw new Error('Choose a matrix delimiter.');
 const lines=[];
 for(let r=0;r<rows;r++){
  const cells=[];
  for(let c=0;c<cols;c++){
   if(table)cells.push(table[r][c]||'#?');
   else if(fill==='blank')cells.push('#?');
   else cells.push(fill==='identity'&&r===c?'1':'0');
  }
  lines.push(cells.join('&'));
 }
 return '\\begin{'+fence+'}'+lines.join('\\\\')+'\\end{'+fence+'}';
}

const matrixDialog=$('#matrixDialog');
let matrixTarget=null;

function readMatrixForm() {
 const fill=$('#matrixFill').value;
 const pasted=fill==='paste';
 $('#matrixPaste').hidden=!pasted;
 $('#matrixRows').readOnly=$('#matrixCols').readOnly=pasted;
 const table=pasted?readMatrixTable($('#matrixData').value):null;
 if(table){
  $('#matrixRows').value=table.length;
  $('#matrixCols').value=table[0].length;
 }
 const rows=$('#matrixRows').valueAsNumber,cols=$('#matrixCols').valueAsNumber;
 return {rows,cols,latex:matrixTemplate(rows,cols,$('#matrixFence').value,fill,table)};
}

function updateMatrixForm() {
 const message=$('#matrixMessage');
 try{
  const {rows,cols}=readMatrixForm();
  message.textContent=(rows*cols).toLocaleString()+' cells · Up to 100 rows and 100 columns.';
  message.dataset.error='false';
  $('#matrixConfirm').disabled=false;
 }catch(error){
  message.textContent=error.message;
  message.dataset.error='true';
  $('#matrixConfirm').disabled=true;
 }
}

function openMatrixDialog(field) {
 if(matrixDialog.open)return;
 const target=field?.isConnected?field:ensureMath();
 matrixTarget={field:target,selection:structuredClone(target.selection),mode:target.mode};
 updateMatrixForm();
 matrixDialog.showModal();
 const input=$('#matrixFill').value==='paste'?$('#matrixData'):$('#matrixRows');
 input.focus();input.select();
}
$('#matrixTool').onpointerdown=e=>e.preventDefault();
$('#matrixTool').onclick=()=>openMatrixDialog(active);
$('#matrixForm').addEventListener('input',updateMatrixForm);
$('#matrixFill').addEventListener('change',()=>{
 updateMatrixForm();
 if($('#matrixFill').value==='paste')$('#matrixData').focus();
});
$('#matrixCancel').onclick=()=>matrixDialog.close();
matrixDialog.addEventListener('close',()=>{matrixTarget=null});
$('#matrixForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(!matrixTarget||$('#matrixConfirm').disabled)return;
 const {latex}=readMatrixForm();
 const {field,selection,mode}=matrixTarget;
 matrixDialog.close();
 field.focus();field.selection=selection;choose(field);beforeEdit();
 const fromProse=mode==='text'&&field.classList.contains('explanation-field');
 const hasBlanks=latex.includes('#?');
 scriptReturns.delete(field);
 field.executeCommand(['switchMode','math']);
 field.insert(latex,{mode:'math',format:'latex',selectionMode:hasBlanks?'placeholder':'after',focus:true});
 if(fromProse){
  if(hasBlanks)scriptReturns.set(field,{depth:field.getElementInfo(field.position)?.depth??0,typed:false});
  else field.executeCommand(['switchMode','text']);
 }
 syncEntryMode();schedule();
});
