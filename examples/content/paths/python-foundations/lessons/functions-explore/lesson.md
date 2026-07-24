---
id: functions-explore
title: "Where free shipping begins"
type: explore
predict: "The free comparison is >= against a limit of 50. Commit before you run: does a cart of exactly 50.00 ship free, and which subtotal is the table's first free row?"
---

:::task
Run the code and read the table. Set `cheapest_free` to the smallest
subtotal in the table that ships free.
:::

:::why Boundaries live on one character
`FREE_LIMIT`, `BASE`, `RATE`, and `WEIGHT` stay pinned at 50.0, 3.0, 2.0,
and 2.0: the same shop as the last lesson, with the same free promise,
pricing the same parcel at nine subtotals. Read down the free column: every
paid row shows 7.00, and the first free row is the **boundary**, the exact
point where the early return starts winning.

Which side of 50.00 the boundary lands on comes down to one character. `>=`
includes the limit itself, the strict `>` leaves it out, and the rows at
49.99 and 50.01 sit close enough to show the difference.

Set `cheapest_free` to the first free subtotal, and the last line runs it
back through `shipping_cost` to confirm your reading.
:::

```python starter
FREE_LIMIT = 50.0   # pinned: subtotals at or over this ship free
BASE = 3.0          # pinned: flat fee per parcel
RATE = 2.0          # pinned: cost per kilogram
WEIGHT = 2.0        # pinned: every row ships the same parcel, kg


def shipping_cost(weight_kg, subtotal):
    """Shipping price for one order. Free at FREE_LIMIT or more."""
    if weight_kg < 0:
        raise ValueError("weight cannot be negative")
    if subtotal >= FREE_LIMIT:
        return 0.0
    return BASE + RATE * weight_kg


subtotals = [10.0, 25.0, 40.0, 49.0, 49.99, 50.0, 50.01, 60.0, 100.0]

print(f"{'subtotal':>9}  {'cost':>5}  free?")
for subtotal in subtotals:
    cost = shipping_cost(WEIGHT, subtotal)
    free = "yes" if cost == 0.0 else "no"
    print(f"{subtotal:9.2f}  {cost:5.2f}  {free}")

# Your task: set cheapest_free to the smallest subtotal above that ships free.
cheapest_free = 10.0   # <- the smallest subtotal with a free row

cost_at_boundary = shipping_cost(WEIGHT, cheapest_free)
print(f"\nboundary check  subtotal={cheapest_free} -> cost={cost_at_boundary:.2f}")
```
