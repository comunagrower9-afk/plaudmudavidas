import fs from "node:fs"

console.log("Checking modules...")
const check = (pkg: string) => {
  try {
    import(pkg)
    return true
  } catch {
    return false
  }
}

console.log({
  sharp: check("sharp"),
  playwright: check("playwright"),
  puppeteer: check("puppeteer"),
})
