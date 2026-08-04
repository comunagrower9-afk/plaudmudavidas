import fs from "node:fs"
import path from "node:path"

function getImageDimensions(buffer: Buffer): { width: number; height: number; type: string } | null {
  // PNG: Width at byte 16, Height at byte 20 (4 bytes big-endian)
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    return { width, height, type: "png" }
  }

  // JPEG
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      // SOF0, SOF1, SOF2 markers
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        const height = buffer.readUInt16BE(offset + 5)
        const width = buffer.readUInt16BE(offset + 7)
        return { width, height, type: "jpg" }
      }
      const length = buffer.readUInt16BE(offset + 2)
      offset += 2 + length
    }
    return { width: 0, height: 0, type: "jpg" }
  }

  // WebP
  if (buffer.length > 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const vp8 = buffer.toString("ascii", 12, 16)
    if (vp8 === "VP8 ") {
      const width = buffer.readUInt16LE(26) & 0x3fff
      const height = buffer.readUInt16LE(28) & 0x3fff
      return { width, height, type: "webp" }
    } else if (vp8 === "VP8L") {
      const b1 = buffer[21]
      const b2 = buffer[22]
      const b3 = buffer[23]
      const b4 = buffer[24]
      const width = 1 + (((b2 & 0x3f) << 8) | b1)
      const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      return { width, height, type: "webp" }
    } else if (vp8 === "VP8X") {
      const width = 1 + buffer.readUIntLE(24, 3)
      const height = 1 + buffer.readUIntLE(27, 3)
      return { width, height, type: "webp" }
    }
    return { width: 0, height: 0, type: "webp" }
  }

  return null
}

const imagesDir = path.join(process.cwd(), "public", "images")
const appTsx = fs.readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf-8")

const files = fs.readdirSync(imagesDir)
const results: any[] = []

for (const file of files) {
  const filePath = path.join(imagesDir, file)
  const stat = fs.statSync(filePath)
  if (stat.isFile()) {
    const buffer = fs.readFileSync(filePath)
    const dim = getImageDimensions(buffer)
    const usageCount = (appTsx.match(new RegExp(file, "g")) || []).length
    results.push({
      name: file,
      sizeKB: (stat.size / 1024).toFixed(1) + " KB",
      width: dim?.width || "unknown",
      height: dim?.height || "unknown",
      format: dim?.type || path.extname(file).replace(".", ""),
      usedInApp: usageCount > 0 ? `Sim (${usageCount}x)` : "Não diretamente",
    })
  }
}

console.table(results)
