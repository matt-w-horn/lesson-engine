---
id: functions-debug
title: "Charged at the limit"
type: debug
---

:::task
Run the code as shipped: the row at the free limit still charges. Fix the
comparison in `shipping_cost` until that row prices at `0.00`, and leave
the guard alone.
:::

:::why The promise includes the limit
The shop promises: subtotals of 50 or more ship free. A customer with a
cart at exactly 50.00 got charged 7.00 for a 2 kilogram parcel, and the
sweep reproduces the complaint: the row at 50.00 prints 7.00 and 50.01
prints 0.00.

Everything below the limit pays full price and everything over it ships
free, so the defect touches one point only: the limit itself. A comparison
comes in a strict form and an inclusive form, and the promise picks which
one belongs on the free line. One character decides it, and the boundary
lands on the wrong side.

The guard and the price formula both work as shipped. Leave them alone.
:::

```python starter
FREE_LIMIT = 50.0   # subtotals at or over this ship free
BASE = 3.0          # flat fee per parcel
RATE = 2.0          # cost per kilogram


def shipping_cost(weight_kg, subtotal):
    """Shipping price for one order. Free at FREE_LIMIT or more."""
    if weight_kg < 0:
        raise ValueError("weight cannot be negative")
    if subtotal > FREE_LIMIT:
        return 0.0
    return BASE + RATE * weight_kg


for subtotal in [49.0, 50.0, 50.01, 60.0]:
    print(f"subtotal {subtotal:6.2f} -> cost {shipping_cost(2.0, subtotal):.2f}")
```
