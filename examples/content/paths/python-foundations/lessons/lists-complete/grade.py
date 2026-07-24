# lists-complete — grade both gaps on the pinned week, then on fresh
# numbers so hardcoding the printed answers still fails.

WEEK = [4200, 7100, 5300, 8000, 7600, 3100, 9400]

CHECKS = [
    {
        "name": "window_is_one_slice",
        "fn": lambda ns: ns["window"](WEEK, 1, 3) == [7100, 5300, 8000],
        "message": "window is the slice steps[start:start + size]: start 1 with size 3 picks the counts at positions 1, 2, and 3.",
        "hidden": False,
    },
    {
        "name": "average_divides_by_the_days",
        "fn": lambda ns: _close(ns["window_average"](WEEK, 1, 3), 6800.0),
        "message": "the average is the window total over how many counts it holds: 20400 over 3 days is 6800.0.",
        "hidden": False,
    },
    {
        "name": "weekend_average",
        "fn": lambda ns: _close(ns["window_average"](WEEK, 5, 2), 6250.0),
        "message": "start 5 with size 2 is the weekend: 12500 steps over 2 days is 6250.0.",
        "hidden": False,
    },
    {
        # Fresh numbers: both gaps must compute from their arguments.
        "name": "fresh_numbers",
        "fn": lambda ns: ns["window"]([10, 20, 30, 40], 1, 2) == [20, 30]
        and _close(ns["window_average"]([10, 20, 30, 40], 1, 2), 25.0),
        "message": "",
        "hidden": True,
    },
    {
        # A one-day window averages to itself.
        "name": "single_day_window",
        "fn": lambda ns: _close(ns["window_average"]([8000], 0, 1), 8000.0),
        "message": "",
        "hidden": True,
    },
]
