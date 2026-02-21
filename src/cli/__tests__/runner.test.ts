import { describe, it, expect } from "vitest";
import { createCli } from "../runner";
import { createCliEngine } from "../engine-factory";
import type { CliDependencies } from "../types";
import { readStdin } from "../stdin";

function createTestDeps(): CliDependencies & {
  outputLines: string[];
  errorLines: string[];
} {
  const outputLines: string[] = [];
  const errorLines: string[] = [];
  return {
    engine: createCliEngine(),
    output: (msg: string) => outputLines.push(msg),
    errorOutput: (msg: string) => errorLines.push(msg),
    readStdin,
    outputLines,
    errorLines,
  };
}

describe("createCli", () => {
  it("dispatches to generate command", async () => {
    const deps = createTestDeps();
    const cli = createCli(deps);
    const exitCode = await cli.run(["generate"]);
    expect(exitCode).toBe(0);
    expect(deps.outputLines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(deps.outputLines[0]!);
    expect(parsed.type).toBe("deal");
  });

  it("shows help with --help flag", async () => {
    const deps = createTestDeps();
    const cli = createCli(deps);
    const exitCode = await cli.run(["--help"]);
    expect(exitCode).toBe(0);
    const fullOutput = deps.outputLines.join("\n");
    expect(fullOutput).toContain("bridge");
    expect(fullOutput).toContain("generate");
    expect(fullOutput).toContain("evaluate");
    expect(fullOutput).toContain("Coming soon");
  });

  it("shows help when no command given", async () => {
    const deps = createTestDeps();
    const cli = createCli(deps);
    const exitCode = await cli.run([]);
    expect(exitCode).toBe(0);
    const fullOutput = deps.outputLines.join("\n");
    expect(fullOutput).toContain("bridge");
  });

  it("phase-gates future commands with structured error", async () => {
    const deps = createTestDeps();
    const cli = createCli(deps);
    const exitCode = await cli.run(["simulate"]);
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(deps.errorLines[0]!);
    expect(parsed.error.code).toBe("NOT_IMPLEMENTED");
    expect(parsed.error.phase).toBe(3);
  });

  it("returns error for unknown commands", async () => {
    const deps = createTestDeps();
    const cli = createCli(deps);
    const exitCode = await cli.run(["nonexistent"]);
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(deps.errorLines[0]!);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("outputs version with --version flag", async () => {
    const deps = createTestDeps();
    const cli = createCli(deps);
    const exitCode = await cli.run(["--version"]);
    expect(exitCode).toBe(0);
    expect(deps.outputLines.length).toBe(1);
    expect(deps.outputLines[0]!).toBeTruthy();
    expect(typeof deps.outputLines[0]!).toBe("string");
  });

  it("supports --format text for generate", async () => {
    const deps = createTestDeps();
    const cli = createCli(deps);
    const exitCode = await cli.run(["generate", "--format", "text"]);
    expect(exitCode).toBe(0);
    const output = deps.outputLines[0]!;
    expect(output).toContain("N:");
    expect(output).toContain("HCP");
  });
});
