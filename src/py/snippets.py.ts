// All Python source the engine ever injects into Pyodide lives here —
// the one place that sets up the in-browser Python runtime.

/** Runs once per worker, before anything else (and before any matplotlib import). */
export const PY_INIT = `
import os
os.environ["MPLBACKEND"] = "AGG"
`;

/**
 * Helper functions exec'd into a private namespace at init.
 * They are looked up by name and called from the worker.
 */
export const PY_HELPERS = `
import json

def _close(a, b, tol=1e-9):
    """Shared numeric-tolerance helper, injected into every grade.py namespace."""
    return abs(a - b) < tol

def _raises(fn, *args, exc=ValueError):
    """Shared assert-raises helper, injected into every grade.py namespace."""
    try:
        fn(*args)
    except exc:
        return True
    except Exception:
        return False
    return False

def _flush_streams():
    """Push any partial line out of the buffered writers.

    print(..., end="") leaves text with no trailing newline sitting in the
    batched stdout buffer. Unflushed, it is lost from the run that produced
    it and then prepended to the NEXT run's output.
    """
    import sys
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.flush()
        except Exception:
            pass


def _format_code(code):
    """Run black over the learner's source. black is imported lazily: it is
    micropip-installed on the first format only, so a learner who never
    formats never pays for it. Returns JSON so a syntax error (the normal
    failure) crosses back as data, not an exception."""
    import json
    import black
    try:
        formatted = black.format_str(code, mode=black.Mode())
        return json.dumps({"ok": True, "formatted": formatted})
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e)})


def _discard_figures():
    import sys
    if "matplotlib" not in sys.modules:
        return
    import matplotlib.pyplot as plt
    plt.close("all")

def _capture_figures():
    import sys
    if "matplotlib" not in sys.modules:
        return "[]"
    import base64, io
    import matplotlib.pyplot as plt
    figs = []
    for num in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(num).savefig(buf, format="png", dpi=110, bbox_inches="tight")
        figs.append(base64.b64encode(buf.getvalue()).decode())
    plt.close("all")
    return json.dumps(figs)

def _load_checks(grade_code):
    # Seed the shared authoring helpers so grade.py files don't re-define them.
    grader_ns = {"__name__": "__grader__", "_close": _close, "_raises": _raises}
    exec(grade_code, grader_ns)
    checks = grader_ns.get("CHECKS")
    if not isinstance(checks, list):
        raise ValueError("grade.py must define a CHECKS list")
    return checks

def _describe_checks(grade_code):
    out = []
    for c in _load_checks(grade_code):
        out.append({
            "name": str(c.get("name", "check")),
            "message": str(c.get("message", "")),
            "hidden": bool(c.get("hidden", False)),
        })
    return json.dumps(out)

def _run_checks(grade_code, learner_ns):
    results = []
    for c in _load_checks(grade_code):
        try:
            passed = bool(c["fn"](learner_ns))
        except Exception:
            passed = False
        results.append({
            "name": str(c.get("name", "check")),
            "passed": passed,
            "message": str(c.get("message", "")),
            "hidden": bool(c.get("hidden", False)),
        })
    return json.dumps(results)
`;
