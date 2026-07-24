# functions-complete — grade the three tiers, the two inclusive
# boundaries, and the untouched guard.

CHECKS = [
    {
        "name": "three_tiers_pay_out",
        "fn": lambda ns: _close(ns["discount_rate"](250.0), 0.10)
        and _close(ns["discount_rate"](75.0), 0.05)
        and _close(ns["discount_rate"](20.0), 0.0),
        "message": "rates are fractions: ten percent is 0.10, and no discount is 0.0, a number the checkout can still multiply by.",
        "hidden": False,
    },
    {
        "name": "boundaries_are_inclusive",
        "fn": lambda ns: _close(ns["discount_rate"](100.0), 0.10)
        and _close(ns["discount_rate"](50.0), 0.05),
        "message": "or more includes the boundary: exactly 100 earns the top rate and exactly 50 earns the middle one.",
        "hidden": False,
    },
    {
        "name": "guard_still_raises",
        "fn": lambda ns: _raises(ns["discount_rate"], -5.0),
        "message": "the guard came filled in: a negative subtotal must still raise ValueError.",
        "hidden": False,
    },
    {
        # Just under each boundary stays in the lower tier.
        "name": "just_under_the_boundaries",
        "fn": lambda ns: _close(ns["discount_rate"](99.99), 0.05)
        and _close(ns["discount_rate"](49.99), 0.0),
        "message": "",
        "hidden": True,
    },
]
