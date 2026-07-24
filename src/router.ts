// Hand-rolled hash router. Every content route is path-scoped:
// #/ | #/path/:pid | #/course/:pid/:cid | #/unit/:pid/:cid/:uid | #/lesson/:pid/:lid
import { signal } from "@preact/signals";

export type Route =
  | { page: "home" }
  | { page: "path"; pathId: string }
  | { page: "course"; pathId: string; courseId: string }
  | { page: "unit"; pathId: string; courseId: string; unitId: string }
  | { page: "lesson"; pathId: string; lessonId: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "path" && parts[1]) return { page: "path", pathId: parts[1] };
  if (parts[0] === "course" && parts[1] && parts[2])
    return { page: "course", pathId: parts[1], courseId: parts[2] };
  if (parts[0] === "unit" && parts[1] && parts[2] && parts[3])
    return {
      page: "unit",
      pathId: parts[1],
      courseId: parts[2],
      unitId: parts[3],
    };
  if (parts[0] === "lesson" && parts[1] && parts[2])
    return { page: "lesson", pathId: parts[1], lessonId: parts[2] };
  return { page: "home" };
}

export const route = signal<Route>(
  typeof location !== "undefined" ? parseHash(location.hash) : { page: "home" },
);

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    route.value = parseHash(location.hash);
    window.scrollTo(0, 0);
  });
}

export const href = {
  home: () => "#/",
  path: (pathId: string) => `#/path/${pathId}`,
  course: (pathId: string, courseId: string) => `#/course/${pathId}/${courseId}`,
  unit: (pathId: string, courseId: string, unitId: string) =>
    `#/unit/${pathId}/${courseId}/${unitId}`,
  lesson: (pathId: string, lessonId: string) => `#/lesson/${pathId}/${lessonId}`,
};
