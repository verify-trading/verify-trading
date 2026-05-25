import { escapeHtml } from "@/lib/email/escape-html";

const EMAIL_BACKGROUND = "#0A0D2E";
const EMAIL_CARD = "#0F1340";
const EMAIL_BORDER = "rgba(76,110,245,0.22)";
const EMAIL_CORAL = "#F26D6D";
const EMAIL_TEXT = "#FFFFFF";
const EMAIL_MUTED = "#C9D0E8";
const EMAIL_LABEL = "#8892B0";

type EmailButton = {
  href: string;
  label: string;
};

type MarketingEmailInput = {
  appName: string;
  appOrigin: string;
  title: string;
  preview: string;
  paragraphs: string[];
  button: EmailButton;
  footer?: string;
};

function buildParagraph(text: string) {
  return `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.55;color:${EMAIL_MUTED};">${escapeHtml(text)}</p>`;
}

export function buildMarketingEmailHtml({
  appName,
  appOrigin,
  title,
  preview,
  paragraphs,
  button,
  footer,
}: MarketingEmailInput) {
  const normalizedAppOrigin = appOrigin.replace(/\/$/, "");
  const logoOrigin = normalizedAppOrigin.replace(
    "https://verify.trading",
    "https://www.verify.trading",
  );
  const logoUrl = `${logoOrigin}/verify-trading-email-logo.png`;
  const body = paragraphs.map(buildParagraph).join("");
  const footerHtml = footer
    ? `<p style="margin:16px 0 0 0;font-size:12px;line-height:1.45;color:${EMAIL_LABEL};">${escapeHtml(footer)}</p>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_BACKGROUND};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${EMAIL_BACKGROUND};margin:0;padding:24px 14px;">
      <tr>
        <td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:${EMAIL_CARD};border:1px solid ${EMAIL_BORDER};border-radius:14px;">
            <tr>
              <td style="padding:24px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
                  <tr>
                    <td width="36" style="vertical-align:middle;width:36px;">
                      <img src="${escapeHtml(logoUrl)}" width="36" height="36" alt="${escapeHtml(appName)}" style="display:block;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_LABEL};">${escapeHtml(appName)}</p>
                    </td>
                  </tr>
                </table>
                <h2 style="margin:0 0 12px 0;font-size:20px;line-height:1.22;font-weight:800;letter-spacing:0;color:${EMAIL_TEXT};">${escapeHtml(title)}</h2>
                ${body}
                <p style="margin:18px 0 0 0;">
                  <a href="${escapeHtml(button.href)}" style="display:inline-block;background-color:${EMAIL_CORAL};color:${EMAIL_TEXT};font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:9999px;">${escapeHtml(button.label)}</a>
                </p>
                ${footerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
