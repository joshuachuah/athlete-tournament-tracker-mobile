import { readFileSync } from "node:fs";

const lockfile = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");

const expectedVersions = new Map([
  ["brace-expansion", new Set(["1.1.18", "2.1.4", "5.0.9"])],
]);

for (const [packageName, expected] of expectedVersions) {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entryPattern = new RegExp(`^  ${escapedName}@([^:]+):`, "gm");
  const actual = new Set(
    [...lockfile.matchAll(entryPattern)].map((match) => match[1]),
  );

  const missing = [...expected].filter((version) => !actual.has(version));
  const unexpected = [...actual].filter((version) => !expected.has(version));

  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `${packageName} lockfile versions are not the reviewed advisory set. ` +
        `Expected ${[...expected].join(", ")}; found ${[...actual].join(", ") || "none"}.`,
    );
  }
}

console.log("Dependency advisory lockfile versions match the reviewed set.");
