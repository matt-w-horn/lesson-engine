---
id: functions-read
title: "A guard, an early return, a price"
type: read_run
predict: "The middle call sends a subtotal of 60 against a free limit of 50. Commit to its printed cost, and to what the last line prints, before you run."
---

:::task
Run the code to price three parcels and make the guard fire. Match each
printed line to the `return` or `raise` that produced it.
:::

:::why Guards first, then the early return
`shipping_cost(weight_kg, subtotal)` runs three tests in order, and the
order does the real work. First the **guard**: a negative weight can never
ship, so the function raises `ValueError` instead of returning a price.

Second the **early return**: subtotals at the free limit of 50.0 or more
ship free, so the function returns 0.0 and nothing below it runs.
Everything else falls through to the last line, the price formula: a 3.0
base fee plus 2.0 per kilogram.

The `try` block passes a weight of -1, and the guard fires.
`except ValueError` catches it, prints the message, and the run keeps
going.
:::

```python starter
FREE_LIMIT = 50.0   # subtotals at or over this ship free
BASE = 3.0          # flat fee per parcel
RATE = 2.0          # cost per kilogram


def shipping_cost(weight_kg, subtotal):
    """Shipping price for one order. Free at FREE_LIMIT or more."""
    if weight_kg < 0:
        raise ValueError("weight cannot be negative")
    if subtotal >= FREE_LIMIT:
        return 0.0
    return BASE + RATE * weight_kg


print(f"2 kg, subtotal 20  -> {shipping_cost(2.0, 20.0):.2f}")
print(f"2 kg, subtotal 60  -> {shipping_cost(2.0, 60.0):.2f}")
print(f"5 kg, subtotal 49  -> {shipping_cost(5.0, 49.0):.2f}")

try:
    shipping_cost(-1.0, 20.0)
except ValueError as error:
    print(f"guard fired: {error}")
```
