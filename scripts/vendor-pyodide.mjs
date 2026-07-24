// Vendors the Python runtime into public/pyodide/v<version>/ so the app never
// fetches executable code from a third-party CDN while a learner is using it.
//
//   node scripts/vendor-pyodide.mjs                 core + formatter (~16 MB)
//   node scripts/vendor-pyodide.mjs numpy           core + numpy and its deps
//   node scripts/vendor-pyodide.mjs --all           every allowlisted package
//   node scripts/vendor-pyodide.mjs --core-only     interpreter only, no extras
//
// Only what the content actually imports needs vendoring, and the scientific
// wheels are large (scipy alone is 45 MB), so the default stays small: the
// interpreter, plus the formatter. Add packages as your lessons need them.
//
// The core (interpreter, wasm, stdlib) is copied out of node_modules, so a
// plain `npm install` already leaves the engine able to run offline. Package
// wheels are not in the npm package, so those are downloaded once here, at
// install time, and checked against the sha256 in Pyodide's own lockfile —
// stronger than the unverified runtime CDN fetch this replaces.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pyodideDir = dirname(require.resolve("pyodide/package.json"));
const VERSION = require("pyodide/package.json").version;
const destDir = join(repoRoot, "public", "pyodide", `v${VERSION}`);
const releaseBase = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;

// Everything loadPyodide() needs at runtime. The .map files are development
// aids and would double the payload, so they stay behind.
const CORE = [
  "pyodide.mjs",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

// micropip installs the formatter's wheels, so it is always vendored; the
// scientific set is the engine's allowlist (PYODIDE_PACKAGES in
// src/schemas.ts) and comes only when asked for, by name or with --all.
const DEFAULT_PACKAGES = ["micropip"];
const ALL_PACKAGES = ["numpy", "scipy", "sympy", "matplotlib", "micropip"];

// black is a PyPI package rather than part of the Pyodide distribution, so it
// is resolved from PyPI and its dependency set is pinned here (black declares
// exactly these at runtime). Vendoring them lets Format work offline; without
// them the engine simply reports formatting as unavailable.
const FORMATTER = [
  "black",
  "click",
  "mypy_extensions",
  "packaging",
  "pathspec",
  "platformdirs",
];

function human(bytes) {
  return bytes > 1 << 20
    ? `${(bytes / (1 << 20)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Every package the requested names need, following the lockfile's deps. */
function resolveDeps(lock, names) {
  const out = new Map();
  const queue = [...names];
  while (queue.length) {
    const name = queue.shift();
    const key = Object.keys(lock.packages).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    if (!key) throw new Error(`package "${name}" is not in pyodide-lock.json`);
    if (out.has(key)) continue;
    const pkg = lock.packages[key];
    out.set(key, pkg);
    queue.push(...(pkg.depends ?? []));
  }
  return [...out.values()];
}

/** Skip work when a byte-identical copy is already vendored. */
async function alreadyGood(path, sha256) {
  if (!existsSync(path)) return false;
  if (!sha256) return true;
  const have = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  return have === sha256;
}

async function vendorCore() {
  await mkdir(destDir, { recursive: true });
  for (const file of CORE) {
    const from = join(pyodideDir, file);
    if (!existsSync(from)) throw new Error(`pyodide package is missing ${file}`);
    await copyFile(from, join(destDir, file));
  }
  console.log(`core        ${CORE.length} files from pyodide@${VERSION}`);
}

async function vendorPackages(names) {
  const lock = JSON.parse(await readFile(join(destDir, "pyodide-lock.json"), "utf8"));
  const pkgs = resolveDeps(lock, names);
  let fetched = 0;
  let bytes = 0;
  for (const pkg of pkgs) {
    const target = join(destDir, pkg.file_name);
    if (await alreadyGood(target, pkg.sha256)) continue;
    const data = await download(releaseBase + pkg.file_name);
    const sum = createHash("sha256").update(data).digest("hex");
    if (pkg.sha256 && sum !== pkg.sha256) {
      throw new Error(
        `${pkg.file_name}: sha256 mismatch (lockfile ${pkg.sha256}, got ${sum})`,
      );
    }
    await writeFile(target, data);
    fetched++;
    bytes += data.length;
  }
  console.log(
    `packages    ${pkgs.length} resolved from ${names.length} requested` +
      (fetched ? `, ${fetched} downloaded (${human(bytes)})` : ", all current"),
  );
}

/** The formatter's wheels, from PyPI, plus a manifest the worker reads. */
async function vendorFormatter() {
  const wheelDir = join(destDir, "wheels");
  await mkdir(wheelDir, { recursive: true });
  const files = [];
  let bytes = 0;
  for (const name of FORMATTER) {
    const meta = await download(
      `https://pypi.org/pypi/${name.replace(/_/g, "-")}/json`,
    ).then((b) => JSON.parse(b.toString("utf8")));
    // Pure-Python wheels only: anything compiled would target the wrong
    // platform, and every package here publishes a py3-none-any build.
    const wheel = meta.urls.find(
      (u) => u.packagetype === "bdist_wheel" && u.filename.endsWith("-none-any.whl"),
    );
    if (!wheel) throw new Error(`${name}: no pure-Python wheel on PyPI`);
    files.push(wheel.filename);
    const target = join(wheelDir, wheel.filename);
    if (existsSync(target)) continue;
    const data = await download(wheel.url);
    const sum = createHash("sha256").update(data).digest("hex");
    if (wheel.digests?.sha256 && sum !== wheel.digests.sha256) {
      throw new Error(`${wheel.filename}: sha256 mismatch against PyPI`);
    }
    await writeFile(target, data);
    bytes += data.length;
  }
  // The worker reads this instead of guessing version-stamped filenames.
  await writeFile(join(wheelDir, "wheels.json"), JSON.stringify(files, null, 2));
  console.log(
    `formatter   ${files.length} wheels${bytes ? ` (${human(bytes)} downloaded)` : ", all current"}`,
  );
}

async function totalSize(dir) {
  let sum = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    sum += entry.isDirectory()
      ? await totalSize(p)
      : (await readFile(p)).byteLength;
  }
  return sum;
}

const args = process.argv.slice(2);
const coreOnly = args.includes("--core-only");
const asked = args.filter((a) => !a.startsWith("--"));
const names = args.includes("--all")
  ? [...new Set([...ALL_PACKAGES, ...asked])]
  : asked.length
    ? [...new Set([...asked, ...DEFAULT_PACKAGES])]
    : DEFAULT_PACKAGES;

// The core comes out of node_modules and always succeeds; the extras need
// the network. This runs from postinstall, so a download failure must warn
// rather than fail the install — the engine still runs pure-Python content,
// and `npm run vendor:pyodide` picks up the rest later.
await vendorCore();
if (!coreOnly) {
  try {
    await vendorPackages(names);
    await vendorFormatter();
  } catch (err) {
    console.warn(`\n! could not vendor the extras: ${err.message}`);
    console.warn("  the interpreter is installed and pure-Python lessons run;");
    console.warn("  re-run `npm run vendor:pyodide` when you are online.\n");
  }
}
console.log(
  `vendored    public/pyodide/v${VERSION} (${human(await totalSize(destDir))})`,
);
