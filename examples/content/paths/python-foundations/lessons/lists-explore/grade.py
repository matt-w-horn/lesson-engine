# lists-explore — grade the start index read off the table, pin the
# scenario, and trap a typed-in answer with the derived best_total.

CHECKS = [
    {
        "name": "best_start_reads_the_table",
        "fn": lambda ns: ns["best_start"] == 2,
        "message": "read down the total column: 20900 beats 20400 and 20100, and its window opens on the 5300 count.",
        "hidden": False,
    },
    {
        "name": "scenario_pinned",
        "fn": lambda ns: ns["steps"] == [4200, 7100, 5300, 8000, 7600, 3100, 9400]
        and ns["SIZE"] == 3,
        "message": "steps and SIZE are the pinned scenario, not knobs: only best_start is yours to set.",
        "hidden": False,
    },
    {
        # Consistency trap: the starter derives best_window and best_total
        # from best_start, so typing the index without rerunning still fails.
        "name": "derived_window_consistent",
        "fn": lambda ns: ns["best_window"] == [5300, 8000, 7600]
        and ns["best_total"] == 20900,
        "message": "",
        "hidden": True,
    },
]
