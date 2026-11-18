let touchKeyboardReady=false, touchKeyboardMode='';
let keyboardScrollFrame=0;
function focusMathField(field){
 if(!field?.isConnected)return;
 HTMLElement.prototype.focus.call(field,{preventScroll:true});
 field.focus();
}
function keepKeyboardCaretVisible(){
 cancelAnimationFrame(keyboardScrollFrame);
 keyboardScrollFrame=requestAnimationFrame(()=>{
  // MathLive lays out the edited expression on the next animation frame.
  // Read the caret after that render, rather than its previous line's bounds.
  keyboardScrollFrame=requestAnimationFrame(()=>{
  const keyboard=window.mathVirtualKeyboard,field=document.activeElement;
  if(!keyboard?.visible || field?.tagName!=='MATH-FIELD')return;
  const rect=field.shadowRoot.querySelector('.ML__caret,.ML__text-caret,.ML__latex-caret')?.getBoundingClientRect()||field.getElementInfo(field.position)?.bounds||field.getBoundingClientRect();
  const top=window.visualViewport?.offsetTop||0;
  const bottom=Math.min(keyboard.boundingRect.top,top+(window.visualViewport?.height||innerHeight))-16;
  if(rect.bottom>bottom)window.scrollBy({top:Math.min(rect.top-top-16,rect.bottom-bottom),behavior:'instant'});
  else if(rect.top<top+12)window.scrollBy({top:rect.top-top-16,behavior:'instant'});
  });
 });
}
function prepareTouchKeyboard(field){
 const keyboard=window.mathVirtualKeyboard;
 if(!keyboard)return;
 if(!touchKeyboardReady){
  touchKeyboardReady=true;
  // MathLive 0.111.1 connects a new field to its keyboard after a 60 ms
  // focus delay. Route the pinned keyboard protocol through the public field
  // command API so a fast tap after Return/Undo cannot be lost or sent to
  // the previous block. Only same-window commands for our focused editor
  // are handled; stop propagation avoids executing them a second time.
  window.addEventListener('message',event=>{
   const field=document.activeElement;
   if(event.source!==window||event.data?.type!=='mathlive#virtual-keyboard-message'||event.data.action!=='execute-command'||!keyboard.visible||field?.tagName!=='MATH-FIELD'||!field.closest('#rows'))return;
   event.stopImmediatePropagation();
   field.executeCommand(event.data.command);
  },true);
  keyboard.addEventListener('geometrychange',keepKeyboardCaretVisible);
  keyboard.addEventListener('virtual-keyboard-toggle',()=>{
   $('#showKeyboard').setAttribute('aria-pressed',String(keyboard.visible));
   $('#showKeyboard').setAttribute('aria-label',keyboard.visible?'Hide on-screen keyboard':'Show on-screen keyboard');
   keepKeyboardCaretVisible();
  });
  window.visualViewport?.addEventListener('resize',keepKeyboardCaretVisible);
 }
 const mode=field.mode==='text'?'text':'math';
 if(mode!==touchKeyboardMode){
  touchKeyboardMode=mode;
  keyboard.layouts=mode==='text'?['alphabetic','numeric','symbols','greek']:['numeric','alphabetic','symbols','greek'];
 }
}
function configureTouchKeyboard(field){
 field.addEventListener('pointerdown',event=>{
  const toggle=event.composedPath().some(node=>node.getAttribute?.('part')==='virtual-keyboard-toggle');
  if(toggle){
   // Handle this entire gesture here. Safari otherwise refocuses the field
   // after hiding the keyboard and auto-opens it again.
   event.preventDefault();event.stopImmediatePropagation();
   setTouchKeyboardVisible(field,!window.mathVirtualKeyboard.visible);
  }else{
   field.mathVirtualKeyboardPolicy='auto';
   if(event.pointerType==='touch'||event.pointerType==='pen')queueMicrotask(()=>{
    if(document.activeElement===field){prepareTouchKeyboard(field);window.mathVirtualKeyboard.show();}
   });
  }
 },true);
 for(const name of ['input','selection-change'])field.addEventListener(name,()=>{
  if(document.activeElement===field&&window.mathVirtualKeyboard?.visible)keepKeyboardCaretVisible();
 });
 field.addEventListener('focus',()=>{
  if(matchMedia('(any-pointer:coarse)').matches||window.mathVirtualKeyboard?.visible){
   prepareTouchKeyboard(field);keepKeyboardCaretVisible();
  }
 });
 field.addEventListener('mode-change',()=>{
  if(document.activeElement===field&&(matchMedia('(any-pointer:coarse)').matches||window.mathVirtualKeyboard?.visible))prepareTouchKeyboard(field);
 });
 // MathLive's Return key emits beforeinput, not a physical keydown.
 // Use the same next-block behavior for touch and hardware keyboards.
 field.addEventListener('beforeinput',event=>{
  if(event.inputType!=='insertLineBreak')return;
  event.preventDefault();
  // Finish the old field's commit before moving the virtual keyboard target.
  queueMicrotask(()=>{
   if(!field.isConnected)return;
   field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
   if(active?.isConnected&&active!==field){
    HTMLElement.prototype.focus.call(active,{preventScroll:true});
    active.focus({preventScroll:true});keepKeyboardCaretVisible();
   }
  });
 });
}
function setTouchKeyboardVisible(field,visible){
 const keyboard=window.mathVirtualKeyboard;
 if(!visible){
  if(field)field.mathVirtualKeyboardPolicy='manual';
  keyboard.hide();return;
 }
 if(!field?.isConnected)field=ensureMath();
 field.mathVirtualKeyboardPolicy='auto';
 prepareTouchKeyboard(field);
 focusMathField(field);
 keyboard.show();
 keepKeyboardCaretVisible();
}
let keyboardToggleIntent=null;
$('#showKeyboard').onpointerdown=event=>{
 keyboardToggleIntent=!window.mathVirtualKeyboard.visible;
 if(event.pointerType==='mouse')event.preventDefault();
};
$('#showKeyboard').onpointercancel=()=>{keyboardToggleIntent=null};
$('#showKeyboard').onclick=()=>{
 const visible=keyboardToggleIntent??!window.mathVirtualKeyboard.visible;
 keyboardToggleIntent=null;
 setTouchKeyboardVisible(active,visible);
};
