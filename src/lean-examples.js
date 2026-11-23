const leanExamples = {
  substitution: `-- If x = y + 1, replace x by y + 1 in the goal.
theorem substitute_in_sum (x y : Nat) (h : x = y + 1) :
    x + 2 = (y + 1) + 2 := by
  rw [h]
`,
  algebra: `import Mathlib.Data.Real.Basic
import Mathlib.Tactic.Linarith

-- Rearrange a linear equation to solve for x over the real numbers.
theorem isolate_x (x y : ℝ) (h : 2 * x - 3 * y = 6) :
    x = 3 * y / 2 + 3 := by
  linarith [h]
`,
};
