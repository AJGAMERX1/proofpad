# External audit verification

The 22 November 2026 audit covers the standalone Proofpad notebook. The website and standalone file share the same editor, calculator and rendering source.

| Audit findings | Acceptance check | Regression |
| --- | --- | --- |
| 1, 14, 17 | Export 150 formulas from each writing workspace, identify an incomplete formula by row, and extract display and inline mathematics from a downloaded PDF made with the pinned jsPDF 4.2.1. | `audit-exports.cjs` |
| 2, 3, 9, 12 | Sum and multiply with a local index, evaluate a definite integral, graph a supported derivative, return an exact half, and direct a three-coordinate tuple to the 3D workspace. | `audit-calculator.cjs`, `audit-calculator-ui.cjs`, `curve-engine.cjs` |
| 4, 10, 11 | Show both turns of the helix, match its legend and trace names, and warn when sampling a wide parameter interval. Looking along x produces a unit circle. | `audit-interface.cjs`, `curve-projection.cjs`, `curve-controls.cjs` |
| 5 | Preserve unsupported LaTeX as editable text while importing surrounding paragraphs and equations. Show the affected environment names before import. | `audit-import.cjs`, `audit-interface.cjs` |
| 6, 7, 8 | Check contrast and accessible control names in eight workspace/theme combinations. Expose calculator results with a math role and a spoken expression. | `audit-accessibility.cjs`, `audit-interface.cjs` |
| 13, 15, 18, 19, 20 | Switch between untouched proof examples, preserve authored work, indicate equation overflow, and type prose after scripts or Backspace. Preserve punctuation in saved and exported paragraphs. | `audit-editor.cjs` |
| 16 | In touch emulation, show gestures for the active graph view and give the Mesh checkbox and Greek shortcuts switch tap targets of at least 24 by 24 CSS pixels. | `audit-interface.cjs`, `mobile-touch-controls.cjs`, `mobile-layout.cjs` |

The tests are in `tests/`. Serve `docs/` over local HTTP for the website build. Browser tests take a Playwright engine name and a URL, including a standalone HTML file URL. Set `PROOFPAD_PLAYWRIGHT` to a local Playwright installation if necessary. The accessibility test also accepts `PROOFPAD_AXE` pointing to `axe.min.js`.

`offline-resources.cjs` checks spellcheck and both graphing workspaces with networking disabled. It exercises native and bundled gzip decoders.

The standalone bundle compresses its embedded calculator engine and dictionary. Editing, graphing, spellchecking and export run locally. The explicitly opened online Lean checker uses a separate frame. Browser accessibility checks cover the exposed roles, names and contrast; hearing the output in VoiceOver or NVDA is a separate manual check.
