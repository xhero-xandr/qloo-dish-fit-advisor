// Just enough of the zip format to read one file out of a .docx or .xlsx: the central directory,
// stored and deflated entries, and a cap on how much an entry may inflate to.

import { inflateRawSync } from "node:zlib";

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function entries(buf: Buffer): Entry[] {
  // The end record is the last 22 bytes, unless a comment (at most 65535 bytes) follows it.
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === END_OF_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) return [];
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const list: Entry[] = [];
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== DIRECTORY_ENTRY) break;
    const nameLength = buf.readUInt16LE(p + 28);
    list.push({
      name: buf.toString("utf8", p + 46, p + 46 + nameLength),
      method: buf.readUInt16LE(p + 10),
      compressedSize: buf.readUInt32LE(p + 20),
      localOffset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return list;
}

export function zipEntryNames(buf: Buffer): string[] {
  return entries(buf).map((e) => e.name);
}

/** The bytes of one entry, or undefined if it is missing, unreadable, or would inflate past `maxBytes`. */
export function readZipEntry(buf: Buffer, name: string, maxBytes: number): Buffer | undefined {
  const entry = entries(buf).find((e) => e.name === name);
  if (!entry) return undefined;
  const p = entry.localOffset;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== LOCAL_HEADER) return undefined;
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + entry.compressedSize);
  try {
    if (entry.method === 0) return data.length <= maxBytes ? data : undefined;
    if (entry.method === 8) return inflateRawSync(data, { maxOutputLength: maxBytes });
  } catch {
    // Corrupt, or larger than maxBytes.
  }
  return undefined;
}
