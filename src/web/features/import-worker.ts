import Papa from "papaparse";
import { readSheet } from "read-excel-file/web-worker";

// Reject oversized ZIP metadata before the XLSX parser allocates worksheet XML.
function checkWorkbook(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let end = -1;
  for (let at = buffer.byteLength - 22; at >= Math.max(0, buffer.byteLength - 65557); at--) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0)
    throw new Error("zip");
  const count = view.getUint16(end + 10, true);
  if (count > 1000) throw new Error("zip");
  let at = view.getUint32(end + 16, true);
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (
      at + 46 > end ||
      view.getUint32(at, true) !== 0x02014b50 ||
      view.getUint16(at + 8, true) & 1
    )
      throw new Error("zip");
    expanded += view.getUint32(at + 24, true);
    if (expanded > 20 * 1024 * 1024) throw new Error("size");
    at +=
      46 +
      view.getUint16(at + 28, true) +
      view.getUint16(at + 30, true) +
      view.getUint16(at + 32, true);
  }
  if (at > end) throw new Error("zip");
}
self.onmessage = async (event: MessageEvent<{ name: string; buffer: ArrayBuffer }>) => {
  try {
    const { name, buffer } = event.data;
    if (buffer.byteLength > 2 * 1024 * 1024) throw new Error("size");
    let rows: unknown[][];
    if (name.toLowerCase().endsWith(".xlsx")) {
      checkWorkbook(buffer);
      rows = await readSheet(buffer, 1);
    } else if (name.toLowerCase().endsWith(".csv")) {
      const result = Papa.parse<string[]>(
        new TextDecoder("utf-8", { fatal: true }).decode(buffer),
        { skipEmptyLines: "greedy", preview: 502 },
      );
      if (result.errors.length) throw new Error("csv");
      rows = result.data;
    } else throw new Error("format");
    if (rows.length < 2 || rows.length > 501 || rows.some((r) => r.length > 100))
      throw new Error("rows");
    const values = rows.map((r) =>
      r.map((cell) => {
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        const value = cell == null ? "" : String(cell);
        if (value.length > 10000) throw new Error("cell");
        return value;
      }),
    );
    self.postMessage({ rows: values });
  } catch {
    self.postMessage({ error: "file_error" });
  }
};
