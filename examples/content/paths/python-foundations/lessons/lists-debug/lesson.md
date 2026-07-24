---
id: lists-debug
title: "The missing Friday"
type: debug
---

:::task
Run the code as shipped: the weekday and weekend parts fall short of the
whole week. Fix one slice until both printed sums read `47500` steps.
:::

:::why The stop index stays out
A report splits one week, `steps`, into a weekday part and a weekend part,
and the parts should add back to the whole week, 47500 steps. Run the code
as shipped: the printed sums show 40900, a gap of 6600, exactly Friday's
count.

`weekend_total` already works: `steps[5:7]` takes positions 5 and 6. The
defect sits in the weekday slice. A slice stops just before its stop index,
so the five weekdays are positions 0 through 4. Find the slice that stops
too early.

One character fixes it. After the fix, both printed sums read 47500.
:::

```python starter
steps = [5200, 6100, 4800, 7300, 6600, 9100, 8400]  # Mon..Sun daily step counts


def weekday_total(steps):
    """Total steps for Monday through Friday."""
    total = 0
    for count in steps[0:4]:
        total = total + count
    return total


def weekend_total(steps):
    """Total steps for Saturday and Sunday."""
    total = 0
    for count in steps[5:7]:
        total = total + count
    return total


parts = weekday_total(steps) + weekend_total(steps)
print(f"weekdays + weekend  {parts} steps")
print(f"whole week          {sum(steps)} steps")
```
