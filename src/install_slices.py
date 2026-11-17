"""Add the linked slice plane and cross-section inspector to the surface notebook."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def install_slices(source):
    def change(before, after):
        nonlocal source
        if source.count(before) != 1:
            raise ValueError('Unexpected slice integration point: ' + before[:100])
        source = source.replace(before, after, 1)

    change('<button type="button" class="surface-spin"', '<button type="button" id="surfaceSlice" aria-expanded="false" aria-controls="slicePanel">Slice</button>\n  <button type="button" class="surface-spin"')
    change('<div class="graph-surface">', '<div class="slice-layout"><div class="graph-surface">')
    change('<span id="surfaceProbe"', '<button id="sliceHandle" type="button" hidden aria-label="Move the slice plane" title="Drag the slice plane, or use the arrow keys"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12h20M7 7l-5 5 5 5M17 7l5 5-5 5"/></svg></button>\n  <span id="surfaceProbe"')
    change('<div class="surface-legend only-3d"', (ROOT/'slice-panel.html').read_text() + '\n </div>\n <div class="surface-legend only-3d"')
    change('function syncSurfaceControls(){', 'function syncSurfaceControls(){\n syncSliceControls();')
    change(' Object.assign(surfaceView,surfaceHome,{\n  yaw:', ''' Object.assign(surfaceView,surfaceHome,{
  slicing:saved.slicing===true,sliceAxis:saved.sliceAxis==='y'?'y':'x',
  sliceX:Number.isFinite(saved.sliceX)?saved.sliceX:0,sliceY:Number.isFinite(saved.sliceY)?saved.sliceY:0,
  yaw:''')
    change('function initialSurfaceEntries(){', (ROOT/'surface-slices.js').read_text() + '\nfunction initialSurfaceEntries(){')
    change('  const drawn=paintSurfacePlot(ctx,w,h,surfaces,surfaceView,palette,moving,sampleScale);', '''  const drawn=paintSurfacePlot(ctx,w,h,surfaces,surfaceView,palette,moving,sampleScale);
  if(surfaceView.slicing)paintLinkedSlice(ctx,w,h,shown,palette,canvas===graphCanvas);''')
    change('</head>', '<style>\n' + (ROOT/'surface-slices.css').read_text() + '</style>\n</head>')
    return source
