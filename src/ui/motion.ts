/** One place to ask "is motion welcome?" — every delight animation gates on
    this so prefers-reduced-motion users get calm, instant states. */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Resolve a CSS custom property to a concrete color. Custom properties keep
    their declared text (our tokens are light-dark() calls), so canvas code
    must read them through a real color property on a live element. */
export function resolveColor(varName: string): string {
  if (typeof document === "undefined") return "#888";
  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.color = `var(${varName})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}
