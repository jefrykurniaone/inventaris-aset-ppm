import { once } from "node:events";
import { createDeflateRaw, deflateRawSync } from "node:zlib";

/**
 * The ZIP container half of the `.xlsx` writer (issue #14).
 *
 * An `.xlsx` file is a ZIP archive of XML parts, and the subset of the ZIP
 * format a spreadsheet needs is small: stored-in-order deflate entries, a
 * central directory, and an end-of-central-directory record. No ZIP64, no
 * encryption, no data descriptors. That is why this exists instead of a
 * dependency — see `docs/adr/0006-hand-rolled-xlsx-writer.md` for the licence,
 * maintenance and CVE review that ruled out `exceljs` and SheetJS `xlsx`.
 *
 * The streaming property the ticket asks for lives in `deflateText`: rows
 * arrive as an async iterable of XML fragments and are fed through a single
 * `zlib` deflate stream as they arrive, so the *uncompressed* worksheet XML —
 * the large thing, tens of megabytes for a full register — never exists as one
 * string. Only the compressed bytes are held, and worksheet XML compresses by
 * roughly an order of magnitude.
 */

const CRC32_POLYNOMIAL = 0xedb88320;
const CRC32_TABLE_SIZE = 256;
const CRC32_INITIAL = 0xffffffff;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;
const LOW_BIT_MASK = 1;

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(CRC32_TABLE_SIZE);
  for (let index = 0; index < CRC32_TABLE_SIZE; index += 1) {
    let value = index;
    for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
      const isLowBitSet = (value & LOW_BIT_MASK) !== 0;
      value = isLowBitSet ? (value >>> 1) ^ CRC32_POLYNOMIAL : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = buildCrc32Table();

/** Folds more bytes into a running CRC-32. Seed with `CRC32_INITIAL` and
 * finish with `finaliseCrc32` — the two are split so a value can be
 * accumulated across chunks that are never held together. */
export function updateCrc32(crc: number, bytes: Uint8Array): number {
  let next = crc;
  for (const byte of bytes) {
    next = CRC32_TABLE[(next ^ byte) & BYTE_MASK] ^ (next >>> BITS_PER_BYTE);
  }
  return next >>> 0;
}

export function finaliseCrc32(crc: number): number {
  return (crc ^ CRC32_INITIAL) >>> 0;
}

export function crc32(bytes: Uint8Array): number {
  return finaliseCrc32(updateCrc32(CRC32_INITIAL, bytes));
}

/** One deflated archive member, ready to be written: its compressed bytes
 * split into whatever chunks `zlib` produced, plus the two figures the ZIP
 * headers need about the data before compression. */
export interface DeflatedContent {
  readonly chunks: readonly Buffer[];
  readonly crc: number;
  readonly uncompressedSize: number;
}

/** For the five small, fixed XML parts, where there is nothing to stream. */
export function deflateOnce(text: string): DeflatedContent {
  const bytes = Buffer.from(text, "utf8");
  return {
    chunks: [deflateRawSync(bytes)],
    crc: crc32(bytes),
    uncompressedSize: bytes.length,
  };
}

/**
 * Compresses an async sequence of XML fragments into one deflate stream.
 *
 * Backpressure is honoured: when `write` reports the internal buffer full the
 * loop waits for `drain` before pulling the next fragment, which is what stops
 * a fast database cursor from outrunning the compressor and re-creating the
 * memory spike this function exists to avoid.
 */
export async function deflateText(
  source: AsyncIterable<string>,
): Promise<DeflatedContent> {
  const deflate = createDeflateRaw();
  const chunks: Buffer[] = [];
  deflate.on("data", (chunk: Buffer) => chunks.push(chunk));
  // Registered before the first write so a compressor error rejects rather
  // than hanging the loop. `events.once` rejects on `error` by contract.
  const finished = once(deflate, "end");

  let crc = CRC32_INITIAL;
  let uncompressedSize = 0;
  for await (const text of source) {
    const bytes = Buffer.from(text, "utf8");
    crc = updateCrc32(crc, bytes);
    uncompressedSize += bytes.length;
    if (!deflate.write(bytes)) {
      await once(deflate, "drain");
    }
  }

  deflate.end();
  await finished;
  return { chunks, crc: finaliseCrc32(crc), uncompressedSize };
}

const UINT16_BYTES = 2;
const UINT32_BYTES = 4;

/**
 * Appends little-endian fields to a byte sequence.
 *
 * Every ZIP header here is written through this rather than
 * `Buffer.writeUInt32LE(value, offset)`, so that no byte offset appears as a
 * literal anywhere: a mis-typed offset in a binary header is silent, and the
 * project forbids magic numbers for exactly this class of bug.
 */
class ByteWriter {
  private readonly parts: Buffer[] = [];

  uint16(value: number): this {
    const field = Buffer.alloc(UINT16_BYTES);
    field.writeUInt16LE(value);
    this.parts.push(field);
    return this;
  }

  uint32(value: number): this {
    const field = Buffer.alloc(UINT32_BYTES);
    field.writeUInt32LE(value);
    this.parts.push(field);
    return this;
  }

  bytes(value: Buffer): this {
    this.parts.push(value);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.parts);
  }
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
/** 2.0 — the version that introduced deflate, which is all this writer uses. */
const ZIP_VERSION = 20;
/** General-purpose bit 11: member names are UTF-8. */
const UTF8_NAME_FLAG = 0x0800;
const DEFLATE_METHOD = 8;
/** 1980-01-01 00:00 as a DOS date/time pair. A ZIP timestamp is invisible in
 * Excel, and pinning it makes the produced bytes reproducible — which is what
 * lets the unit tests assert on the archive itself. The export date the ticket
 * asks for is carried by the filename, not by this field. */
const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021;
const NO_EXTRA_FIELD = 0;
const NO_COMMENT = 0;
const SINGLE_DISK = 0;
const NO_INTERNAL_ATTRIBUTES = 0;
const NO_EXTERNAL_ATTRIBUTES = 0;

interface ArchivedEntry {
  readonly name: Buffer;
  readonly content: DeflatedContent;
  readonly compressedSize: number;
  readonly offset: number;
}

function compressedSizeOf(content: DeflatedContent): number {
  return content.chunks.reduce((total, chunk) => total + chunk.length, 0);
}

/**
 * Accumulates archive members and emits their bytes in order.
 *
 * Members are handed back as buffers rather than written to a sink so the
 * caller can yield them straight into a `ReadableStream`; the writer itself
 * keeps only one small record per member, never their contents.
 */
export class ZipArchiveWriter {
  private readonly entries: ArchivedEntry[] = [];
  private offset = 0;

  /** The local header and compressed bytes for one member, in write order. */
  addEntry(name: string, content: DeflatedContent): readonly Buffer[] {
    const nameBytes = Buffer.from(name, "utf8");
    const compressedSize = compressedSizeOf(content);
    const entry: ArchivedEntry = {
      name: nameBytes,
      content,
      compressedSize,
      offset: this.offset,
    };
    this.entries.push(entry);

    const header = new ByteWriter()
      .uint32(LOCAL_HEADER_SIGNATURE)
      .uint16(ZIP_VERSION)
      .uint16(UTF8_NAME_FLAG)
      .uint16(DEFLATE_METHOD)
      .uint16(DOS_TIME)
      .uint16(DOS_DATE)
      .uint32(content.crc)
      .uint32(compressedSize)
      .uint32(content.uncompressedSize)
      .uint16(nameBytes.length)
      .uint16(NO_EXTRA_FIELD)
      .bytes(nameBytes)
      .toBuffer();

    this.offset += header.length + compressedSize;
    return [header, ...content.chunks];
  }

  private centralHeader(entry: ArchivedEntry): Buffer {
    return new ByteWriter()
      .uint32(CENTRAL_HEADER_SIGNATURE)
      .uint16(ZIP_VERSION)
      .uint16(ZIP_VERSION)
      .uint16(UTF8_NAME_FLAG)
      .uint16(DEFLATE_METHOD)
      .uint16(DOS_TIME)
      .uint16(DOS_DATE)
      .uint32(entry.content.crc)
      .uint32(entry.compressedSize)
      .uint32(entry.content.uncompressedSize)
      .uint16(entry.name.length)
      .uint16(NO_EXTRA_FIELD)
      .uint16(NO_COMMENT)
      .uint16(SINGLE_DISK)
      .uint16(NO_INTERNAL_ATTRIBUTES)
      .uint32(NO_EXTERNAL_ATTRIBUTES)
      .uint32(entry.offset)
      .bytes(entry.name)
      .toBuffer();
  }

  /** The central directory and its trailer — everything after the last
   * member. Call once, after every `addEntry`. */
  finish(): Buffer {
    const directory = Buffer.concat(
      this.entries.map((entry) => this.centralHeader(entry)),
    );
    const trailer = new ByteWriter()
      .uint32(END_OF_CENTRAL_DIRECTORY_SIGNATURE)
      .uint16(SINGLE_DISK)
      .uint16(SINGLE_DISK)
      .uint16(this.entries.length)
      .uint16(this.entries.length)
      .uint32(directory.length)
      .uint32(this.offset)
      .uint16(NO_COMMENT)
      .toBuffer();
    return Buffer.concat([directory, trailer]);
  }
}
