#!/usr/bin/env python3
"""Advisory style pass for lesson-engine lessons. Suggestions only: always
exits 0. Usage: python3 qa_check.py <lesson-dir> [<lesson-dir> ...]

Reads lesson.md and grade.py, reports observations against the quality
checklist in lesson-write/references/writing-craft.md. Nothing here blocks
anything; weigh each suggestion with judgment.
"""

import os
import re
import sys

FRONT = re.compile(r"\A---\n(.*?)\n---\n", re.S)
FENCE = re.compile(r"```.*?```", re.S)
INLINE = re.compile(r"`[^`]*`")
MATH = re.compile(r"\$\$.*?\$\$|\$[^$]*\$", re.S)
WORD = re.compile(r"[A-Za-z][A-Za-z'-]+")
MSG = re.compile(r"[\"']message[\"']\s*:\s*([\"'])((?:[^\"'\\]|\\.|(?!\1)[\"'])*?)\1")
TEASER = re.compile(r"next lesson|next unit|in the next|coming up|later in (this|the)|you'?ll (see|meet|learn)", re.I)
ADVERB = re.compile(r"\b(quietly|deeply|fundamentally|remarkably|arguably|profoundly)\b", re.I)
SOFT_TARGETS = {"read_run": 195, "explore": 210, "complete": 195, "debug": 180, "write": 165}
GRADEABLE = ("explore", "complete", "debug", "write")


def field(fm, name):
    m = re.search(rf"^{name}:\s*(.+)$", fm, re.M)
    return m.group(1).strip().strip("\"'") if m else ""


def split_containers(body):
    blocks, name, buf, kept = {"task": "", "why": ""}, None, [], []
    for line in body.split("\n"):
        m = re.match(r"^:::[ \t]*(task|why)\b", line) if name is None else None
        if m:
            name, buf = m.group(1), []
        elif name and line.strip() == ":::":
            blocks[name], name = "\n".join(buf), None
        elif name:
            buf.append(line)
        else:
            kept.append(line)
    return blocks, "\n".join(kept)


def prose_of(text):
    return MATH.sub(" M ", INLINE.sub(" C ", FENCE.sub(" ", text)))


def sentences(text):
    text = re.sub(r"^\s*(?:[-*+]|\d+\.|#+)\s+", ". ", text, flags=re.M)
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text)) if len(s.strip()) > 1]


def check_lesson(d):
    out = []
    say = lambda s: out.append("  suggestion: " + s)
    md_path = os.path.join(d, "lesson.md")
    if not os.path.exists(md_path):
        return ["  (no lesson.md here; skipped)"]
    src = open(md_path, encoding="utf-8").read()
    m = FRONT.match(src)
    fm, body = (m.group(1), src[m.end():]) if m else ("", src)
    ltype, predict = field(fm, "type"), field(fm, "predict")
    blocks, rest = split_containers(body)
    prose = prose_of("\n".join([blocks["task"], blocks["why"], rest]))

    if not blocks["task"].strip():
        say("no :::task block found; the lesson never says what to do at a glance")
    else:
        n = len(WORD.findall(prose_of(blocks["task"])))
        if n > 40:
            say(f"the task runs {n} words; ~40 keeps it readable at a glance")
        if predict and re.search(r"\d", blocks["task"]):
            say("the task contains a digit while a predict prompt asks the learner to commit to a value; check it doesn't give the answer away")
    if not blocks["why"].strip():
        say("no :::why block found; the explanation has nowhere to live")

    tail = FENCE.split(body)[-1]
    if len(WORD.findall(prose_of(tail))) > 15:
        say("prose continues after the starter fence; learners are in the editor by then, so fold it into the :::why block")

    if ltype in ("read_run", "explore") and not predict:
        say(f"{ltype} lessons usually carry a predict: prompt (commit before running is where the learning happens)")

    long_s = [s for s in sentences(prose) if len(WORD.findall(s)) > 28]
    if long_s:
        say(f"{len(long_s)} sentence(s) over 28 words; the first: '{long_s[0][:70]}...'")

    words = len(WORD.findall(prose))
    target = SOFT_TARGETS.get(ltype)
    if target and words > target * 1.4:
        say(f"prose is {words} words against a ~{target} working target for {ltype}; consider cutting whole sentences")

    grader_msgs = ""
    gp = os.path.join(d, "grade.py")
    gsrc = open(gp, encoding="utf-8").read() if os.path.exists(gp) else ""
    if gsrc:
        grader_msgs = " ".join(m[1] for m in MSG.findall(gsrc))
    visible = prose + " " + grader_msgs + " " + predict
    if "—" in visible or "–" in visible:
        say("em/en dashes in learner-visible text; commas, colons, or two sentences read better next to math and code")
    for pat, note in ((TEASER, "forward teaser ('next lesson' framing); the lesson should stand alone"),
                      (ADVERB, "magic adverb (quietly/deeply/fundamentally...); it adds weight without information")):
        hit = pat.search(prose)
        if hit:
            say(f"{note}: '{hit.group(0)}'")
    if re.search(r"\b(we|our)\b", prose, re.I):
        say("we/our voice; lessons address 'you'")

    if gsrc:
        code_only = re.sub(r"#[^\n]*", "", gsrc)  # comments may cite the trap
        if re.search(r"\bis\s+(True|False)\b", code_only):
            say("grade.py compares with 'is True'/'is False'; numpy comparisons return numpy.bool_, so wrap in bool() instead")
        empty = re.search(r"CHECKS\s*(?::[^=]*)?=\s*\[\s*\]", gsrc)
        if ltype in GRADEABLE and empty and "grading" not in fm:
            say("gradeable lesson with an empty CHECKS list and no AI grading: Submit will pass any code that runs; give it real checks")
        if ltype == "read_run" and not empty and "CHECKS" in gsrc:
            say("read_run lessons complete on a clean Run; CHECKS = [] is the usual grader")
        for _, msg in MSG.findall(gsrc):
            if msg and len(WORD.findall(msg)) < 4:
                say(f"check message '{msg}' coaches nothing; hint at the misconception or the rule instead")
    elif ltype in GRADEABLE:
        say("no grade.py found for a gradeable lesson type")
    return out


def main(dirs):
    if not dirs:
        print(__doc__)
        return 0
    total = 0
    for d in dirs:
        found = check_lesson(d.rstrip("/"))
        print(f"\n{os.path.basename(d.rstrip('/')) or d}")
        print("\n".join(found) if found else "  nothing to suggest; nice.")
        total += len(found)
    print(f"\n{total} suggestion(s) across {len(dirs)} lesson(s). These are observations, not failures; keep what helps.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
