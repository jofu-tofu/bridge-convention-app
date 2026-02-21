import { describe, it, expect } from "vitest";
import { readStdin } from "../stdin";
import type { StdinSource } from "../stdin";
import type { CliError } from "../errors";

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
    expect(result.type).toBe("deal");
    expect(result.data).toEqual({ hands: {} });
  });

  it("throws INVALID_ARGS when stdin is a TTY", async () => {
    const stdin = mockStdin("", true);
    try {
      await readStdin(stdin);
      expect.fail("should have thrown");
    } catch (err) {
      const error = err as CliError;
      expect(error.code).toBe("INVALID_ARGS");
      expect(error.message).toContain("piped input");
    }
  });

  it("throws PARSE_ERROR on empty input", async () => {
    const stdin = emptyStdin();
    try {
      await readStdin(stdin);
      expect.fail("should have thrown");
    } catch (err) {
      const error = err as CliError;
      expect(error.code).toBe("PARSE_ERROR");
      expect(error.message).toContain("Empty input");
    }
  });

  it("throws PARSE_ERROR on invalid JSON", async () => {
    const stdin = mockStdin("not json at all");
    try {
      await readStdin(stdin);
      expect.fail("should have thrown");
    } catch (err) {
      const error = err as CliError;
      expect(error.code).toBe("PARSE_ERROR");
      expect(error.message).toContain("Invalid JSON");
    }
  });

  it("throws PARSE_ERROR when envelope missing type field", async () => {
    const stdin = mockStdin(JSON.stringify({ data: {} }));
    try {
      await readStdin(stdin);
      expect.fail("should have thrown");
    } catch (err) {
      const error = err as CliError;
      expect(error.code).toBe("PARSE_ERROR");
      expect(error.message).toContain("Malformed CommandResult");
    }
  });

  it("throws PARSE_ERROR when envelope missing data field", async () => {
    const stdin = mockStdin(JSON.stringify({ type: "deal" }));
    try {
      await readStdin(stdin);
      expect.fail("should have thrown");
    } catch (err) {
      const error = err as CliError;
      expect(error.code).toBe("PARSE_ERROR");
      expect(error.message).toContain("Malformed CommandResult");
    }
  });

  it("throws PARSE_ERROR for null input", async () => {
    const stdin = mockStdin("null");
    try {
      await readStdin(stdin);
      expect.fail("should have thrown");
    } catch (err) {
      const error = err as CliError;
      expect(error.code).toBe("PARSE_ERROR");
    }
  });
});
