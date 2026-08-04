import fs from "node:fs"
import path from "node:path"

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const buf = fs.readFileSync(logoPath)

console.log("Hex header:", buf.subarray(0, 32).toString("hex"))
console.log("Text header:", buf.subarray(0, 100).toString("utf-8"))
