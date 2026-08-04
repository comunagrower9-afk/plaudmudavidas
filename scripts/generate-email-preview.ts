import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import { execSync } from "node:child_process"
import { renderOrderConfirmedEmail } from "../supabase/functions/_shared/email-templates/order-confirmed.ts"
import { renderOrderShippedEmail } from "../supabase/functions/_shared/email-templates/order-shipped.ts"

const PREVIEWS_DIR = path.join(process.cwd(), "email-previews")
const PUBLIC_DIR = path.join(process.cwd(), "public")

if (!fs.existsSync(PREVIEWS_DIR)) {
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true })
}

console.log("=== GERANDO PREVIEWS E SCREENSHOTS DE E-MAILS ===")

// ============================================================================
// 1. TEMPLATE: PEDIDO CONFIRMADO (order-confirmed.html)
// ============================================================================
const standardOrderConfirmedData = {
  order_number: "VCS1O8WQ3EI",
  customer_name: "Carlos Silva",
  customer_email: "carlos.silva.preview@example.com",
  total: 119.90,
  subtotal: 119.90,
  created_at: "2026-08-04T05:30:00.000Z",
  payment_method: "pix",
  shipping_address: {
    street: "Rua Fictícia das Palmeiras",
    number: "123",
    complement: "Apt 45",
    neighborhood: "Jardim Primavera",
    city: "São Paulo",
    state: "SP",
    zip_code: "01452-002",
  },
  items: [
    {
      product_name: "Plaud Note — Cinza",
      quantity: 1,
      unit_price: 119.90,
      sku: "PLAUD-NOTE-GRAY",
    },
  ],
}

const standardOrderConfirmed = renderOrderConfirmedEmail(standardOrderConfirmedData)
const standardOrderConfirmedPath = path.join(PREVIEWS_DIR, "order-confirmed.html")
fs.writeFileSync(standardOrderConfirmedPath, standardOrderConfirmed.html, "utf-8")
console.log(`✓ Preview order-confirmed gerado: ${standardOrderConfirmedPath}`)

// Variações de Pedido Confirmado
const variationsOrderConfirmedData = {
  order_number: "VG-2998811",
  customer_name: null,
  customer_email: "cliente.variacao@example.com",
  total: 219.70,
  subtotal: 219.70,
  created_at: "2026-08-04T08:15:00.000Z",
  payment_method: "credit_card",
  shipping_address: {
    street: "Av. Beira Mar",
    neighborhood: "Centro",
    city: "Florianópolis",
    state: "SC",
    zip_code: "88015-100",
  },
  items: [
    {
      product_name: "PLAUD NOTE AI Voice Recorder (Preto)",
      quantity: 1,
      unit_price: 119.90,
      sku: "PLAUD-NOTE-BLACK",
    },
    {
      product_name: "Acessório Especial Case MagSafe",
      quantity: 2,
      unit_price: 49.90,
      sku: "ACC-MAGSAFE-CASE",
    },
  ],
}

const variationsOrderConfirmed = renderOrderConfirmedEmail(variationsOrderConfirmedData)
const variationsOrderConfirmedPath = path.join(PREVIEWS_DIR, "order-confirmed-variations.html")
fs.writeFileSync(variationsOrderConfirmedPath, variationsOrderConfirmed.html, "utf-8")
console.log(`✓ Preview order-confirmed com variações gerado: ${variationsOrderConfirmedPath}`)

// ============================================================================
// 2. TEMPLATE: PEDIDO ENVIADO (order-shipped.html)
// ============================================================================
const standardOrderShippedData = {
  order_number: "VCS1O8WQ3EI",
  customer_name: "Carlos Silva",
  customer_email: "carlos.silva.preview@example.com",
  tracking_code: "NL123456789BR",
  tracking_url: "https://www.17track.net/pt?nums=NL123456789BR",
  carrier: "Correios",
  shipped_at: "2026-08-04T10:00:00.000Z",
  estimated_delivery_start: "2026-08-09T00:00:00.000Z",
  estimated_delivery_end: "2026-08-14T00:00:00.000Z",
  shipping_address: {
    street: "Rua Fictícia das Palmeiras",
    number: "123",
    complement: "Apt 45",
    neighborhood: "Jardim Primavera",
    city: "São Paulo",
    state: "SP",
    zip_code: "01452-002",
  },
  items: [
    {
      product_name: "Plaud Note — Cinza",
      quantity: 1,
      unit_price: 119.90,
      sku: "PLAUD-NOTE-GRAY",
    },
  ],
}

const standardOrderShipped = renderOrderShippedEmail(standardOrderShippedData)
const standardOrderShippedPath = path.join(PREVIEWS_DIR, "order-shipped.html")
fs.writeFileSync(standardOrderShippedPath, standardOrderShipped.html, "utf-8")
console.log(`✓ Preview order-shipped gerado: ${standardOrderShippedPath}`)

