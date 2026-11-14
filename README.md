# Reaction Rumble (Chemical Reactions)

Dr. Dan's chemical reactions study game for CHEM 3A and CHEM 1A at Fresno City College.

Live: https://itsdrdan.github.io/reactions/  ·  Force a course in Canvas links with `?course=3A` or `?course=1A`.

**Current version:** v34 (adds the Mixing Bench)

## Mixing Bench (v34)

A fifth mode card. Each question pours two soluble salt solutions together:

1. **Predict:** the student picks what happens: one solid, the other "swap" product, both, or no solid.
2. **Mix:** the student pours, then taps a cation and an anion to test whether they clump. Soluble pairs explain the green-sheet rule that keeps them apart.
3. **Spectators:** the student marks the ions still free after mixing. A before/after table of ion counts supports this step.
4. **Net ionic:** the student types the net ionic equation, graded by the same parser as Net Ionic mode. Mixes with no reaction get a choice question instead.

About 70% of mixes form a precipitate. Pairs that course sheets call "slightly soluble" are left out, along with pairs that do not give a simple precipitate (Ca/Ag sulfate, Ca/Ba hydroxide, AgOH, Fe₂(CO₃)₃).

Check: `node tools/check-bench.js` compares all 149 possible mixes with solubility rules written independently in the test. It also checks charge and atom balance, lowest terms, spectators, and that the parser grades a correct typed answer as right and a doubled or state-less one as wrong.

