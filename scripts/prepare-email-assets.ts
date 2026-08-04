import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const EMAIL_IMAGES_DIR = path.join(process.cwd(), "public", "images", "email")
if (!fs.existsSync(EMAIL_IMAGES_DIR)) {
  fs.mkdirSync(EMAIL_IMAGES_DIR, { recursive: true })
}

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const browserExe = fs.existsSync(chromePath) ? chromePath : edgePath

// 1. Gerar plaud-note-confirmed.png
const generatorHtmlPath = path.join(process.cwd(), "scripts", "temp-asset-generator.html")
const sourceImageUri = "file:///" + path.join(process.cwd(), "public", "images", "1.webp").replace(/\\/g, "/")
const logoSourceUri = "file:///" + path.join(process.cwd(), "public", "images", "logo.png").replace(/\\/g, "/")

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    #canvas { width: 900px; height: 900px; }
  </style>
</head>
<body>
  <canvas id="canvas" width="900" height="900"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = "${sourceImageUri}";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 900, 900);
      document.title = "READY";
    };
  </script>
</body>
</html>
`
fs.writeFileSync(generatorHtmlPath, htmlContent, "utf-8")

const outputAssetPath = path.join(EMAIL_IMAGES_DIR, "plaud-note-confirmed.png")
const cmd = `"${browserExe}" --headless --disable-gpu --force-device-scale-factor=1 --window-size=900,900 --default-background-color=00000000 --screenshot="${outputAssetPath}" "file:///${generatorHtmlPath.replace(/\\/g, "/")}"`
execSync(cmd, { stdio: "inherit" })

// 2. Gerar logo-white.png (Logo PLAUD em branco com transparência para o footer escuro)
const logoWhiteHtmlPath = path.join(process.cwd(), "scripts", "temp-logo-generator.html")
const logoWhiteHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    #canvas { width: 350px; height: 60px; }
  </style>
</head>
<body>
  <canvas id="canvas" width="350" height="60"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = "${logoSourceUri}";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 350, 60);
      const imgData = ctx.getImageData(0, 0, 350, 60);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 10) {
          // Converte pixels escuros em branco puro mantendo a transparência
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      document.title = "READY";
    };
  </script>
</body>
</html>
`
fs.writeFileSync(logoWhiteHtmlPath, logoWhiteHtml, "utf-8")

const outputLogoWhitePath = path.join(EMAIL_IMAGES_DIR, "logo-white.png")
const logoCmd = `"${browserExe}" --headless --disable-gpu --force-device-scale-factor=1 --window-size=350,60 --default-background-color=00000000 --screenshot="${outputLogoWhitePath}" "file:///${logoWhiteHtmlPath.replace(/\\/g, "/")}"`
execSync(logoCmd, { stdio: "inherit" })

// Limpar temporários
if (fs.existsSync(generatorHtmlPath)) fs.unlinkSync(generatorHtmlPath)
if (fs.existsSync(logoWhiteHtmlPath)) fs.unlinkSync(logoWhiteHtmlPath)

console.log("✓ Assets de e-mail gerados com sucesso na pasta public/images/email/")
