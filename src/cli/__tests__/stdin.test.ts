import { describe, it, expect } from "vitest";
import { readStdin } from "../stdin";
import type { StdinSource } from "../stdin";

/** Create a mock stdin source from a string. */
function mockStdin(content: string, isTTY = false): StdinSource {
  const buffer = Buffer.from(content, "utf-8");
  return {
    isTTY,
    async *[Symbol.asyncIterator]() {
      yield buffer;
    },
  };
}

/** Create a mock stdin that yields nothing (empty). */
function emptyStdin(isTTY = false): StdinSource {
  return {
    isTTY,
    async *[Symbol.asyncIterator]() {
      // yields nothing
    },
  };
}

describe("readStdin", () => {
  it("parses valid CommandResult envelope from stream", async () => {
    const envelope = { type: "deal", data: { hands: {} } };
    const stdin = mockStdin(JSON.stringify(envelope));
    const result = await readStdin(stdin);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("deal");
    expect(result.value.data).toEqual({ hands: {} });
  });

  it("returns INVALID_ARGS error when stdin is a TTY", async () => {
    const stdin = mockStdin("", true);
    const result = await readStdin(stdin);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
    expect(result.error.message).toContain("piped input");
  });

  it("returns PARSE_ERROR on empty input", async () => {
    const stdin = emptyStdin();
    const result = await readStdin(stdin);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PARSE_ERROR");
    expect(result.error.message).toContain("Empty input");
  });

  it("returns PARSE_ERROR on invalid JSON", async () => {
    const stdin = mockStdin("not json at all");
    const result = await readStdin(stdin);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PARSE_ERROR");
    expect(result.error.message).toContain("Invalid JSON");
  });

  it("returns PARSE_ERROR when envelope missing type field", async () => {
    const stdin = mockStdin(JSON.stringify({ data: {} }));
    const result = await readStdin(stdin);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PARSE_ERROR");
    expect(result.error.message).toContain("Malformed CommandResult");
  });

  it("returns PARSE_ERROR when envelope missing data field", async () => {
    const stdin = mockStdin(JSON.stringify({ type: "deal" }));
    const result = await readStdin(stdin);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PARSE_ERROR");
    expect(result.error.message).toContain("Malformed CommandResult");
  });

  it("returns PARSE_ERROR for null input", async () => {
    const stdin = mockStdin("null");
    const result = await readStdin(stdin);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PARSE_ERROR");
  });
});
