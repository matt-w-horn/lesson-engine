import { createContext, Fragment } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { prefersReducedMotion } from "./motion";
import type { EngineConfig, Manifest } from "../schemas";
import { findCourse, findUnit, type HierarchyIndex } from "../content";
import { href, route, type Route } from "../router";
import { progress, progressKey, totalEp } from "../progress";
import { theme, cycleTheme, THEME_LABEL, type Theme } from "./theme";
import { HomePage } from "./HomePage";
import { PathPage } from "./PathPage";
import { CoursePage } from "./CoursePage";
import { UnitPage } from "./UnitPage";
import { LessonPage } from "./LessonPage";

/** One path on the shelf: its manifest plus the derived hierarchy index. */
export interface LoadedPath {
  id: string;
  manifest: Manifest;
  index: HierarchyIndex;
}

export interface AppCtx {
  config: EngineConfig;
  paths: LoadedPath[];
}

const Ctx = createContext<AppCtx | null>(null);

interface Crumb {
  label: string;
  href?: string; // absent = the page we're on
}

/** The breadcrumb trail for the toolbar. The current page's own title stays
    in the page (lesson pages) or is the trail's last, unlinked entry. */
function crumbsFor(r: Route, paths: LoadedPath[]): Crumb[] {
  if (r.page === "home") return [];
  const p = paths.find((x) => x.id === r.pathId);
  if (!p) return [];
  const m = p.manifest;
  const pathCrumb: Crumb = { label: m.path.title, href: href.path(r.pathId) };
  if (r.page === "path") return [{ label: m.path.title }];
  if (r.page === "course") {
    const c = findCourse(m, r.courseId);
    return [pathCrumb, { label: c?.title ?? r.courseId }];
  }
  if (r.page === "unit") {
    const c = findCourse(m, r.courseId);
    const u = findUnit(m, r.courseId, r.unitId);
    return [
      pathCrumb,
      { label: c?.title ?? r.courseId, href: href.course(r.pathId, r.courseId) },
      { label: u?.title ?? r.unitId },
    ];
  }
  const ref = p.index.byLesson.get(r.lessonId);
  if (!ref) return [pathCrumb];
  const c = findCourse(m, ref.courseId);
  const u = findUnit(m, ref.courseId, ref.unitId);
  return [
    pathCrumb,
    {
      label: c?.title ?? ref.courseId,
      href: href.course(r.pathId, ref.courseId),
    },
    {
      label: u?.title ?? ref.unitId,
      href: href.unit(r.pathId, ref.courseId, ref.unitId),
    },
  ];
}

/** The lessons of the unit the learner is currently in, for the toolbar's
    edge bar. The bar fills by how many are PASSED, never by which one is
    open, so it can't announce completion of an incomplete unit. */
function unitRunwayFor(
  r: Route,
  paths: LoadedPath[],
): { pathId: string; lessons: string[] } | null {
  if (r.page !== "lesson") return null;
  const p = paths.find((x) => x.id === r.pathId);
  const ref = p?.index.byLesson.get(r.lessonId);
  if (!p || !ref) return null;
  const unit = findUnit(p.manifest, ref.courseId, ref.unitId);
  return unit && unit.lessons.includes(r.lessonId)
    ? { pathId: r.pathId, lessons: unit.lessons }
    : null;
}

/** The EP total, counting up old→new over ~400ms instead of jumping, with a
    small bump of the pill. Reduced motion (or a decrease, e.g. progress
    hygiene) just shows the new number. */
