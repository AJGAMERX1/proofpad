"""Add Fit to graph to the shared 2D/3D camera controls."""
from pathlib import Path


def install_fit_view(source):
    button = '<button type="button" id="graphReset"'
    hook = "document.querySelector('#graphReset').onclick=resetGraph;"
    status = "if(graphSeries.length && !count)message="
    for marker in (button, hook, status):
        if source.count(marker) != 1:
            raise ValueError('Fit to graph could not locate ' + marker)
    source = source.replace(button, '<button type="button" id="graphFit" aria-label="Fit to graph" title="Frame the visible plots" disabled>Fit</button>\n   ' + button, 1)
    source = source.replace(status, "$('#graphFit').disabled=count===0;\n " + status, 1)
    source = source.replace('No surface is visible in this window. Try Reset or zoom out.', 'No surface is visible in this window. Choose Fit to bring it into view.', 1)
    return source.replace(hook, hook + '\n' + Path(__file__).with_name('fit-view.js').read_text(), 1)
