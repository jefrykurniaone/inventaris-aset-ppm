import {
  measureColumnWidths,
  toAssetExportCells,
  type AssetExportLabels,
  type AssetExportSource,
} from "@/lib/asset-export";
import type { AssetExportColumn } from "@/lib/asset-export-columns";
import type { XlsxCell } from "@/lib/xlsx-cells";
import { createXlsxStream, type XlsxColumn } from "@/lib/xlsx-writer";

import {
  iterateAssetExportChunks,
  type AssetExportQueryInput,
} from "./queries";

/**
 * Wires the chunked read to the streaming workbook writer (issue #14).
 *
 * The one subtlety is column widths. `<cols>` has to be written before the
 * first `<row>`, and the whole result set is never in memory, so the widths
 * are measured over the first chunk only — which is pulled here, before the
 * stream is created, and then replayed as the first rows of the sheet rather
 * than fetched twice.
 */

export interface AssetExportWorkbookInput {
  readonly query: AssetExportQueryInput;
  readonly isAdmin: boolean;
  readonly columns: readonly AssetExportColumn[];
  readonly headers: readonly string[];
  readonly labels: AssetExportLabels;
  readonly sheetName: string;
}

type ChunkIterator = AsyncGenerator<readonly AssetExportSource[]>;

function toCells(
  rows: readonly AssetExportSource[],
  input: AssetExportWorkbookInput,
): readonly (readonly XlsxCell[])[] {
  return rows.map((row) =>
    toAssetExportCells(row, input.columns, input.labels),
  );
}

/** The measured first chunk, then everything the cursor has left. */
async function* streamRows(
  firstRows: readonly (readonly XlsxCell[])[],
  remaining: ChunkIterator,
  input: AssetExportWorkbookInput,
): AsyncGenerator<readonly XlsxCell[]> {
  yield* firstRows;
  for await (const chunk of remaining) {
    yield* toCells(chunk, input);
  }
}

/** `measureColumnWidths` returns one width per header, in the same order. */
function toXlsxColumns(
  headers: readonly string[],
  widths: readonly number[],
): readonly XlsxColumn[] {
  return headers.map((header, index) => ({ header, width: widths[index] }));
}

export async function buildAssetExportStream(
  input: AssetExportWorkbookInput,
): Promise<ReadableStream<Uint8Array>> {
  const chunks = iterateAssetExportChunks(input.query, input.isAdmin);
  const first = await chunks.next();
  const firstRows = first.done ? [] : toCells(first.value, input);
  const widths = measureColumnWidths(input.headers, firstRows);

  return createXlsxStream({
    sheetName: input.sheetName,
    columns: toXlsxColumns(input.headers, widths),
    rows: streamRows(firstRows, chunks, input),
  });
}
