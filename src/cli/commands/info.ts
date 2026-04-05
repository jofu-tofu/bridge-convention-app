// ── CLI info commands ───────────────────────────────────────────────
//
// bundles, modules, describe — discovery commands using WasmService catalog.

import type { DevServicePort } from "../../service";
import type { Flags } from "../shared";
import { printJson, requireArg } from "../shared";

export async function runBundles(service: DevServicePort): Promise<void> {
  const bundles = await service.listConventions();
  printJson(bundles);
}

export async function runModules(service: DevServicePort): Promise<void> {
  const modules = await service.listModules();
  printJson(modules);
}

export async function runDescribe(service: DevServicePort, flags: Flags): Promise<void> {
  const bundleId = requireArg(flags, "bundle");

  const bundles = await service.listConventions();
  const bundle = bundles.find((b) => b.id === bundleId);
  if (!bundle) {
    console.error(`Unknown bundle: "${bundleId}"`);
    console.error("Available bundles:");
    for (const b of bundles) {
      console.error(`  ${b.id} — ${b.name}`);
    }
    process.exit(2);
  }

  const allModules = await service.listModules();
  const bundleModules = allModules.filter((m) => m.bundleIds.includes(bundleId));

  printJson({
    bundle,
    modules: bundleModules,
  });
}
