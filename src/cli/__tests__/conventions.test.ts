import { describe, it, expect, beforeEach } from "vitest";
import { conventionsCommand } from "../commands/conventions";
import { createCliDependencies } from "../engine-factory";
import type { CommandResult } from "../types";
import { clearRegistry, registerConvention } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";

// Convention bootstrap happens via engine-factory import of "../conventions"
// But for explicit test isolation, register manually
const deps = createCliDependencies();

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

describe("conventions command", () => {
  it("--list returns all conventions", async () => {
    const result: CommandResult = await conventionsCommand.handler(
      { list: true },
      deps,
    );
    expect(result.type).toBe("conventions");
    const data = result.data as Array<{ id: string; name: string }>;
    expect(data).toHaveLength(1);
    expect(data[0]!.id).toBe("stayman");
    expect(data[0]!.name).toBe("Stayman");
  });

  it("--show stayman returns convention details", async () => {
    const result: CommandResult = await conventionsCommand.handler(
      { show: "stayman" },
      deps,
    );
    expect(result.type).toBe("convention");
    const data = result.data as { id: string; name: string; rules: string[] };
    expect(data.id).toBe("stayman");
    expect(data.rules).toContain("stayman-ask");
  });

  it("--show unknown throws error", async () => {
    await expect(
      conventionsCommand.handler({ show: "nonexistent" }, deps),
    ).rejects.toMatchObject({ code: "INVALID_ARGS" });
  });

  it("list returns JSON format correctly", async () => {
    const result = await conventionsCommand.handler({ list: true }, deps);
    // JSON output should have type and data properties
    expect(result).toHaveProperty("type", "conventions");
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("requires --list or --show argument", async () => {
    await expect(
      conventionsCommand.handler({}, deps),
    ).rejects.toMatchObject({ code: "INVALID_ARGS" });
  });
});
