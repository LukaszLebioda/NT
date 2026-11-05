#!/usr/bin/env node
/**
 * tools/notify/notify.mjs
 *
 * Sends ONE email report after a pipeline stage finishes, over Gmail SMTP.
 * Called by the stage agents via bash (see `.kilo/rules/core.md` § Stage
 * notifications).
 *
 * It is deliberately non-blocking for the pipeline: if email is not configured,
 * or sending fails, it prints a warning and exits 0 unless `--strict` is passed.
 *
 * Config (from the repo-root `.env`, or the environment):
 *   GMAIL_USER           sender Gmail address
 *   GMAIL_APP_PASSWORD   Gmail app password (16 chars, https://myaccount.google.com/apppasswords)
 *   MAIL_TO              recipient (defaults to GMAIL_USER)
 *   MAIL_FROM            From address (defaults to GMAIL_USER)
 *
 * Usage:
 *   node tools/notify/notify.mjs \
 *     --agent spec-tester --stage "tested (red)" \
 *     --feature novels/create-novel --result done \
 *     --summary "Wrote 20 Playwright tests + a Newman collection; they fail for missing endpoints." \
 *     --next "/spec-implement novels/create-novel"
 *
 * Flags:
 *   --dry-run   print the email to stdout and exit (no config needed)
 *   --strict    exit non-zero if the email could not be sent
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const opt = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const VALID_RESULTS = ["done", "blocked", "needs-approval"];
const agent = opt("agent", "(unknown agent)");
const stage = opt("stage", "");
const feature = opt("feature", "(unknown feature)");
const result = opt("result", "done");
const summary = opt("summary", "(no summary provided)");
const next = opt("next", "(none)");
const dryRun = has("dry-run");
const strict = has("strict");

function warn(msg) {
  console.error(`[notify] ${msg}`);
}

function loadDotEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const m = raw.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function git(...gitArgs) {
  try {
    return execFileSync("git", ["-C", ROOT, ...gitArgs], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function categorize(statusText) {
  const added = [];
  const changed = [];
  const deleted = [];
  for (const line of statusText.split("\n").filter(Boolean)) {
    const code = line.slice(0, 2);
    const path = line.slice(3);
    if (code.includes("D")) deleted.push(path);
    else if (code.includes("?") || code.includes("A")) added.push(path);
    else changed.push(path);
  }
  return { added, changed, deleted };
}

function list(title, items) {
  if (items.length === 0) return `${title}: (none)`;
  return `${title}:\n${items.map((i) => `  - ${i}`).join("\n")}`;
}

function buildBody() {
  const status = git("status", "--short");
  const { added, changed, deleted } = categorize(status);
  const diffStat = git("diff", "--stat") || git("diff", "--stat", "--cached") || "(no diff)";

  return [
    `Agent:    ${agent}${stage ? `  [${stage}]` : ""}`,
    `Feature:  ${feature}`,
    `Result:   ${result}`,
    "",
    "Summary",
    "-------",
    summary,
    "",
    "Files",
    "-----",
    list("Added", added),
    "",
    list("Changed", changed),
    "",
    list("Deleted", deleted),
    "",
    "git diff --stat",
    "---------------",
    diffStat,
    "",
    "Next",
    "----",
    next,
    "",
    "— sent by tools/notify/notify.mjs",
  ].join("\n");
}

async function main() {
  if (!VALID_RESULTS.includes(result)) {
    warn(`unknown --result "${result}" (expected: ${VALID_RESULTS.join(", ")})`);
  }

  const subject = `[NovelTracker] ${agent} — ${result} — ${feature}`;
  const body = buildBody();

  if (dryRun) {
    console.log(`To:      <configured recipient>`);
    console.log(`Subject: ${subject}`);
    console.log("");
    console.log(body);
    return;
  }

  loadDotEnv();
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.MAIL_TO || user;
  const from = process.env.MAIL_FROM || user;

  if (!user || !pass || !to) {
    warn("email not configured — set GMAIL_USER, GMAIL_APP_PASSWORD (and optionally MAIL_TO) in .env");
    process.exit(strict ? 1 : 0);
  }

  let nodemailer;
  try {
    nodemailer = (await import("nodemailer")).default;
  } catch {
    warn("nodemailer is not installed — run `npm install` at the repo root");
    process.exit(strict ? 1 : 0);
  }

  try {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transport.sendMail({ from, to, subject, text: body });
    console.log(`[notify] sent to ${to}: ${subject}`);
  } catch (err) {
    warn(`could not send email: ${err.message}`);
    process.exit(strict ? 1 : 0);
  }
}

await main();
