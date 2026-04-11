import fs from "node:fs";
import path from "node:path";

interface ModuleCatalogEntry {
  moduleId: string;
  displayName: string;
  description: string;
  surfaceCount: number;
}

function loadModules(): ModuleCatalogEntry[] {
  const candidates = [
    path.resolve("static/.static/learn-data.json"),
    path.resolve("dist/.static/learn-data.json"),
    path.resolve(".static/learn-data.json"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf-8")) as { modules?: ModuleCatalogEntry[] };
      return data.modules ?? [];
    }
  }
  return [];
}

export function load() {
  return { modules: loadModules() };
}
