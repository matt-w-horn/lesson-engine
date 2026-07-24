# functions-write — cover the four spec calls, then fresh orders and the
# negative count, so a hardcoded share still fails.


def _share(ns, total, people):
    return ns["split_bill"](total, people)


def _returns_one_number(ns):
    result = _share(ns, 60.0, 4)
    # bool is excluded: True is not a price, even though Python counts it as an int.
    return isinstance(result, (int, float)) and not isinstance(result, bool)


CHECKS = [
    {
        "name": "returns_one_number",
        "fn": _returns_one_number,
        "message": "split_bill(60.0, 4) must return a single number: one person's share of the order.",
        "hidden": False,
    },
    {
        "name": "even_split",
        "fn": lambda ns: _close(_share(ns, 60.0, 4), 15.0),
        "message": "the share is total / people: 60.00 across 4 people is 15.0 each.",
        "hidden": False,
    },
    {
        "name": "rounding_to_cents",
        "fn": lambda ns: _close(_share(ns, 10.0, 3), 3.33),
        "message": "10.00 across 3 people is 3.3333 and counting: round(share, 2) trims it to a price a receipt can print, 3.33.",
        "hidden": False,
    },
    {
        "name": "zero_people_raises",
        "fn": lambda ns: _raises(ns["split_bill"], 60.0, 0),
        "message": "a people count of 0 must raise ValueError before any division runs: guard first, then math.",
        "hidden": False,
    },
    {
        # The spec guards everything under 1, negative counts included.
        "name": "negative_people_raise_too",
        "fn": lambda ns: _raises(ns["split_bill"], 45.0, -2),
        "message": "",
        "hidden": True,
    },
    {
        # Fresh orders: 16.67 forces real rounding, 2.5 and 0.0 stay exact.
        "name": "fresh_orders",
        "fn": lambda ns: _close(_share(ns, 100.0, 6), 16.67)
        and _close(_share(ns, 7.5, 3), 2.5)
        and _close(_share(ns, 0.0, 3), 0.0),
        "message": "",
        "hidden": True,
    },
]
