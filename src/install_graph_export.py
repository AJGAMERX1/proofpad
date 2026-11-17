"""Add compact and high-resolution JPEG choices to the graph export button."""
from pathlib import Path


def install_graph_export(source):
    button = '<button class="quiet" id="graphSave" type="button">'
    start = "document.querySelector('#graphSave').onclick="
    end = "document.querySelector('#graphExample').onclick="
    if any(source.count(marker) != 1 for marker in (button, start, end, '</head>')):
        raise ValueError('The graph export controls differ from the expected structure.')
    choice = ('<select id="graphExportFormat" aria-label="Graph export format">'
              '<option value="png">PNG</option>'
              '<option value="jpeg-sharp">Sharp JPEG · 4×</option>'
              '<option value="jpeg-compact">Compact JPEG · 1×</option></select>')
    source = source.replace(button, choice + button, 1)
    style = """<style>
#graphPanel .graph-actions #graphExportFormat {
 width:auto; max-width:100%; background:var(--pad-field); color:var(--pad-ink);
 border:1px solid var(--pad-line); border-radius:6px; padding:5px 7px; font:12px system-ui,sans-serif;
}
</style>
"""
    source = source.replace('</head>', style + '</head>', 1)
    a = source.index(start)
    b = source.index(end, a)
    script = Path(__file__).with_name('graph-export.js').read_text()
    return source[:a] + script + source[b:]
