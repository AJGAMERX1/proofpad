# Proofpad

[Open Proofpad](https://ajgamerx1.github.io/proofpad/)

Write proofs, collect formulas, and explore equations in 2D or 3D. Select an intersection to bring the equations and coordinates into a proof. The calculator supports matrices and keeps exact results such as fractions.

Proofpad runs in the browser. Use **Save draft** to download an editable backup and **Open draft** to restore it in another browser or on another device. Export finished work as a PNG or printable PDF.

To check algebra you already wrote, open **Proofs → Use written proof…** below the title. Choose your conclusion, mark the equations you were given, and click **Check with Lean**. Proofpad prepares a Lean 4 file from supported real-number equations and inequalities. It preserves paragraphs and unsupported expressions as comments. For a prose proof, **Open editable outline** brings the writing into the Lean editor, where you can formalize the argument.

The **Lean proof** panel also accepts handwritten code and `.lean` files. The official online playground shows goals, errors, and warnings. If you edit there, copy the full edited source and choose **Keep edits** to save it back to the draft. After revising the written proof, reopen **Use written proof…** to generate a fresh check.

Run `python3 -B src/build_release.py` to rebuild the website from source. To create a single HTML with the notebook assets embedded, run `python3 -B src/bundle_offline.py Proofpad.html`. Editing and preparing the Lean source work offline. Formal proof checking requires an internet connection.

GitHub Pages serves the `docs/` directory on the `main` branch. To preview the published files locally, run `python3 -m http.server --directory docs` and open [localhost:8000](http://localhost:8000/).

On a phone, tap a block to open the on-screen keyboard. **Keyboard** opens or hides it manually. Explanation blocks start with letters; equations start with the numeric keyboard.

With Playwright and its Chromium/WebKit browsers installed, run the touch regressions against that local server:

```sh
node tests/mobile-touch-controls.cjs webkit http://localhost:8000/
node tests/mobile-touch-controls.cjs chromium http://localhost:8000/
node tests/mobile-layout.cjs webkit http://localhost:8000/
node tests/mobile-layout.cjs chromium http://localhost:8000/
```

These simulate phone taps, keyboard entry, block focus, undo, matrices, and portrait/landscape layouts. Set `PROOFPAD_PLAYWRIGHT` if Playwright is installed outside the project.

[Third-party software and font notices](docs/THIRD-PARTY-NOTICES.txt)
