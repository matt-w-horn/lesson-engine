import { describe, expect, it } from "vitest";
import {
  chordAria,
  chordHint,
  chordLabel,
  detectMac,
  matchChord,
  SHORTCUT_ROWS,
} from "../src/ui/keys";

// The helpers are pure and take the platform explicitly, so no DOM is needed.
const key = (init: Partial<KeyboardEvent>): KeyboardEvent =>
  ({
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  }) as KeyboardEvent;

describe("platform detection", () => {
  it("prefers userAgentData when it is populated", () => {
    expect(detectMac({ userAgentData: { platform: "macOS" } })).toBe(true);
    expect(detectMac({ userAgentData: { platform: "Windows" } })).toBe(false);
  });

  it("falls back to platform, and to false with no navigator", () => {
    expect(detectMac({ platform: "MacIntel" })).toBe(true);
    expect(detectMac({ platform: "Linux x86_64" })).toBe(false);
    expect(detectMac({ userAgentData: { platform: "" }, platform: "MacIntel" })).toBe(true);
    // `null`, not `undefined`: undefined would fall through to the default
    // parameter and read the real navigator, which Node itself now provides.
    expect(detectMac(null)).toBe(false);
  });
});

describe("chord labels", () => {
  it("renders mac glyphs and spelled-out keys per platform", () => {
    expect(chordLabel("run", true)).toBe("⌘↩");
    expect(chordLabel("run", false)).toBe("Ctrl+↩");
    expect(chordLabel("submit", true)).toBe("⌘⇧↩");
    expect(chordLabel("submit", false)).toBe("Ctrl+Shift+↩");
  });

  it("names real keys for aria, never glyphs", () => {
    expect(chordAria("run", true)).toBe("Meta+Enter");
    expect(chordAria("run", false)).toBe("Control+Enter");
    for (const { id } of SHORTCUT_ROWS) {
      for (const mac of [true, false]) {
        expect(chordAria(id, mac)).not.toMatch(/[⌘⇧⌥↩←→]/);
      }
    }
  });

  it("builds a tooltip from the action and the chord", () => {
    expect(chordHint("run", true)).toBe("Run the code (⌘↩)");
  });

  it("lists every chord in the overlay rows", () => {
    expect(SHORTCUT_ROWS.map((r) => r.id)).toEqual([
      "run",
      "submit",
      "format",
      "prev",
      "next",
      "help",
    ]);
  });
});

describe("matchChord", () => {
  it("reads run and submit off the platform modifier", () => {
    expect(matchChord(key({ key: "Enter", metaKey: true }), true)).toBe("run");
    expect(matchChord(key({ key: "Enter", ctrlKey: true }), false)).toBe("run");
    expect(
      matchChord(key({ key: "Enter", metaKey: true, shiftKey: true }), true),
    ).toBe("submit");
  });

  it("ignores the wrong platform's modifier", () => {
    // Ctrl+Enter on a mac is an OS chord, not ours.
    expect(matchChord(key({ key: "Enter", ctrlKey: true }), true)).toBe(null);
    expect(matchChord(key({ key: "Enter", metaKey: true }), false)).toBe(null);
    expect(matchChord(key({ key: "Enter" }), true)).toBe(null);
  });

  it("identifies format by physical code, since Alt+F is a dead key on mac", () => {
    expect(
      matchChord(key({ key: "ƒ", code: "KeyF", shiftKey: true, altKey: true }), true),
    ).toBe("format");
  });

  it("matches lesson navigation only on a bare Alt+Arrow", () => {
    expect(matchChord(key({ key: "ArrowLeft", altKey: true }), true)).toBe("prev");
    expect(matchChord(key({ key: "ArrowRight", altKey: true }), true)).toBe("next");
    expect(
      matchChord(key({ key: "ArrowRight", altKey: true, shiftKey: true }), true),
    ).toBe(null);
    expect(matchChord(key({ key: "ArrowRight" }), true)).toBe(null);
  });

  it("matches the help key and nothing else", () => {
    expect(matchChord(key({ key: "?" }), true)).toBe("help");
    expect(matchChord(key({ key: "?", metaKey: true }), true)).toBe(null);
    expect(matchChord(key({ key: "a" }), true)).toBe(null);
  });
});
