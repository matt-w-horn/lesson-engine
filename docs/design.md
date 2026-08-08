# Design system

Settled 2026-07-23. This file is the decision record; the rules that bite in
engine code are summarized where the code work happens.

## Palette

Light mode is warm paper with a warm sienna interactive accent, green only
where semantic (progress and pass). Dark mode is cool blue-grey slate with
teal/green accents and a gold EP pill; a warm-espresso dark draft was
rejected. Tokens use `light-dark()` with an auto/light/dark toggle.

## Lighting and depth

Lighting is implied, never drawn: no spotlights, sconces, or beam fixtures
(tried twice, rejected twice). Depth comes from top-lit surfaces, a rim
highlight in panel shadows, a faint page-top wash, and small embedded
hardware lights where they mean something: the 2px unit bar in the sticky
toolbar is a runway of recessed per-lesson dots that light as you pass them
(it replaced the ladder-chip strip), and enabled primary buttons carry a
backlit inner edge.

## Chrome and behaviour

Never `position: fixed` for chrome; it detaches during rubber-band scroll,
so chrome lives in the sticky toolbar. Breadcrumbs sit in the toolbar; the
console stays hidden until the first Run/Submit; auto-advance fires ~1.5 s
after the completing submission and is cancelled by any input; confetti, the
EP tick, and the check-draw are all gated on `prefers-reduced-motion`.
