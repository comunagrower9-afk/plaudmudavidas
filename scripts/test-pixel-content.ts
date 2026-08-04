import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

// Vamos verificar os pixels usando um script que lê o canvas em headless Chrome
const darkPath = path.join(process.cwd(), "public", "images", "email", "plaud-logo-dark-v2.png")
const htmlPath = path.join(process.cwd(), "scripts", "temp-verify.html")

const html = `
<!DOCTYPE html>
<html>
<body>
  <img id="img" src="file:///${darkPath.replace(/\\/g, "/")}" />
  <script>
    const img = document.getElementById('img');
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonWhite = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 240 || data[i+1] < 240 || data[i+2] < 240) {
          nonWhite++;
        }
      }
      console.log('NON_WHITE_PIXELS:' + nonWhite);
    };
  </script>
</body>
</html>
`
fs.writeFileSync(htmlPath, html)

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const res = execSync(`"${chromePath}" --headless --disable-gpu --enable-logging=stderr --v=1 "file:///${htmlPath.replace(/\\/g, "/")}"`, { encoding: "utf-8" })
console.log(res)
