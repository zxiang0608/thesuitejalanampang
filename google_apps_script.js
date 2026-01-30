/***** CONFIG *****/
const SPREADSHEET_ID = "1O5AxMBvIyUftb2eGNQoI3ltYwgxG1AIa77LxKmyR9DU";
const SHEET_NAME = "Property Leads";
const AGENT_WA_E164 = "60143317056"; // digits only

/***** MAIN ENTRY *****/
function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const tz = Session.getScriptTimeZone() || "Asia/Kuala_Lumpur";
    const now = new Date();

    const params = (e && e.parameter) ? e.parameter : {};
    const name = (params.name || "").trim();
    const phone = normalizePhone(params.phone || "");

    // Optional hidden fields (safe to leave blank if not used)
    const unit = (params.unit || "").trim();
    const strategy = (params.strategy || "").trim();

    if (!name || !phone) {
      return htmlError("Please enter your name and WhatsApp number.");
    }

    // Continuous sequence (never resets)
    const props = PropertiesService.getScriptProperties();
    const lastSeq = Number(props.getProperty("LAST_SEQ") || "0");
    const nextSeq = lastSeq + 1;

    const datePart = Utilities.formatDate(now, tz, "yyMMdd-HHmm");
    const seqPart = String(nextSeq).padStart(2, "0"); // 01..99..100
    const leadId = `${datePart}-ZX${seqPart}`;

    props.setProperty("LAST_SEQ", String(nextSeq));

    // Write to Google Sheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // If sheet is empty, create headers
    if (sh.getLastRow() === 0) {
      sh.appendRow(["Timestamp", "LeadID", "Name", "WhatsApp", "Unit", "Strategy"]);
    }

    sh.appendRow([
      Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss"),
      leadId,
      name,
      phone,
      unit,
      strategy
    ]);

    lock.releaseLock();

    // Prefilled WhatsApp message
    const msg = `Can you send me the full details + latest promo?\nRef: ${leadId}`;
    const waUrl = buildWaUrl(AGENT_WA_E164, msg);

    return htmlRedirect(waUrl);

  } catch (err) {
    return htmlError("Something went wrong. Please try again.");
  }
}

/***** HELPERS *****/
function buildWaUrl(agentE164DigitsOnly, message) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${agentE164DigitsOnly}?text=${encoded}`;
}

function normalizePhone(input) {
  let p = String(input).replace(/[^\d]/g, "");
  if (p.startsWith("01")) p = "60" + p.slice(1);
  if (!p.startsWith("60")) return "";
  if (p.length < 10 || p.length > 13) return "";
  return p;
}

function htmlRedirect(url) {
  const html = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;}
        .box{max-width:520px;margin:40px auto;}
      </style>
    </head>
    <body>
      <div class="box">
        <p>Opening WhatsApp…</p>
        <p>If it doesn’t open, <a href="${escapeHtml(url)}">tap here</a>.</p>
      </div>
      <script>window.location.href = ${JSON.stringify(url)};</script>
    </body>
  </html>`;
  return HtmlService.createHtmlOutput(html);
}

function htmlError(msg) {
  const html = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;}
        .box{max-width:520px;margin:40px auto;}
        .err{color:#b00020;font-weight:600;}
      </style>
    </head>
    <body>
      <div class="box">
        <p class="err">${escapeHtml(msg)}</p>
        <p>Please go back and try again.</p>
      </div>
    </body>
  </html>`;
  return HtmlService.createHtmlOutput(html);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
