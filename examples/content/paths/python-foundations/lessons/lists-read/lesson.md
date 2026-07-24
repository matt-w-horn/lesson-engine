---
id: lists-read
title: "A week of steps, one loop"
type: read_run
predict: "The five weekday counts start at 4200 and end at 7600. Commit to their total, and whether the average clears 6000, before you run."
---

:::task
Run the code to slice the weekdays out of the week and total them with a
loop. Compare the printed total and average with your prediction.
:::

:::why Slices select, loops accumulate
`steps` holds 7 daily counts, Monday first. `steps[0:5]` is a **slice**: it
copies positions 0 through 4, the five weekdays. The start is included, the
stop is not, and the weekend stays out, at positions 5 and 6.

The loop is an **accumulator**. `total` starts at 0, and each pass adds one
count on top, so after five passes it holds the whole weekday sum, 32200.

`len(weekdays)` counts the items, 5 here, so `total / len(weekdays)` is the
average, 6440.0 steps per day. Run the code and match each printed line to
the line of code that produced it.
:::

```python starter
steps = [4200, 7100, 5300, 8000, 7600, 3100, 9400]  # Mon..Sun daily step counts

weekdays = steps[0:5]   # positions 0 through 4: Monday to Friday
weekend = steps[5:7]    # positions 5 and 6: Saturday and Sunday

total = 0
for count in weekdays:
    total = total + count

average = total / len(weekdays)

print(f"weekdays  {weekdays}")
print(f"total     {total} steps")
print(f"average   {average:.0f} steps per day")
```
