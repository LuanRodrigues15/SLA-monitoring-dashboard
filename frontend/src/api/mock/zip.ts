// Gera um arquivo ZIP real (método "store", sem compressão) inteiramente no navegador,
// para que o download de demonstração abra normalmente em qualquer leitor de ZIP.
// Sem dependência externa: o formato ZIP sem compressão é simples o suficiente para montar à mão.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

export function buildZip(files: { name: string; content: string }[]): Blob {
  const encoder = new TextEncoder()
  const entries: ZipEntry[] = files.map((f) => ({ name: f.name, data: encoder.encode(f.content) }))

  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0, true) // flags
    local.setUint16(8, 0, true) // method = store
    local.setUint16(10, 0, true) // time
    local.setUint16(12, 0x21, true) // date (valor fixo, irrelevante para o demo)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true) // compressed size
    local.setUint32(22, size, true) // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true) // extra length

    localChunks.push(new Uint8Array(local.buffer), nameBytes, entry.data)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true) // version made by
    central.setUint16(6, 20, true) // version needed
    central.setUint16(8, 0, true) // flags
    central.setUint16(10, 0, true) // method
    central.setUint16(12, 0, true) // time
    central.setUint16(14, 0x21, true) // date
    central.setUint32(16, crc, true)
    central.setUint32(20, size, true)
    central.setUint32(24, size, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint16(30, 0, true) // extra length
    central.setUint16(32, 0, true) // comment length
    central.setUint16(34, 0, true) // disk number
    central.setUint16(36, 0, true) // internal attrs
    central.setUint32(38, 0, true) // external attrs
    central.setUint32(42, offset, true) // offset of local header

    centralChunks.push(new Uint8Array(central.buffer), nameBytes)

    offset += local.buffer.byteLength + nameBytes.length + entry.data.length
  }

  const centralSize = centralChunks.reduce((a, c) => a + c.length, 0)
  const centralOffset = offset

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(4, 0, true) // disk number
  end.setUint16(6, 0, true) // disk with central dir
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, centralOffset, true)
  end.setUint16(20, 0, true) // comment length

  const all = [...localChunks, ...centralChunks, new Uint8Array(end.buffer)]
  const total = all.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const chunk of all) {
    out.set(chunk, pos)
    pos += chunk.length
  }
  return new Blob([out], { type: 'application/zip' })
}
