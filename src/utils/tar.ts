import { createGzip } from "node:zlib";

/**
 * Create a base64-encoded .tar.gz from a map of relative paths to file contents.
 * Preserves directory structure from keys for correct import resolution.
 */
export async function createTarGzBase64(files: Record<string, string>): Promise<string> {
  const blocks: Buffer[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (Buffer.byteLength(path, "utf-8") > 100) {
      throw new Error(
        `File path "${path}" exceeds the 100-byte tar name limit. Use shorter paths.`,
      );
    }
    const data = Buffer.from(content, "utf-8");
    const header = createTarHeader(path, data.length);
    blocks.push(header);
    blocks.push(data);
    const padding = 512 - (data.length % 512);
    if (padding < 512) {
      blocks.push(Buffer.alloc(padding));
    }
  }

  // End-of-archive: two 512-byte zero blocks
  blocks.push(Buffer.alloc(1024));

  const tarBuffer = Buffer.concat(blocks);

  return new Promise<string>((resolve, reject) => {
    const gzip = createGzip();
    const chunks: Buffer[] = [];

    gzip.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    gzip.on("end", () => {
      resolve(Buffer.concat(chunks).toString("base64"));
    });
    gzip.on("error", reject);

    gzip.end(tarBuffer);
  });
}

function createTarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512);

  header.write(name.slice(0, 100), 0, 100, "utf-8");
  header.write("0000644\0", 100, 8, "utf-8");
  header.write("0001000\0", 108, 8, "utf-8");
  header.write("0001000\0", 116, 8, "utf-8");
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "utf-8");
  const mtime = Math.floor(Date.now() / 1000);
  header.write(mtime.toString(8).padStart(11, "0") + "\0", 136, 12, "utf-8");
  header.write("        ", 148, 8, "utf-8");
  header.write("0", 156, 1, "utf-8");

  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i] ?? 0;
  }
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf-8");

  return header;
}
