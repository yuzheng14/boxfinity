import assert from 'node:assert/strict';
import { crc32 } from '../../src/zip.ts';

// Boxfinity exports stored (uncompressed) ZIP entries. Check the container and CRCs,
// then inspect its contents rather than just asserting that a download exists.
export function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    assert.equal(view.getUint16(offset + 8, true), 0);
    const length = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extra = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extra;
    const data = bytes.slice(start, start + length);
    assert.equal(crc32(data), view.getUint32(offset + 14, true));
    assert.ok(!files.has(name), `duplicate ZIP entry: ${name}`);
    files.set(name, data);
    offset = start + length;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), files.size);
  return files;
}

export function entry(files: Map<string, Uint8Array>, name: string): Uint8Array {
  const data = files.get(name);
  assert.ok(data, `missing ZIP entry: ${name}`);
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function record(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value), 'expected a JSON object');
  return value;
}
export function array(value: unknown): unknown[] {
  assert.ok(Array.isArray(value), 'expected a JSON array');
  return value;
}
export function records(value: unknown): Record<string, unknown>[] {
  return array(value).map(record);
}
export function readJSON(bytes: Uint8Array): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return record(value);
}
