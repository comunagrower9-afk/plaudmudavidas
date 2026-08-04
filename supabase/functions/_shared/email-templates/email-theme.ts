/**
 * Design Tokens e Identidade Visual Premium para E-mails da PLAUD
 * Baseado na linguagem visual de alta tecnologia da landing page do Plaud Note:
 * Editorial, minimalista, alto contraste, hero dark navy #0b1020, tipografia robusta.
 */
export const EMAIL_THEME = {
  colors: {
    // Hero & Footer Dark Navy
    heroBackground: "#0b1020",
    heroTextPrimary: "#ffffff",
    heroTextSecondary: "#cbd5e1",
    heroTagline: "#94a3b8",

    // Top Bar & Body
    topBarBackground: "#ffffff",
    bodyBackground: "#ffffff",
    outerBackground: "#0b1020",

    // Card e Seção de Produto Suave
    productSectionBackground: "#f7f8fa",
    cardBackground: "#f8fafc",

    // Bordas e Divisórias Sutis
    divider: "#edf2f7",
    borderLight: "#e2e8f0",

    // Tipografia Geral
    textPrimary: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#64748b",
    textSubtle: "#94a3b8",

    // Status e Destaques
    successBadgeBg: "#064e3b",
    successBadgeBorder: "#059669",
    successBadgeText: "#34d399",
    successGreen: "#047857",
    successGreenBg: "#ecfdf5",
    badgeShippedColor: "#93c5fd",
    badgeShippedBg: "rgba(255, 255, 255, 0.08)",
    badgeShippedBorder: "rgba(255, 255, 255, 0.18)",

    // Timeline
    timelineActiveCircle: "#047857",
    timelineActiveText: "#047857",
    timelineInactiveCircle: "#e2e8f0",
    timelineInactiveBorder: "#cbd5e1",
    timelineInactiveText: "#64748b",
    timelineLine: "#e2e8f0",
  },
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    heroTitleSize: "32px",
    heroTitleLineHeight: "1.25",
    sectionTitleSize: "20px",
    productTitleSize: "18px",
    bodySize: "15px",
    bodyLineHeight: "1.6",
    smallSize: "13px",
    labelSize: "11px",
  },
  assets: {
    siteUrl: "https://www.plaudai.site",
    logoDarkUrl: "https://www.plaudai.site/images/logo.png",
    logoWhiteUrl: "https://www.plaudai.site/images/email/logo-white.png",
    heroProductImageUrl: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
    productItemImageUrl: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
  },
  dimensions: {
    containerMaxWidth: "600px",
    logoTopWidth: "130",
    logoTopHeight: "22",
    logoFooterWidth: "118",
    logoFooterHeight: "20",
    heroProductWidth: "300",
    heroProductHeight: "300",
    heroImageWidth: "300",
    heroImageHeight: "300",
    productItemWidth: "150",
    productItemHeight: "150",
  },
}
