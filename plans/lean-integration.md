# Lean for Proofpad

Give each proof a formal Lean 4 source file. The written argument and the formal statement are editable independently. A successful Lean check applies to the statement and assumptions in the submitted file.

1. **Author.** Add a collapsible Lean editor in Proofs, with a substitution example, a Mathlib algebra example, and UTF-8 file import and download. Keep it accessible from a phone and a hardware keyboard.
2. **Check.** Start a real Lean session only when the writer presses **Check with Lean**. Show the running checker inside Proofpad with access to Lean’s goals and diagnostics. Keep saved source available when the service is offline. Make it clear how to bring changes from the checker back into the draft.
3. **Preserve work.** Include the source in the existing proof’s autosave, JSON backup, restore, and undo history. Treat older drafts as having an empty Lean editor. A change of source, proof or workspace ends any previous check. Keep the written handout independent of the source file.
4. **Verify and release.** Check examples, a false claim and a proof using `sorry` with Lean. Exercise draft round trips, cancellation, mobile layout, and existing proof entry. Build the static release, publish to Pages, and exercise the published entry point.

## Checker choice

GitHub Pages serves static assets. The public Lean playground supports sending source in a URL fragment and running its interactive editor. Its service declines direct automated checker clients. Load the official editor on demand using its supported source link. Let the editor present its own diagnostics and distinguish a loaded frame from a checked theorem. Reading the frame’s editor text from Proofpad would cross browser origins, so offer an explicit copy-back action. The static app needs no accounts or server credentials. [Lean Web user manual](https://github.com/leanprover-community/lean4web/blob/main/doc/Usage.md)
