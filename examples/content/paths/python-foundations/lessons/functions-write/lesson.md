---
id: functions-write
title: "split_bill, from spec"
type: write
entry_point: split_bill
---

:::task
Write `split_bill(total, people)`: each person's equal share of an order,
rounded to two decimal places. Guard first: a people count under one raises
`ValueError`, never a price.
:::

:::why The spec, and the calls that pin it
`split_bill(total, people)` takes one order and how many people share it,
and returns one share, a number.

- `total`: the order price, zero or more
- `people`: how many split it, a whole number
- returns `total / people`, rounded to 2 decimal places with `round`

Four calls pin the spec. `split_bill(60.0, 4)` returns 15.0.
`split_bill(10.0, 3)` returns 3.33, the rounding at work.
`split_bill(0.0, 3)` returns 0.0, an empty order split among three people.
And `split_bill(60.0, 0)` raises `ValueError`: the guard turns a confusing
crash into a clear message before any division runs. A negative count
earns the same, so guard everything under 1.
:::

```python starter
def split_bill(total, people):
    """One person's equal share of an order, rounded to two decimal places."""
    ...


print(f"60.00 among 4 people  -> {split_bill(60.0, 4)}   (expect 15.0)")
print(f"10.00 among 3 people  -> {split_bill(10.0, 3)}   (expect 3.33)")

try:
    split_bill(60.0, 0)
except ValueError as error:
    print(f"guard fired: {error}")
```
