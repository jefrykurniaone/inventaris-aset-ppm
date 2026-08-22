import { renderRow, type XlsxCell } from "./xlsx-cells";
import {
  CONTENT_TYPES_XML,
  HEADER_ROW_NUMBER,
  PACKAGE_RELS_XML,
  STYLES_XML,
  WORKBOOK_RELS_XML,
  workbookXml,
  worksheetEpilogue,
  worksheetPrelude,
  WORKSHEET_PART_PATH,
} from "./xlsx-parts";
import {
  deflateOnce,
  deflateText,
  ZipArchiveWriter,
  type DeflatedContent,
} from "./xlsx-zip";

/**
 * Assembles the six XML parts and the ZIP container into one `.xlsx` byte
 * stream (issue #14).
 *
 * Memory profile, which is the property the ticket asks for: the worksheet's
 * rows are pulled one at a time from an async iterable, turned into XML, and
 * fed straight into a deflate stream. The uncompressed worksheet — the only
 * part that grows with the size of the register — never exists as a single
 * value. What is held is the deflate output, and SpreadsheetML of this shape
 * compresses by roughly an order of magnitude, so a twenty-thousand-row export
 * sits in the low megabytes rather than the high tens.
 *
 * The remaining five parts are fixed-size and are compressed in one shot.
 */

export interface XlsxColumn {
  readonly header: string;
  /** Width in characters, as Excel counts them. */
  readonly width: number;
}

export interface XlsxWorkbookInput {
  readonly sheetName: string;
  readonly columns: readonly XlsxColumn[];
  /** One entry per body row, already shaped into cells. Consumed exactly
   * once, in order. */
  readonly rows: AsyncIterable<readonly XlsxCell[]>;
}

function headerCells(columns: readonly XlsxColumn[]): readonly XlsxCell[] {
  return columns.map((column) => ({
    value: column.header,
    style: "header" as const,
  }));
}

async function* worksheetXmlChunks(
  input: XlsxWorkbookInput,
): AsyncGenerator<string> {
  yield worksheetPrelude(input.columns.map((column) => column.width));
  yield renderRow(HEADER_ROW_NUMBER, headerCells(input.columns));

  let lastRowNumber = HEADER_ROW_NUMBER;
  for await (const cells of input.rows) {
    lastRowNumber += 1;
    yield renderRow(lastRowNumber, cells);
  }

  yield worksheetEpilogue(input.columns.length, lastRowNumber);
}

/** The five parts that do not depend on the data, in package order. */
function fixedParts(
  sheetName: string,
): ReadonlyArray<readonly [string, string]> {
  return [
    ["[Content_Types].xml", CONTENT_TYPES_XML],
    ["_rels/.rels", PACKAGE_RELS_XML],
    ["xl/workbook.xml", workbookXml(sheetName)],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML],
    ["xl/styles.xml", STYLES_XML],
  ];
}

async function* xlsxByteChunks(
  input: XlsxWorkbookInput,
): AsyncGenerator<Uint8Array> {
  const zip = new ZipArchiveWriter();

  for (const [name, xml] of fixedParts(input.sheetName)) {
    yield* zip.addEntry(name, deflateOnce(xml));
  }

  const worksheet: DeflatedContent = await deflateText(
    worksheetXmlChunks(input),
  );
  yield* zip.addEntry(WORKSHEET_PART_PATH, worksheet);

  yield zip.finish();
}

/**
 * The workbook as a web `ReadableStream`, which is what a Next.js route
 * handler hands to `Response`.
 *
 * `pull` rather than `start`, so the generator is driven by the consumer:
 * nothing is queried, compressed or queued until the response body is
 * actually being read, and a reader that gives up returns the generator
 * rather than leaving it suspended. Cancellation takes effect at a yield
 * point, so a request abandoned while the worksheet is still compressing
 * finishes that part before it stops — bounded by the row cap in
 * `asset-export.ts`, not open-ended.
 */
export function createXlsxStream(
  input: XlsxWorkbookInput,
): ReadableStream<Uint8Array> {
  const chunks = xlsxByteChunks(input);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await chunks.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}

/** Collects a workbook stream into one buffer. For tests and for callers
 * small enough not to care — never on the export path itself, which exists
 * precisely so the whole file is not held at once. */
export async function collectStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  let next = await reader.read();
  while (!next.done) {
    parts.push(next.value);
    next = await reader.read();
  }
  return Buffer.concat(parts);
}
