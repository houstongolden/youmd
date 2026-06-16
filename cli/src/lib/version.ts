import * as fs from "fs";
import * as path from "path";

// Read from package.json so every CLI surface reports the packaged version.
// Search upward because callers can live in dist/, dist/lib/, src/, or src/lib/.
export function readCliVersion(fromDir: string = __dirname): string {
  let cursor = fromDir;

  for (let depth = 0; depth < 5; depth++) {
    try {
      const pkgPath = path.join(cursor, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (
        pkg &&
        pkg.name === "youmd" &&
        typeof pkg.version === "string"
      ) {
        return pkg.version;
      }
    } catch {
      // keep walking
    }

    const next = path.dirname(cursor);
    if (next === cursor) break;
    cursor = next;
  }

  return "0.0.0";
}
