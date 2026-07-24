---
id: functions-complete
title: "Three tiers, two boundaries"
type: complete
---

:::task
Fill the three `...` gaps in `discount_rate` so the printed sweep matches
the docstring's tiers. The guard came filled in: leave it alone.
:::

:::why Early returns read top down
`discount_rate` runs its **tiers**, the discount bands, from the top: the
first test that passes returns, and nothing below it runs. The guard fires
before any tier: a negative subtotal raises `ValueError`, the same shape as
the shipping guard.

The top tier's test comes filled in, 100 or more, and its gap is the rate
the docstring promises. The middle gap is the second tier's whole test. Both
boundaries are inclusive, so exactly 50 earns the middle rate and 99.99
stays in the middle tier. The last gap is what everyone else gets: zero
discount, as a number the price code can still multiply by.

Order does the real work: 250 passes the first test, so the middle tier
never sees it.
:::

```python starter
def discount_rate(subtotal):
    """Fraction off an order: 0.10 at 100 or more, 0.05 at 50 or more, else 0.0."""
    if subtotal < 0:
        raise ValueError("subtotal cannot be negative")
    if subtotal >= 100:
        return ...   # <- the top rate the docstring promises
    if ...:          # <- the middle tier's test: at the middle boundary or more
        return 0.05
    return ...       # <- everyone else: no discount, as a number


for subtotal in [20.0, 50.0, 99.99, 100.0, 250.0]:
    rate = discount_rate(subtotal)
    print(f"subtotal {subtotal:7.2f} -> rate {rate}")
```
