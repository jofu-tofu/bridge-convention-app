import { describe, it, expect, beforeEach } from "vitest";
import { conventionsCommand } from "../commands/conventions";
import { createCliDependencies } from "../engine-factory";
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
    const result = await conventionsCommand.handler({ list: true }, deps);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("conventions");
    const data = result.value.data as Array<{ id: string; name: string }>;
    expect(data).toHaveLength(1);
    expect(data[0]!.id).toBe("stayman");
    expect(data[0]!.name).toBe("Stayman");
  });

  it("--show stayman returns convention details", async () => {
    const result = await conventionsCommand.handler({ show: "stayman" }, deps);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("convention");
    const data = result.value.data as {
      id: string;
      name: string;
      rules: string[];
    };
    expect(data.id).toBe("stayman");
    expect(data.rules).toContain("stayman-ask");
  });

  it("--show unknown returns error", async () => {
    const result = await conventionsCommand.handler(
      { show: "nonexistent" },
      deps,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("list returns JSON format correctly", async () => {
    const result = await conventionsCommand.handler({ list: true }, deps);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("conventions");
    expect(Array.isArray(result.value.data)).toBe(true);
  });

  it("requires --list or --show argument", async () => {
    const result = await conventionsCommand.handler({}, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });
});
