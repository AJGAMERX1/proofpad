// The worker supplies paths to literal slider values in already-parsed real
// expressions. Reuse those trees during a drag, then confirm the full notebook.
const sliderLinks=new Map(),sliderFields=new Map();
let sliderEditOpen=false,sliderFieldFrame=0,sliderSettleTimer=0,heldSlider=null;

function registerSliderPlan(plan,rows,update){
 if(!plan?.slots)return;
 const grouped=new Map();
 for(const [index,...path] of plan.slots){
  const row=rows[index];
  if(!row)continue;
  if(!grouped.has(row))grouped.set(row,[]);
  grouped.get(row).push(path);
 }
 for(const [row,paths] of grouped){
  if(!sliderLinks.has(row))sliderLinks.set(row,[]);
  sliderLinks.get(row).push(value=>{
   for(const path of paths){
    if(!path.length){plan.expr=value;continue;}
    let node=plan.expr;
    for(let i=0;i<path.length-1;i++)node=node[path[i]];
    node[path[path.length-1]]=value;
   }
   update(plan.expr);
  });
 }
}
function prepareSliderLinks(results,rows){
 sliderLinks.clear();
 for(const row of rows)row.hasScalarPreview=false;
 for(const series of graphSeries){
  registerSliderPlan(series,rows,tree=>{series.run=graphEvaluator(tree,series.angle);});
 }
 const {angle,digits}=calculatorPreferences();
 results.forEach((result,i)=>{
  const row=rows[i],plan=result.scalarPreview;
  if(!row||!plan||!Number.isFinite(result.number))return;
  const initial=graphEvaluator(plan.expr,angle)(0,0);
  // The compute engine owns exact and complex semantics. Preview only plans
  // which agree with its real result at the starting value.
  if(!Number.isFinite(initial)||Math.abs(initial-result.number)>1e-12*Math.max(1,Math.abs(initial),Math.abs(result.number)))return;
  row.hasScalarPreview=true;
  const output=row.querySelector('.calc-result');
  registerSliderPlan(plan,rows,tree=>{
   const number=graphEvaluator(tree,angle)(0,0);
   const text=Number.isFinite(number)?String(Number(number.toPrecision(digits))):'';
   row.calcResult=text?{...result,number,latex:text.replace(/e([+-]?\d+)/,(_,n)=>'\\times 10^{'+Number(n)+'}'),approx:!Number.isInteger(number)}:null;
   row.querySelector('.calc-use').disabled=!row.calcResult;
   output.textContent=text?(Number.isInteger(number)?'= ':'≈ ')+text:'Calculating…';
   output.setAttribute('aria-label',output.textContent);
   output.setAttribute('aria-busy',String(!Number.isFinite(number)));
  });
 });
}
function flushSliderFields(){
 if(sliderFieldFrame){cancelAnimationFrame(sliderFieldFrame);sliderFieldFrame=0;}
 for(const [row,latex] of sliderFields){
  if(!row.isConnected)continue;
  const field=row.querySelector('math-field');
  if(field.value!==latex)field.setValue(latex,{silenceNotifications:true});
  if(active===field)$('#latex').value=field.value;
 }
 sliderFields.clear();
}
function commitGraphSlider(){
 if(!sliderEditOpen)return false;
 clearTimeout(sliderSettleTimer);
 flushSliderFields();
 sliderEditOpen=false;
 commitHistory();persist();
 return true;
}
function finishGraphSlider(){
 if(commitGraphSlider() && isCalculatorMode())scheduleCalculator(true);
}
function releaseGraphSlider(event){
 if(!heldSlider||event.pointerId!==heldSlider.id)return;
 heldSlider=null;
 if(!sliderAnimations.size)finishGraphSlider();
}
window.addEventListener('pointerup',releaseGraphSlider,true);
window.addEventListener('pointercancel',releaseGraphSlider,true);
window.addEventListener('pagehide',finishGraphSlider);
document.addEventListener('pointerdown',event=>{
 if(event.target.matches?.('.slider-range'))heldSlider={id:event.pointerId};
 else if(sliderEditOpen && !sliderAnimations.size)finishGraphSlider();
},true);
document.addEventListener('keydown',event=>{
 if(sliderEditOpen && (event.metaKey||event.ctrlKey||!event.target.matches?.('.slider-range')))finishGraphSlider();
},true);
function setSliderValue(row,value){
 if(!row.calcSymbolLatex||!Number.isFinite(value))return;
 value=Number(value.toPrecision(12));
 const field=row.querySelector('math-field'),latex=row.calcSymbolLatex+'='+value;
 if((sliderFields.get(row)||field.value)===latex)return;
 if(!sliderEditOpen){
  beforeEdit();sliderEditOpen=true;
  clearTimeout(calculatorTimer);calculatorPending=null;calculatorRevision++;
  invalidateIntersections(true);
  for(const item of calculatorRows()){
   if(item.hasScalarPreview || item.calcResult?.plotOnly || item.calcResult?.empty)continue;
   item.calcResult=null;item.querySelector('.calc-use').disabled=true;
   const output=item.querySelector('.calc-result');
   output.textContent='Calculating…';output.setAttribute('aria-busy','true');
  }
 }
 sliderFields.set(row,latex);
 if(!sliderFieldFrame)sliderFieldFrame=requestAnimationFrame(flushSliderFields);
 const range=row.querySelector('.slider-range');
 if(Number(range.value)!==value)range.value=value;
 row.querySelector('.slider-value').textContent=String(Number(value.toPrecision(10)));
 for(const update of sliderLinks.get(row)||[])update(value);
 markGraphSliderMotion();
 redrawGraph();
 clearTimeout(sliderSettleTimer);
 if(!heldSlider && !sliderAnimations.size)sliderSettleTimer=setTimeout(finishGraphSlider,110);
}
