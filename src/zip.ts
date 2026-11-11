// Minimal ZIP32 writer, stored entries with CRC32. OPC / 3MF permits method 0.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(entries: { name: string; data: string | Uint8Array }[]) {
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0, centralSize = 0;
  const header = (size: number) => { const bytes = new Uint8Array(size); return [bytes, new DataView(bytes.buffer)] as const; };
  for (const entry of entries) {
    const name = encoder.encode(entry.name), data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(data);
    const [local, l] = header(30);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
    l.setUint16(12, 0x21, true); l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
    parts.push(local, name, data);
    const [record, c] = header(46);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(record, name); centralSize += 46 + name.length;
    offset += 30 + name.length + data.length;
  }
  const [end, e] = header(22);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const all = [...parts, ...central, end], output = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const part of all) { output.set(part, cursor); cursor += part.length; }
  return output;
}