function EpBadge({ ep }: { ep: number }) {
  const [shown, setShown] = useState(ep);
  const [bump, setBump] = useState(false);
  const prev = useRef(ep);
  useEffect(() => {
    const from = prev.current;
    prev.current = ep;
    if (ep === from) return;
    if (ep < from || prefersReducedMotion()) {
      setShown(ep);
      return;
    }
    setBump(true);
    const t0 = performance.now();
    const duration = 400;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - (1 - k) ** 3; // ease-out
      setShown(Math.round(from + (ep - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ep]);
  return (
    <span
      class={`ep-badge${bump ? " bump" : ""}`}
      title="experience points"
      onAnimationEnd={() => setBump(false)}
    >
      {shown} EP
    </span>
  );
}

/** Sun / moon / half-disc for the three theme modes. Decorative. */
function ThemeIcon({ mode }: { mode: Theme }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {mode === "light" && (
        <>
          <circle cx="12" cy="12" r="4.4" fill="currentColor" />
          <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" />
            <path d="M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
          </g>
        </>
      )}
      {mode === "dark" && (
        <path
          d="M20.2 13.6A8.4 8.4 0 1 1 10.4 3.8a6.6 6.6 0 0 0 9.8 9.8z"
          fill="currentColor"
        />
      )}
      {mode === "auto" && (
        <>
          <circle
            cx="12"
            cy="12"
            r="8.2"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AppCtx missing");
  return ctx;
}

/** The route's path, or undefined for unknown ids (pages render a fallback). */
export function usePath(pathId: string): LoadedPath | undefined {
  return useApp().paths.find((p) => p.id === pathId);
}

export function App(props: AppCtx) {
  const r = route.value;
  const crumbs = crumbsFor(r, props.paths);
  const runway = unitRunwayFor(r, props.paths);
  const state = progress.value;
  const passedInUnit = runway
    ? runway.lessons.filter(
        (id) => state.lessons[progressKey(runway.pathId, id)]?.completedAt,
      ).length
    : 0;
  const ep = totalEp(
    props.paths.map((p) => p.manifest),
    progress.value,
    props.config.ep_per_lesson,
  );
  return (
    <Ctx.Provider value={props}>
      <header class="topbar">
        {/* Inside the sticky toolbar (not position:fixed) so it shares the
            toolbar's layer and moves with it during rubber-band overscroll. */}
        {runway && (
          <div
            class="unit-position"
            role="progressbar"
            aria-label="Lessons passed in unit"
            aria-valuemin={0}
            aria-valuemax={runway.lessons.length}
            aria-valuenow={passedInUnit}
          >
            {/* One continuous lit strip, not a row of lamps: width is the
                share of the unit's lessons already passed. */}
            <div
              class="unit-position-fill"
              style={{
                width: `${(passedInUnit / runway.lessons.length) * 100}%`,
              }}
            />
          </div>
        )}
        <a href="#/" class="brand">
          {props.config.app_title}
        </a>
        {crumbs.length > 0 && (
          <nav class="topbar-crumbs" aria-label="Breadcrumbs">
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                <span class="crumb-sep" aria-hidden="true">
                  ›
                </span>
                {c.href ? (
                  <a class="crumb" href={c.href} title={c.label}>
                    {c.label}
                  </a>
                ) : (
                  <span class="crumb" aria-current="page" title={c.label}>
                    {c.label}
                  </span>
                )}
              </Fragment>
            ))}
          </nav>
        )}
        <div class="topbar-side">
          <EpBadge ep={ep} />
          <button
            class="theme-toggle"
            onClick={cycleTheme}
            title={`${THEME_LABEL[theme.value]} (click to change)`}
            aria-label={THEME_LABEL[theme.value]}
          >
            <ThemeIcon mode={theme.value} />
          </button>
        </div>
      </header>
      <main class="page">
        {r.page === "home" && <HomePage />}
        {r.page === "path" && <PathPage pathId={r.pathId} />}
        {r.page === "course" && (
          <CoursePage pathId={r.pathId} courseId={r.courseId} />
        )}
        {r.page === "unit" && (
          <UnitPage pathId={r.pathId} courseId={r.courseId} unitId={r.unitId} />
        )}
        {r.page === "lesson" && (
          <LessonPage
            key={`${r.pathId}/${r.lessonId}`}
            pathId={r.pathId}
            lessonId={r.lessonId}
          />
        )}
      </main>
    </Ctx.Provider>
  );
}
