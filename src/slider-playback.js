// All playing rows share one clock. A coarse step only updates its equation
// when the next legal value is reached, even on a high refresh rate display.
let sliderPlaybackFrame=0;
function stopSliderPlayback(row) {
 if(!sliderAnimations.delete(row))return;
 const button=row.querySelector('.slider-play');
 button.textContent='▶';button.setAttribute('aria-label','Animate variable');
 if(!sliderAnimations.size && sliderPlaybackFrame){
  cancelAnimationFrame(sliderPlaybackFrame);sliderPlaybackFrame=0;
 }
}
function stopSliders() {
 for(const row of sliderAnimations.keys())stopSliderPlayback(row);
 finishGraphSlider();
}
function playSliderFrame(now) {
 sliderPlaybackFrame=0;
 if(!isCalculatorMode()||document.hidden){stopSliders();return;}
 for(const [row,state] of sliderAnimations){
  if(!row.isConnected || !row.calcSymbolLatex){stopSliderPlayback(row);continue;}
  const {start,min,step,count,duration}=state;
  const phase=(state.initial+Math.max(0,now-start)/duration*count)%(2*count);
  const index=Math.round(phase<=count?phase:2*count-phase);
  if(index===state.last)continue;
  state.last=index;
  setSliderValue(row,Number((min+index*step).toPrecision(12)));
 }
 if(sliderAnimations.size)sliderPlaybackFrame=requestAnimationFrame(playSliderFrame);
}
function configureSliderPlayback(row,controls,range) {
 const button=controls.querySelector('.slider-play');
 function pause(){
  if(!sliderAnimations.has(row))return;
  stopSliderPlayback(row);
  if(!sliderAnimations.size)finishGraphSlider();
 }
 range.addEventListener('pointerdown',pause);
 range.addEventListener('keydown',pause);
 controls.querySelector('.slider-bounds').addEventListener('change',pause,true);
 button.onclick=()=>{
  if(sliderAnimations.has(row)){pause();return;}
  const min=Number(range.min),step=Number(range.step),steps=(Number(range.max)-min)/step;
  const count=Math.floor(steps+Math.min(1e-8,steps*Number.EPSILON*4));
  if(!Number.isFinite(count)||count<1)return;
  const initial=Math.min(count,Math.max(0,Math.round((Number(range.value)-min)/step)));
  sliderAnimations.set(row,{start:performance.now(),min,step,count,initial,last:initial,duration:Math.min(7500,Math.max(300,count*150))});
  button.textContent='Ⅱ';button.setAttribute('aria-label','Pause variable');
  if(!sliderPlaybackFrame)sliderPlaybackFrame=requestAnimationFrame(playSliderFrame);
 };
}
