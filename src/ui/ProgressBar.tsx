import { useEffect, useRef, useState } from "preact/hooks";

/** The rollup bar. When its value goes up while mounted, the fill flares
    its glow once; the animation lives in a reduced-motion-gated CSS block,
    so users who opt out just see the width change. */
export function ProgressBar({ percent }: { percent: number }) {
  const prev = useRef(percent);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (percent > prev.current) setPulse(true);
    prev.current = percent;
  }, [percent]);
  return (
    <div class="progress-bar" role="progressbar" aria-valuenow={percent}>
      <div
        class={`progress-fill${pulse ? " pulse" : ""}`}
        style={{ width: `${percent}%` }}
        onAnimationEnd={() => setPulse(false)}
      />
    </div>
  );
}
