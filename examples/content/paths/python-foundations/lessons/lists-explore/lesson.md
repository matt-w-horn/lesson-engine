---
id: lists-explore
title: "Find the best three-day stretch"
type: explore
predict: "Index 6 holds the biggest single day, 9400 steps. Commit before you run: does the winning three-day window include it?"
---

:::task
Run the code and read the printed table. Set `best_start` to the start index
of the three-day window with the largest total.
:::

:::why One big day does not decide a window
`steps` stays pinned: the same 7 counts, Monday first, with 9400 at index 6.
Each table row slices one **window**, `SIZE` consecutive counts beginning at
`start`, and totals it with `sum`.

Five windows fit, starts 0 through 4. Read down the total column, find the
largest, and set `best_start` to the start index of that row. The code below
the table slices your pick and prints its total, so a rerun confirms the
choice.

The spike at index 6 sits in one window only, the one starting at 4, and two
quiet neighbors drag that window down. A steady middle stretch can beat the
biggest single day.
:::

```python starter
steps = [4200, 7100, 5300, 8000, 7600, 3100, 9400]  # pinned: Mon..Sun step counts
SIZE = 3                                            # pinned: days per window

print(f"{'start':>5}  {'window':>20}  {'total':>6}")
for start in range(len(steps) - SIZE + 1):
    window = steps[start:start + SIZE]
    print(f"{start:5d}  {str(window):>20}  {sum(window):6d}")

# Your task: set best_start to the start index of the largest total above.
best_start = 0   # <- the start index that wins the table

best_window = steps[best_start:best_start + SIZE]
best_total = sum(best_window)
print(f"\nbest window  start={best_start} -> {best_window}, total={best_total}")
```
