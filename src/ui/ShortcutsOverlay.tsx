// The "?" cheat sheet. Rows come from keys.ts, so a chord that changes there
// changes here without anyone remembering to update a second list.
import { useEffect } from "preact/hooks";
import { chordLabel, SHORTCUT_ROWS } from "./keys";

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div class="overlay-backdrop" onClick={onClose}>
      <div
        class="shortcuts"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Keyboard shortcuts</h2>
        <dl class="shortcut-list">
          {SHORTCUT_ROWS.map(({ id, what }) => (
            <div key={id} class="shortcut-row">
              <dt>{what}</dt>
              <dd>
                <kbd class="btn-kbd">{chordLabel(id)}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p class="shortcut-foot muted">
          Run, Submit, and Format also work while the cursor is in the editor.
        </p>
        <button class="btn btn-quiet" onClick={onClose} autofocus>
          Close
        </button>
      </div>
    </div>
  );
}
