// One source of truth for keyboard chords. The labels printed on buttons, the
// aria-keyshortcuts announced to assistive tech, the rows in the "?" overlay,
// and the matching done by the page-level listener all read from CHORDS, so
// the editor keymap and the page handler cannot drift apart.

export type ChordId = "run" | "submit" | "format" | "prev" | "next" | "help";

interface ChordSpec {
  /** CodeMirror binding, or null for chords that are page-level only. */
  cm: string | null;
  /** Printed label: mac uses glyphs, everything else spells the keys. */
  mac: string;
  other: string;
  /** aria-keyshortcuts names the physical keys, not the glyphs. */
  ariaMac: string;
  ariaOther: string;
  /** Sentence for the overlay and the title tooltip. */
  what: string;
}

const CHORDS: Record<ChordId, ChordSpec> = {
  run: {
    cm: "Mod-Enter",
    mac: "⌘↩",
    other: "Ctrl+↩",
    ariaMac: "Meta+Enter",
    ariaOther: "Control+Enter",
    what: "Run the code",
  },
  submit: {
    cm: "Mod-Shift-Enter",
    mac: "⌘⇧↩",
    other: "Ctrl+Shift+↩",
    ariaMac: "Meta+Shift+Enter",
    ariaOther: "Control+Shift+Enter",
    what: "Submit for grading",
  },
  format: {
    cm: "Shift-Alt-f",
    mac: "⇧⌥F",
    other: "Shift+Alt+F",
    ariaMac: "Shift+Alt+F",
    ariaOther: "Shift+Alt+F",
    what: "Format the code",
  },
  prev: {
    // Page-level only: inside CodeMirror, Alt+Arrow is word motion on mac and
    // taking it would break editing to add navigation.
    cm: null,
    mac: "⌥←",
    other: "Alt+←",
    ariaMac: "Alt+ArrowLeft",
    ariaOther: "Alt+ArrowLeft",
    what: "Previous lesson",
  },
  next: {
    cm: null,
    mac: "⌥→",
    other: "Alt+→",
    ariaMac: "Alt+ArrowRight",
    ariaOther: "Alt+ArrowRight",
    what: "Next lesson",
  },
  help: {
    cm: null,
    mac: "?",
    other: "?",
    ariaMac: "?",
    ariaOther: "?",
    what: "Show keyboard shortcuts",
  },
};

/** Platform sniff, injectable so the pure helpers stay testable off-DOM. */
export function detectMac(nav: unknown = globalThis.navigator): boolean {
  const n = nav as
    | { platform?: string; userAgentData?: { platform?: string } }
    | undefined;
  if (!n) return false;
  const modern = n.userAgentData?.platform;
  if (typeof modern === "string" && modern !== "") return modern === "macOS";
  return /Mac/i.test(n.platform ?? "");
}

export const isMac = detectMac();

/** The glyph string printed in a <kbd> on a button. */
export function chordLabel(id: ChordId, mac: boolean = isMac): string {
  const c = CHORDS[id];
  return mac ? c.mac : c.other;
}

/** The aria-keyshortcuts value: real key names, never glyphs. */
export function chordAria(id: ChordId, mac: boolean = isMac): string {
  const c = CHORDS[id];
  return mac ? c.ariaMac : c.ariaOther;
}

/** Tooltip text: what it does plus how to press it. */
export function chordHint(id: ChordId, mac: boolean = isMac): string {
  return `${CHORDS[id].what} (${chordLabel(id, mac)})`;
}

export function chordBinding(id: ChordId): string | null {
  return CHORDS[id].cm;
}

/** Rows for the "?" overlay, in the order a learner meets them. */
export const SHORTCUT_ROWS: { id: ChordId; what: string }[] = (
  ["run", "submit", "format", "prev", "next", "help"] as ChordId[]
).map((id) => ({ id, what: CHORDS[id].what }));

function hasMod(e: KeyboardEvent, mac: boolean): boolean {
  // Require the platform's modifier AND the absence of the other one, so
  // Ctrl+Enter on a mac (a different OS-level chord) never reads as Run.
  return mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

/**
 * Which chord this event is, if any. Used by the page-level listener; the
 * editor gets the same chords through its own CodeMirror keymap.
 */
export function matchChord(e: KeyboardEvent, mac: boolean = isMac): ChordId | null {
  const mod = hasMod(e, mac);
  if (e.key === "Enter" && mod && !e.altKey) {
    return e.shiftKey ? "submit" : "run";
  }
  // e.key is unreliable for Alt combos (mac maps Alt+F to a dead key), so the
  // physical code is what identifies the letter.
  if (e.code === "KeyF" && e.shiftKey && e.altKey && !mod) return "format";
  if (e.altKey && !mod && !e.shiftKey) {
    if (e.key === "ArrowLeft") return "prev";
    if (e.key === "ArrowRight") return "next";
  }
  if (e.key === "?" && !mod && !e.altKey) return "help";
  return null;
}

/** True when the event came from inside the code editor. */
export function inEditor(target: EventTarget | null): boolean {
  return Boolean(
    target &&
      typeof (target as Element).closest === "function" &&
      (target as Element).closest(".cm-editor"),
  );
}

/** True for a text field that owns its own keys (the "?" overlay must not steal). */
export function inTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable === true;
}
