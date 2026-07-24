import { render } from "preact";
import "katex/dist/katex.min.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/400-italic.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles/tokens.css";
import "./styles/app.css";
import { App, type LoadedPath } from "./ui/App";
import {
  loadConfig,
  loadManifest,
  loadPathsIndex,
  buildIndex,
} from "./content";
import { pyRuntime } from "./py/runtime";
import { hydrateFromServer } from "./progress";

async function boot() {
  const el = document.getElementById("app")!;
  // Restore whatever the server has on disk — this is what brings progress back
  // after a cleared browser cache. Deliberately not awaited, and outside the
  // try: it must never block first paint, and a sync failure must never surface
  // as "Failed to load content".
  void hydrateFromServer();
  try {
    const [config, pathIds] = await Promise.all([
      loadConfig(),
      loadPathsIndex(),
    ]);
    const paths: LoadedPath[] = await Promise.all(
      pathIds.map(async (id) => {
        const manifest = await loadManifest(id);
        return { id, manifest, index: buildIndex(manifest) };
      }),
    );
    pyRuntime.configure({
      defaultPackages: config.default_packages,
      timeoutMs: config.run_timeout_ms,
    });
    document.title = config.app_title; // index.html only carries the fallback
    render(<App config={config} paths={paths} />, el);
  } catch (err) {
    const box = document.createElement("div");
    box.className = "boot-error";
    const h1 = document.createElement("h1");
    h1.textContent = "Failed to load content";
    const pre = document.createElement("pre");
    pre.textContent = String(err instanceof Error ? err.message : err);
    box.append(h1, pre);
    el.replaceChildren(box);
  }
}

void boot();
