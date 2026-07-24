---
id: lists-complete
title: "Any window, averaged"
type: complete
---

:::task
Fill the two `...` gaps: `window` returns one slice, `window_average` turns
it into steps per day. Run until the printed values match the expected
values beside them.
:::

:::why Slice first, then divide
`window` and `window_average` split the job in two. The first gap is one
slice: the `size` counts beginning at position `start`, stopping just before
`start + size`, the same shape the table lesson swept.

The second gap turns a window into steps per day. `window_average` already
collects the counts by calling `window`; `sum(counts)` totals the list,
`len(counts)` counts the days, and the average is the total over the days.

Filled in, the middle window prints `[7100, 5300, 8000]` and averages
6800.0 steps per day. The weekend, start 5 with size 2, averages 6250.0.
:::

```python starter
steps = [4200, 7100, 5300, 8000, 7600, 3100, 9400]  # Mon..Sun daily step counts


def window(steps, start, size):
    """The size counts beginning at position start, as a list."""
    return ...


def window_average(steps, start, size):
    """Average steps per day inside that window."""
    counts = window(steps, start, size)
    return ...


print(f"middle window    {window(steps, 1, 3)}   (expect [7100, 5300, 8000])")
print(f"middle average   {window_average(steps, 1, 3)}   (expect 6800.0)")
print(f"weekend average  {window_average(steps, 5, 2)}   (expect 6250.0)")
```
