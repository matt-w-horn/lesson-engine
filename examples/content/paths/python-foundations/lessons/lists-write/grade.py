# lists-write — cover the three spec calls, then fresh numbers and the
# last-window edge, so a hardcoded or short-stopping loop still fails.

WEEK = [4200, 7100, 5300, 8000, 7600, 3100, 9400]


def _returns_one_number(ns):
    result = ns["best_window"]([10, 20, 30], 2)
    # bool is excluded: True is not a step total, even though Python counts it as an int.
    return isinstance(result, (int, float)) and not isinstance(result, bool)


CHECKS = [
    {
        "name": "returns_one_number",
        "fn": _returns_one_number,
        "message": "best_window must return a single number: the largest window total.",
        "hidden": False,
    },
    {
        "name": "pinned_week_best_of_three",
        "fn": lambda ns: _close(ns["best_window"](WEEK, 3), 20900),
        "message": "slice each window with steps[start:start + size], total it, and keep the largest: the pinned week's best three days total 20900.",
        "hidden": False,
    },
    {
        "name": "single_day_windows",
        "fn": lambda ns: _close(ns["best_window"](WEEK, 1), 9400),
        "message": "with size 1 every window is one count, so the best window is the biggest single day, 9400.",
        "hidden": False,
    },
    {
        "name": "whole_list_window",
        "fn": lambda ns: _close(ns["best_window"](WEEK, 7), 44700),
        "message": "with size equal to the list length exactly one window fits, the whole week: expect 44700.",
        "hidden": False,
    },
    {
        # Fresh numbers: windows are 4, 5, 5, 6.
        "name": "fresh_numbers",
        "fn": lambda ns: _close(ns["best_window"]([3, 1, 4, 1, 5], 2), 6),
        "message": "",
        "hidden": True,
    },
    {
        # The winning window is the last one: a loop that stops one start
        # short misses it.
        "name": "last_window_counts",
        "fn": lambda ns: _close(ns["best_window"]([1, 1, 1, 9], 2), 10),
        "message": "",
        "hidden": True,
    },
]
