import fs from "node:fs"
import path from "node:path"

const EMAIL_DIR = path.join(process.cwd(), "public", "images", "email")
const darkPath = path.join(EMAIL_DIR, "plaud-logo-dark-v2.png")
const lightPath = path.join(EMAIL_DIR, "plaud-logo-light-v2.png")

const darkBuf = fs.readFileSync(darkPath)
const lightBuf = fs.readFileSync(lightPath)

console.log("Dark logo size:", darkBuf.length, "bytes")
console.log("Light logo size:", lightBuf.length, "bytes")

// Ler PNG IHDR
const parsePng = (buf: Buffer, name: string) => {
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf.readUInt8(24)
  const colorType = buf.readUInt8(25)
  console.log(`${name}: ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}`)
}

parsePng(darkBuf, "Dark logo")
parsePng(lightBuf, "Light logo")
