# functions-debug — the seeded bug is a strict comparison on the free
# limit; anchor both sides of the boundary and keep the guard honest.

CHECKS = [
    {
        "name": "free_at_the_limit_exactly",
        "fn": lambda ns: _close(ns["shipping_cost"](2.0, 50.0), 0.0),
        "message": "the promise includes the limit itself, 50 or more: the strict comparison leaves the 50.00 cart out by exactly one boundary case.",
        "hidden": False,
    },
    {
        "name": "under_the_limit_still_pays",
        "fn": lambda ns: _close(ns["shipping_cost"](2.0, 49.0), 7.0),
        "message": "under the limit the formula still applies: a 3.0 base plus 2.0 per kilogram prices this parcel at 7.00. The fix touches the comparison only.",
        "hidden": False,
    },
    {
        "name": "guard_still_raises",
        "fn": lambda ns: _raises(ns["shipping_cost"], -1.0, 80.0),
        "message": "the guard is not the defect: a negative weight must still raise ValueError after the fix.",
        "hidden": False,
    },
    {
        # Fresh parcels on both sides of the boundary.
        "name": "fresh_parcels",
        "fn": lambda ns: _close(ns["shipping_cost"](4.0, 10.0), 11.0)
        and _close(ns["shipping_cost"](0.5, 200.0), 0.0),
        "message": "",
        "hidden": True,
    },
]
