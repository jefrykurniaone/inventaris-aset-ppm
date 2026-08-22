import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  crc32,
  deflateOnce,
  deflateText,
  finaliseCrc32,
  updateCrc32,
  ZipArchiveWriter,
} from "./xlsx-zip";

const CRC32_INITIAL = 0xffffffff;
/** The check value every CRC-32 implementation is tested against. */
const CHECK_INPUT = "123456789";
const CHECK_VALUE = 0xcbf43926;

async function* fromChunks(chunks: readonly string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function inflateAll(content: { readonly chunks: readonly Buffer[] }): string {
  return inflateRawSync(Buffer.concat([...content.chunks])).toString("utf8");
}

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(Buffer.from(CHECK_INPUT, "utf8"))).toBe(CHECK_VALUE);
  });

  it("gives the same answer whether fed in one piece or several", () => {
    const whole = crc32(Buffer.from(CHECK_INPUT, "utf8"));
    let running = CRC32_INITIAL;
    for (const part of ["1234", "567", "89"]) {
      running = updateCrc32(running, Buffer.from(part, "utf8"));
    }
    expect(finaliseCrc32(running)).toBe(whole);
  });

  it("is zero for empty input", () => {
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe("deflateOnce", () => {
  it("round-trips through inflate and reports the pre-compression size", () => {
    const text = "<row><c/></row>".repeat(50);
    const content = deflateOnce(text);

    expect(inflateAll(content)).toBe(text);
    expect(content.uncompressedSize).toBe(Buffer.byteLength(text, "utf8"));
    expect(content.crc).toBe(crc32(Buffer.from(text, "utf8")));
  });
});

describe("deflateText", () => {
  it("compresses a sequence of fragments into one stream", async () => {
    const fragments = ["<sheetData>", '<row r="1"/>', "</sheetData>"];
    const content = await deflateText(fromChunks(fragments));

    expect(inflateAll(content)).toBe(fragments.join(""));
    expect(content.crc).toBe(crc32(Buffer.from(fragments.join(""), "utf8")));
  });

  it("keeps the compressed form far smaller than the rows it was fed", async () => {
    const rows = Array.from(
      { length: 2000 },
      (_unused, index) => `<row r="${index}"><c t="inlineStr"/></row>`,
    );
    const content = await deflateText(fromChunks(rows));
    const compressedSize = content.chunks.reduce(
      (total, chunk) => total + chunk.length,
      0,
    );

    expect(inflateAll(content)).toBe(rows.join(""));
    expect(compressedSize).toBeLessThan(content.uncompressedSize / 10);
  });

  it("handles an empty sequence", async () => {
    const content = await deflateText(fromChunks([]));
    expect(content.uncompressedSize).toBe(0);
    expect(inflateAll(content)).toBe("");
  });
});

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_NAME_LENGTH_OFFSET = 26;
const EOCD_ENTRY_COUNT_OFFSET = 10;
const EOCD_SIZE = 22;
/** Byte offset of the local-header-offset field inside a central record. */
const CENTRAL_LOCAL_OFFSET_FIELD = 42;
const CENTRAL_HEADER_MAGIC = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

describe("ZipArchiveWriter", () => {
  it("writes a readable archive with one central directory record per entry", () => {
    const zip = new ZipArchiveWriter();
    const parts = [
      ...zip.addEntry("first.xml", deflateOnce("<a/>")),
      ...zip.addEntry("second.xml", deflateOnce("<b/>")),
    ];
    const archive = Buffer.concat([...parts, zip.finish()]);

    expect(archive.readUInt32LE(0)).toBe(LOCAL_HEADER_SIGNATURE);
    const trailerAt = archive.length - EOCD_SIZE;
    expect(archive.readUInt32LE(trailerAt)).toBe(
      END_OF_CENTRAL_DIRECTORY_SIGNATURE,
    );
    expect(archive.readUInt16LE(trailerAt + EOCD_ENTRY_COUNT_OFFSET)).toBe(2);
    expect(archive.indexOf("first.xml", 0, "utf8")).toBeGreaterThan(0);
  });

  it("records a central directory offset that points back at the local header", () => {
    const zip = new ZipArchiveWriter();
    const parts = [...zip.addEntry("only.xml", deflateOnce("<a/>".repeat(20)))];
    const archive = Buffer.concat([...parts, zip.finish()]);

    const directoryAt = archive.indexOf(CENTRAL_HEADER_MAGIC);
    expect(archive.readUInt32LE(directoryAt)).toBe(CENTRAL_HEADER_SIGNATURE);
    expect(archive.readUInt32LE(directoryAt + CENTRAL_LOCAL_OFFSET_FIELD)).toBe(
      0,
    );
    expect(archive.readUInt16LE(LOCAL_NAME_LENGTH_OFFSET)).toBe(
      "only.xml".length,
    );
  });
});
