# functions-explore — grade the boundary read off the table, pin the
# scenario, and trap a typed-in answer with the derived boundary cost.

PINNED_SUBTOTALS = [10.0, 25.0, 40.0, 49.0, 49.99, 50.0, 50.01, 60.0, 100.0]

CHECKS = [
    {
        "name": "cheapest_free_reads_the_table",
        "fn": lambda ns: _close(ns["cheapest_free"], 50.0),
        "message": "49.99 still pays 7.00: the first free row sits one step later, right on the limit itself.",
        "hidden": False,
    },
    {
        "name": "scenario_pinned",
        "fn": lambda ns: _close(ns["FREE_LIMIT"], 50.0)
        and _close(ns["BASE"], 3.0)
        and _close(ns["RATE"], 2.0)
        and _close(ns["WEIGHT"], 2.0)
        and ns["subtotals"] == PINNED_SUBTOTALS,
        "message": "FREE_LIMIT, BASE, RATE, WEIGHT, and the subtotals list are the pinned scenario: only cheapest_free is yours to set.",
        "hidden": False,
    },
    {
        # Consistency trap: the starter derives cost_at_boundary from
        # cheapest_free, so a typed answer without a rerun still fails.
        "name": "boundary_reprices_to_free",
        "fn": lambda ns: _close(ns["cost_at_boundary"], 0.0),
        "message": "",
        "hidden": True,
    },
]
