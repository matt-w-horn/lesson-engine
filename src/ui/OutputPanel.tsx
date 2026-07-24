interface Props {
  stdout: string;
  error: { message: string; traceback: string } | null;
  figures: string[];
  /** A run or grade is in flight and nothing has landed yet. */
  waiting?: boolean;
}

export function OutputPanel({ stdout, error, figures, waiting }: Props) {
  // Once the console is on screen it always says something: a wait note
  // while code runs, or an explicit "no output" for a silent script —
  // never a mystery strip of empty panel.
  const empty = !stdout && !error && figures.length === 0;
  return (
    <div class="output-panel">
      <span class="console-label">Console</span>
      {empty && (
        <p class="output-quiet">{waiting ? "Running…" : "No output."}</p>
      )}
      {error && (
        <div class="output-error">
          <div class="output-error-title">{error.message}</div>
          <pre>{error.traceback}</pre>
        </div>
      )}
      {stdout && <pre class="output-stdout">{stdout}</pre>}
      {figures.map((b64, i) => (
        <img
          key={i}
          class="output-figure"
          src={`data:image/png;base64,${b64}`}
          alt={`figure ${i + 1}`}
        />
      ))}
    </div>
  );
}
