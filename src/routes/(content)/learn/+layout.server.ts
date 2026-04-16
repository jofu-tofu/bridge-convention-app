import fs from "node:fs";
import path from "node:path";

export interface LearnSidebarModule {
  moduleId: string;
  displayName: string;
  description: string;
  bundleIds?: string[];
}

function loadModules(): LearnSidebarModule[] {
  const candidates = [
    path.resolve(".generated/learn-data.json"),
    path.resolve("dist/.generated/learn-data.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf-8")) as { modules?: LearnSidebarModule[] };
      return (data.modules ?? []).map((m) => ({
        moduleId: m.moduleId,
        displayName: m.displayName,
        description: m.description,
        bundleIds: m.bundleIds ?? [],
      }));
    }
  }
  return [];
}

export function load() {
  return { sidebarModules: loadModules() };
}