// Variações de Pedido Enviado (Sem carrier opcional, sem previsão opcional, múltiplos produtos)
const variationsOrderShippedData = {
  order_number: "VG-2998811",
  customer_name: null,
  customer_email: "cliente.variacao@example.com",
  tracking_code: "LB987654321HK",
  tracking_url: null, // Teste de fallback seguro para URL canônica 17TRACK
  carrier: null, // Sem transportadora informada
  shipped_at: "2026-08-04T11:30:00.000Z",
  estimated_delivery_start: null,
  estimated_delivery_end: null,
  shipping_address: {
    street: "Av. Beira Mar",
    neighborhood: "Centro",
    city: "Florianópolis",
    state: "SC",
    zip_code: "88015-100",
  },
  items: [
    {
      product_name: "PLAUD NOTE AI Voice Recorder (Preto)",
      quantity: 1,
      unit_price: 119.90,
      sku: "PLAUD-NOTE-BLACK",
    },
    {
      product_name: "Acessório Especial Case MagSafe",
      quantity: 2,
      unit_price: 49.90,
      sku: "ACC-MAGSAFE-CASE",
    },
  ],
}

const variationsOrderShipped = renderOrderShippedEmail(variationsOrderShippedData)
const variationsOrderShippedPath = path.join(PREVIEWS_DIR, "order-shipped-variations.html")
fs.writeFileSync(variationsOrderShippedPath, variationsOrderShipped.html, "utf-8")
console.log(`✓ Preview order-shipped com variações gerado: ${variationsOrderShippedPath}`)

// ============================================================================
// 3. SERVIDOR LOCAL E CAPTURA DE SCREENSHOTS HEADLESS
// ============================================================================
async function captureScreenshots() {
  let dynamicPort = 0

  const server = http.createServer((req, res) => {
    const reqUrl = req.url?.split("?")[0] || "/"

    if (reqUrl === "/" || reqUrl === "/order-confirmed.html") {
      const localHtml = standardOrderConfirmed.html.replace(/https:\/\/www\.plaudai\.site/g, `http://localhost:${dynamicPort}`)
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(localHtml)
      return
    }

    if (reqUrl === "/order-shipped.html") {
      const localHtml = standardOrderShipped.html.replace(/https:\/\/www\.plaudai\.site/g, `http://localhost:${dynamicPort}`)
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(localHtml)
      return
    }

    // Serve arquivos estáticos de public/ (imagens da Plaud, logos, etc.)
    const filePath = path.join(PUBLIC_DIR, reqUrl)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      }
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" })
      fs.createReadStream(filePath).pipe(res)
      return
    }

    res.writeHead(404)
    res.end("Not Found")
  })

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as { port: number }
      dynamicPort = addr.port
      resolve()
    })
  })
  console.log(`Servidor de preview ativo em http://localhost:${dynamicPort}`)

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  const browserExe = fs.existsSync(chromePath) ? chromePath : edgePath

  const confirmedMobilePath = path.resolve(PREVIEWS_DIR, "order-confirmed-mobile.png")
  const confirmedDesktopPath = path.resolve(PREVIEWS_DIR, "order-confirmed-desktop.png")
  const shippedMobilePath = path.resolve(PREVIEWS_DIR, "order-shipped-mobile.png")
  const shippedDesktopPath = path.resolve(PREVIEWS_DIR, "order-shipped-desktop.png")

  try {
    console.log("Capturando screenshots de 'order-confirmed'...")
    execSync(`"${browserExe}" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size=375,1750 --hide-scrollbars --screenshot="${confirmedMobilePath}" http://localhost:${dynamicPort}/order-confirmed.html`, { stdio: "inherit" })
    execSync(`"${browserExe}" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size=700,1650 --hide-scrollbars --screenshot="${confirmedDesktopPath}" http://localhost:${dynamicPort}/order-confirmed.html`, { stdio: "inherit" })

    console.log("Capturando screenshots de 'order-shipped'...")
    execSync(`"${browserExe}" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size=375,1900 --hide-scrollbars --screenshot="${shippedMobilePath}" http://localhost:${dynamicPort}/order-shipped.html`, { stdio: "inherit" })
    execSync(`"${browserExe}" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size=700,1800 --hide-scrollbars --screenshot="${shippedDesktopPath}" http://localhost:${dynamicPort}/order-shipped.html`, { stdio: "inherit" })
  } catch (err) {
    console.warn("Screenshot capture notice:", err)
  }

  server.close()

  console.log("\n✓ Resumo de arquivos gerados:")
  console.log(`  - HTML: ${standardOrderConfirmedPath}`)
  console.log(`  - HTML: ${variationsOrderConfirmedPath}`)
  console.log(`  - HTML: ${standardOrderShippedPath}`)
  console.log(`  - HTML: ${variationsOrderShippedPath}`)
  if (fs.existsSync(confirmedMobilePath)) console.log(`  - PNG: ${confirmedMobilePath} (${(fs.statSync(confirmedMobilePath).size / 1024).toFixed(1)} KB)`)
  if (fs.existsSync(confirmedDesktopPath)) console.log(`  - PNG: ${confirmedDesktopPath} (${(fs.statSync(confirmedDesktopPath).size / 1024).toFixed(1)} KB)`)
  if (fs.existsSync(shippedMobilePath)) console.log(`  - PNG: ${shippedMobilePath} (${(fs.statSync(shippedMobilePath).size / 1024).toFixed(1)} KB)`)
  if (fs.existsSync(shippedDesktopPath)) console.log(`  - PNG: ${shippedDesktopPath} (${(fs.statSync(shippedDesktopPath).size / 1024).toFixed(1)} KB)`)
}

captureScreenshots().then(() => {
  console.log("\nTODOS OS PREVIEWS FORAM CONCLUÍDOS COM SUCESSO!")
}).catch((err) => {
  console.error("Erro ao gerar screenshots:", err)
  process.exit(1)
})
