import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("neutralizes formula-leading cells", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
  });
  it("escapes quotes and handles null", () => {
    expect(csvCell('a"b')).toBe(`"a""b"`);
    expect(csvCell(null)).toBe(`""`);
  });
  it("builds CRLF rows", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe(`"a","b"\r\n"1","x"\r\n`);
  });
});
