# lists-debug — the seeded bug is the weekday slice stopping at 4; anchor
# the fix on the report's week, then confirm it on a fresh one.

WEEK = [5200, 6100, 4800, 7300, 6600, 9100, 8400]  # the report's Mon..Sun counts

CHECKS = [
    {
        "name": "weekday_total_counts_five_days",
        "fn": lambda ns: ns["weekday_total"](WEEK) == 30000,
        "message": "a slice stops just before its stop index: steps[0:4] holds four days, positions 0 through 3, and Friday lives at position 4.",
        "hidden": False,
    },
    {
        "name": "parts_add_back_to_the_week",
        "fn": lambda ns: ns["weekday_total"](WEEK) + ns["weekend_total"](WEEK) == 47500,
        "message": "weekdays plus weekend must rebuild the whole week, 47500 steps: while the sum falls short, some day sits in neither slice.",
        "hidden": False,
    },
    {
        # Fresh numbers: the fix must be the slice, not a patched constant.
        "name": "fresh_week_still_splits",
        "fn": lambda ns: ns["weekday_total"]([1, 2, 3, 4, 5, 6, 7]) == 15
        and ns["weekend_total"]([1, 2, 3, 4, 5, 6, 7]) == 13,
        "message": "",
        "hidden": True,
    },
]
