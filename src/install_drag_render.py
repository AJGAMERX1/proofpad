"""Coalesce slider paints and restore the detailed plot after motion ends."""

def install_drag_render(source):
    def change(before, after):
        nonlocal source
        if source.count(before) != 1:
            raise ValueError('Unexpected slider rendering hook: ' + before[:100])
        source = source.replace(before, after, 1)

    change('function redrawGraph() {', '''let graphSliderDetailTimer=0;
function isSliderPreview(){return graphSliderDetailTimer!==0;}
function markGraphSliderMotion(){
 clearTimeout(graphSliderDetailTimer);
 graphSliderDetailTimer=setTimeout(()=>{
  graphSliderDetailTimer=0;
  redrawGraph();
 },130);
}
function redrawGraph() {''')
    change('const moving=!fullDetail && (graphTouches.size>0 || spinFrame!==0);',
           "const moving=!fullDetail && (isSliderPreview()?'slider':graphTouches.size>0 || spinFrame!==0);")
    change('if(surfaceView.slicing)paintLinkedSlice(ctx,w,h,shown,palette,canvas===graphCanvas);',
           '''if(surfaceView.slicing){
   if(canvas===graphCanvas)rememberSliceBackdrop(canvas);
   paintLinkedSlice(ctx,w,h,shown,palette,canvas===graphCanvas);
  }''')
    change('const interval=Math.max(1,Math.ceil(w*Math.max(1,cost)/120000))/sampleScale,cell=Math.max(4,Math.ceil(Math.sqrt(w*h*Math.max(1,cost)/300000)))/Math.min(3,sampleScale);',
           '''const preview=!fullDetail && isSliderPreview();
 const interval=Math.max(preview?2:1,Math.ceil(w*Math.max(1,cost)/120000))/sampleScale;
 const cell=Math.max(preview?8:4,Math.ceil(Math.sqrt(w*h*Math.max(1,cost)/(preview?100000:300000))))/Math.min(3,sampleScale);''')
    return source
