import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import { execSync } from "node:child_process"

const EMAIL_DIR = path.join(process.cwd(), "public", "images", "email")
if (!fs.existsSync(EMAIL_DIR)) {
  fs.mkdirSync(EMAIL_DIR, { recursive: true })
}

const logoRawBuf = fs.readFileSync(path.join(process.cwd(), "public", "images", "logo.png"))
const logoBase64 = `data:image/webp;base64,${logoRawBuf.toString("base64")}`

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const browserExe = fs.existsSync(chromePath) ? chromePath : edgePath

console.log("=== GERANDO LOGOS OPACOS PARA E-MAIL (V2) ===")

async function run() {
  let dynamicPort = 0
  let resolveDone: () => void
  const donePromise = new Promise<void>((res) => {
    resolveDone = res
  })

  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0; background:#333;">
  <img id="srcImg" src="${logoBase64}" />
  <canvas id="cDark" width="480" height="96"></canvas>
  <canvas id="cLight" width="480" height="96"></canvas>
  <script>
    window.onload = function() {
      const img = document.getElementById('srcImg');
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      // 1. Extrair os limites da logo original (bounding box)
      const tempC = document.createElement('canvas');
      tempC.width = imgW;
      tempC.height = imgH;
      const tCtx = tempC.getContext('2d');
      tCtx.drawImage(img, 0, 0);
      const imgData = tCtx.getImageData(0, 0, imgW, imgH);
      const origData = imgData.data;

      let minX = imgW, maxX = 0, minY = imgH, maxY = 0;
      let nonZeroAlpha = 0;

      for (let y = 0; y < imgH; y++) {
        for (let x = 0; x < imgW; x++) {
          const idx = (y * imgW + x) * 4;
          const a = origData[idx + 3];
          if (a > 10) {
            nonZeroAlpha++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      console.log('Original bounding box:', { imgW, imgH, minX, maxX, minY, maxY, nonZeroAlpha });

      const cropW = (maxX - minX + 1);
      const cropH = (maxY - minY + 1);

      const targetW = 480;
      const targetH = 96;

      // Escala para ocupar bem o espaço mantendo proporção e margens limpas
      const scale = Math.min((targetW - 36) / cropW, (targetH - 20) / cropH);
      const drawW = cropW * scale;
      const drawH = cropH * scale;
      const drawX = (targetW - drawW) / 2;
      const drawY = (targetH - drawH) / 2;

      // =========================================================================
      // A. LOGO ESCURA: Fundo 100% Branco Puro (#ffffff), Letras Dark Navy (#0b1020)
      // =========================================================================
      const cDark = document.getElementById('cDark');
      const ctxDark = cDark.getContext('2d');
      // Preenchimento opaco branco
      ctxDark.fillStyle = '#ffffff';
      ctxDark.fillRect(0, 0, targetW, targetH);

      const cropC = document.createElement('canvas');
      cropC.width = cropW;
      cropC.height = cropH;
      const cropCtx = cropC.getContext('2d');
      cropCtx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      ctxDark.drawImage(cropC, 0, 0, cropW, cropH, drawX, drawY, drawW, drawH);

      const darkImgData = ctxDark.getImageData(0, 0, targetW, targetH);
      const d = darkImgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const letterFactor = 1 - lum; // 0 = fundo branco, 1 = letra

        // Fundo: #ffffff (255,255,255), Letras: #0b1020 (11,16,32)
        d[i] = Math.round(255 - letterFactor * (255 - 11));
        d[i + 1] = Math.round(255 - letterFactor * (255 - 16));
        d[i + 2] = Math.round(255 - letterFactor * (255 - 32));
        d[i + 3] = 255; // 100% OPACO, ZERO TRANSPARÊNCIA
      }
      ctxDark.putImageData(darkImgData, 0, 0);

      // =========================================================================
      // B. LOGO CLARA: Fundo 100% Navy (#0b1020), Letras Branco Puro (#ffffff)
      // =========================================================================
      const cLight = document.getElementById('cLight');
      const ctxLight = cLight.getContext('2d');
      // Preenchimento opaco navy
      ctxLight.fillStyle = '#0b1020';
      ctxLight.fillRect(0, 0, targetW, targetH);

      const lightImgData = ctxLight.getImageData(0, 0, targetW, targetH);
      const ld = lightImgData.data;

      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const idx = (y * targetW + x) * 4;
          const origCropX = Math.round((x - drawX) / scale);
          const origCropY = Math.round((y - drawY) / scale);

          let letterFactor = 0;
          if (origCropX >= 0 && origCropX < cropW && origCropY >= 0 && origCropY < cropH) {
            const srcIdx = ((minY + origCropY) * imgW + (minX + origCropX)) * 4;
            const a = origData[srcIdx + 3];
            const r = origData[srcIdx];
            const g = origData[srcIdx + 1];
            const b = origData[srcIdx + 2];
            const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            letterFactor = (a / 255) * (1 - lum);
          }

          // Fundo: #0b1020 (11,16,32), Letras: #ffffff (255,255,255)
          ld[idx] = Math.round(11 + letterFactor * (255 - 11));
          ld[idx + 1] = Math.round(16 + letterFactor * (255 - 16));
          ld[idx + 2] = Math.round(32 + letterFactor * (255 - 32));
          ld[idx + 3] = 255; // 100% OPACO, ZERO TRANSPARÊNCIA
        }
      }
      ctxLight.putImageData(lightImgData, 0, 0);

      const darkData = cDark.toDataURL('image/png');
      const lightData = cLight.toDataURL('image/png');

      fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ darkData, lightData, cropW, cropH })
      });
    };
  </script>
</body>
</html>
`
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(html)
      return
    }

    if (req.url === "/save" && req.method === "POST") {
      let body = ""
      req.on("data", (chunk) => (body += chunk))
      req.on("end", () => {
        const payload = JSON.parse(body)
        const darkBase64 = payload.darkData.replace(/^data:image\/png;base64,/, "")
        const lightBase64 = payload.lightData.replace(/^data:image\/png;base64,/, "")

        const darkPath = path.join(EMAIL_DIR, "plaud-logo-dark-v2.png")
        const lightPath = path.join(EMAIL_DIR, "plaud-logo-light-v2.png")

        fs.writeFileSync(darkPath, Buffer.from(darkBase64, "base64"))
        fs.writeFileSync(lightPath, Buffer.from(lightBase64, "base64"))

        console.log(`✓ Salvo: ${darkPath} (${(fs.statSync(darkPath).size / 1024).toFixed(1)} KB)`)
        console.log(`✓ Salvo: ${lightPath} (${(fs.statSync(lightPath).size / 1024).toFixed(1)} KB)`)
        console.log(`  Dimensões: 480x96 px | Modo: RGB 100% Opaco (Sem Alpha / Sem Transparência)`)

        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ success: true }))
        resolveDone()
      })
      return
    }

    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((res) => {
    server.listen(0, () => {
      dynamicPort = (server.address() as { port: number }).port
      res()
    })
  })

  console.log(`Servidor de geração ativo na porta ${dynamicPort}. Disparando navegador...`)
  const cmd = `"${browserExe}" --headless --disable-gpu "http://localhost:${dynamicPort}/index.html"`

  // Executa em segundo plano e aguarda resposta no endpoint /save
  try {
    execSync(cmd, { stdio: "ignore", timeout: 8000 })
  } catch {
    // Timeout ou saída esperada
  }

  await Promise.race([
    donePromise,
    new Promise((res) => setTimeout(res, 5000)),
  ])

  server.close()
  console.log("=== GERAÇÃO CONCLUÍDA ===")
}

run().catch(console.error)
