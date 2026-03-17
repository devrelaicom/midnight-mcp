import { describe, it, expect } from "vitest";
import { createTarGzBase64 } from "../src/utils/tar.js";
import { gunzipSync } from "node:zlib";

/** Extract file entries from a tar buffer */
function parseTarEntries(tar: Buffer): Array<{ name: string; content: string }> {
  const entries: Array<{ name: string; content: string }> = [];
  let offset = 0;

  while (offset < tar.length) {
    // Check for end-of-archive (512 zero bytes)
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const name = header.subarray(0, 100).toString("utf-8").replace(/\0+$/, "");
    const sizeStr = header.subarray(124, 135).toString("utf-8").replace(/\0+$/, "");
    const size = parseInt(sizeStr, 8);

    offset += 512; // skip header
    const content = tar.subarray(offset, offset + size).toString("utf-8");
    entries.push({ name, content });

    // Advance past content + padding to next 512-byte boundary
    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

describe("createTarGzBase64", () => {
  it("creates a valid base64-encoded gzip archive", async () => {
    const files = { "main.compact": "export circuit main() {}" };
    const result = await createTarGzBase64(files);

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    // Verify it's valid base64
    expect(() => Buffer.from(result, "base64")).not.toThrow();
  });

  it("round-trips file content through tar.gz", async () => {
    const files = { "src/main.compact": "export circuit main() { }" };
    const base64 = await createTarGzBase64(files);

    const gzipped = Buffer.from(base64, "base64");
    const tar = gunzipSync(gzipped);
    const entries = parseTarEntries(tar);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("src/main.compact");
    expect(entries[0].content).toBe("export circuit main() { }");
  });

  it("preserves multiple files with directory structure", async () => {
    const files = {
      "src/main.compact": "import './lib/utils';",
      "src/lib/utils.compact": "export circuit helper() {}",
      "README.md": "# My Project",
    };
    const base64 = await createTarGzBase64(files);
    const tar = gunzipSync(Buffer.from(base64, "base64"));
    const entries = parseTarEntries(tar);

    expect(entries).toHaveLength(3);
    const names = entries.map((e) => e.name);
    expect(names).toContain("src/main.compact");
    expect(names).toContain("src/lib/utils.compact");
    expect(names).toContain("README.md");
  });

  it("handles empty files map", async () => {
    const base64 = await createTarGzBase64({});
    expect(base64).toBeTruthy();

    const tar = gunzipSync(Buffer.from(base64, "base64"));
    const entries = parseTarEntries(tar);
    expect(entries).toHaveLength(0);
  });

  it("throws for paths exceeding 100 bytes", async () => {
    const longPath = "a".repeat(101) + ".compact";
    await expect(
      createTarGzBase64({ [longPath]: "content" }),
    ).rejects.toThrow("100-byte tar name limit");
  });

  it("preserves unicode content", async () => {
    const files = { "test.compact": "// 日本語コメント\nexport circuit test() {}" };
    const base64 = await createTarGzBase64(files);
    const tar = gunzipSync(Buffer.from(base64, "base64"));
    const entries = parseTarEntries(tar);

    expect(entries[0].content).toBe("// 日本語コメント\nexport circuit test() {}");
  });
});
