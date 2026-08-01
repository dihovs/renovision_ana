/**
 * Place a fake phone call at the voice webhooks.
 *
 * The first real call should not be the first test. This drives
 * /incoming -> /turn -> /turn -> /status exactly as Twilio would, signing every
 * request with the same HMAC scheme, so the whole pipeline — signature check,
 * transcript writes, language switching, escalation, TwiML shape — is exercised
 * before a number exists.
 *
 *   node scripts/simulate-call.mjs [baseUrl]
 *
 * Needs TWILIO_AUTH_TOKEN set to whatever the target server is using (any
 * string works locally, as long as both sides agree). Reads .env.local when
 * present so a local dev server needs no extra setup.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// .env.local is the source of truth locally; a real deployment passes the token
// through the environment instead.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const TOKEN = process.env.TWILIO_AUTH_TOKEN;
if (!TOKEN) {
  console.error(
    "TWILIO_AUTH_TOKEN is not set. The endpoints refuse unsigned requests by\n" +
      "design, so the simulator cannot work without it. Set any value locally:\n" +
      '  TWILIO_AUTH_TOKEN=test-token node scripts/simulate-call.mjs',
  );
  process.exit(1);
}

/** Twilio signs the full URL plus the body's key/value pairs, sorted by key. */
function sign(url, params) {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", TOKEN).update(Buffer.from(payload, "utf-8")).digest("base64");
}

async function post(pathAndQuery, params) {
  const url = `${BASE}${pathAndQuery}`;
  const body = new URLSearchParams(params);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Signed over the URL Twilio dialled, which is what publicUrl() rebuilds.
      "X-Twilio-Signature": sign(url, params),
    },
    body,
  });
  return { status: response.status, text: await response.text() };
}

const CALL_SID = `CAtest${Date.now().toString(36)}`;
const FROM = "+15145551234";
const TO = "+14505550000";

/** Pull the spoken line out of TwiML so the transcript is readable. */
function said(xml) {
  const matches = [...xml.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)];
  return matches
    .map((m) =>
      m[1]
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">"),
    )
    .join(" ");
}

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// A caller who starts in French, switches to English, then gets frustrated —
// one script that exercises language switching and escalation together.
const SCRIPT = [
  "Bonjour, j'ai un dégât d'eau dans mon sous-sol, l'eau coule encore",
  "My name is Marie Dubois and the address is 123 rue Principale in Laval",
  "How much is this going to cost me",
  "How much is this going to cost me",
  "I said how much does it cost",
];

console.log(`Calling ${BASE} as ${FROM} (CallSid ${CALL_SID})\n`);

// --- The phone rings ---------------------------------------------------------
const incoming = await post("/api/voice/incoming", {
  CallSid: CALL_SID,
  From: FROM,
  To: TO,
  AccountSid: "ACsimulated",
  Direction: "inbound",
});

console.log("--- incoming");
check("returns 200", incoming.status === 200, `got ${incoming.status}`);
check("is TwiML", incoming.text.includes("<Response>"), incoming.text.slice(0, 120));
check("listens for speech", incoming.text.includes('<Gather input="speech"'));
check("greets in French", /Renovision AnA/.test(incoming.text));
check(
  "discloses it is an assistant and that the call is transcribed",
  /assistante virtuelle/i.test(incoming.text) && /transcrit/i.test(incoming.text),
  "the disclosure is a legal requirement, not a nicety",
);
console.log(`  agent: ${said(incoming.text)}\n`);

if (incoming.status === 403) {
  console.error(
    "403 means the signature was rejected: the server's TWILIO_AUTH_TOKEN\n" +
      "differs from this script's. They must match.",
  );
  process.exit(1);
}

// --- The conversation --------------------------------------------------------
let sawEnglish = false;
for (const [i, line] of SCRIPT.entries()) {
  const turn = await post("/api/voice/turn", {
    CallSid: CALL_SID,
    From: FROM,
    To: TO,
    SpeechResult: line,
    Confidence: "0.95",
  });

  console.log(`--- turn ${i + 1}`);
  console.log(`  caller: ${line}`);
  check("returns 200", turn.status === 200, `got ${turn.status}`);

  const reply = said(turn.text);
  console.log(`  agent: ${reply}`);

  check("says something", reply.trim().length > 0);
  check(
    "quotes no price",
    !/\$|\bdollars?\b|\bpiastres?\b/i.test(reply),
    "the agent has no price list and must never invent one",
  );

  if (/<Gather/.test(turn.text)) {
    check("keeps listening", true);
  }

  if (i >= 1 && /[a-z]/i.test(reply) && / the | you | your |will |call /i.test(reply)) {
    sawEnglish = true;
  }
  console.log("");
}

check("followed the caller into English", sawEnglish, "language switching may be broken");

// --- Silence -----------------------------------------------------------------
const silent1 = await post("/api/voice/turn?silent=1", { CallSid: CALL_SID, From: FROM, To: TO });
console.log("--- silence 1");
check("asks them to repeat", /répéter|say it again/i.test(silent1.text), said(silent1.text));
console.log(`  agent: ${said(silent1.text)}\n`);

const silent2 = await post("/api/voice/turn?silent=1&silences=1", {
  CallSid: CALL_SID,
  From: FROM,
  To: TO,
});
console.log("--- silence 2");
check("gives up politely", /<Hangup/.test(silent2.text), "should hang up after two silences");
console.log(`  agent: ${said(silent2.text)}\n`);

// --- The call ends -----------------------------------------------------------
const status = await post("/api/voice/status", {
  CallSid: CALL_SID,
  From: FROM,
  To: TO,
  CallStatus: "completed",
  CallDuration: "94",
});
console.log("--- status callback");
// 204 is the expected answer — Twilio wants no content back from a status
// callback, and 204 is a null-body status.
check("accepts the callback", status.status === 204, `got ${status.status}`);

// --- An unsigned request must be refused ------------------------------------
const forged = await fetch(`${BASE}/api/voice/turn`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ CallSid: CALL_SID, SpeechResult: "let me in" }),
});
console.log("\n--- forged request (no signature)");
check("is rejected", forged.status === 403, `got ${forged.status} — the endpoint is open!`);

console.log(
  failures === 0
    ? "\nAll checks passed. Transcript should be visible at /admin/calls once migration 0009 has run."
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
