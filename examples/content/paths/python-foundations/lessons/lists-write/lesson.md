---
id: lists-write
title: "best_window, from scratch"
type: write
entry_point: best_window
---

:::task
Write `best_window(steps, size)`: return the largest total among all full
windows of `size` consecutive counts. The printed calls show three expected
values to hit.
:::

:::why The spec, and the calls that pin it
The table lesson found the best three-day window by eye: 20900.
`best_window(steps, size)` finds it by code, for any list and any window
size.

- `steps`: a list of daily counts, at least `size` long
- `size`: how many consecutive counts one window holds
- returns the largest window total, a number

Slice each window, total it, and keep the largest total seen so far. Three
calls pin the spec: size 3 on the pinned week returns 20900, size 1 returns
the biggest single day, 9400, and size 7 returns the whole week, 44700.

The last window starts at `len(steps) - size`. Stopping one window short
misses a late surge, so make sure that start gets sliced too.
:::

```python starter
steps = [4200, 7100, 5300, 8000, 7600, 3100, 9400]  # Mon..Sun daily step counts


def best_window(steps, size):
    """Largest total among all full windows of size consecutive counts."""
    ...


print(f"best of three    {best_window(steps, 3)}   (expect 20900)")
print(f"best single day  {best_window(steps, 1)}   (expect 9400)")
print(f"whole week       {best_window(steps, 7)}   (expect 44700)")
```
