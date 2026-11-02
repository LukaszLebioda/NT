# tools/notify — per-stage email reports

Sends you one email after each pipeline stage: which agent finished, the result,
a short summary, the files added/changed/deleted, and the next step. Part of the
"Option A" notification flow — the stage agents call it; you decide what to run
next.

## Setup

1. Install dependencies (the folder is a workspace member, so the root install
   covers it):
   ```
   npm install
   ```
2. Create a Gmail **app password** at https://myaccount.google.com/apppasswords
   (2‑Step Verification must be on) and copy `.env.example` → `.env`, then set:
   ```
   GMAIL_USER=you@gmail.com
   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   MAIL_TO=you@gmail.com        # optional; defaults to GMAIL_USER
   ```
   `.env` is git-ignored. Never commit these values.

## Usage

The stage agents call it automatically, but you can run it yourself:

```
node tools/notify/notify.mjs \
  --agent spec-test-author --stage "tested (red)" \
  --feature novels/create-novel --result done \
  --summary "Wrote 20 Playwright tests + a Newman collection." \
  --next "/spec-implement novels/create-novel"
```

Flags:

- `--result done | blocked | needs-approval` — `needs-approval` is for gated
  actions like `npm install` that only the user should run.
- `--dry-run` — print the email to stdout, send nothing (needs no config).
- `--strict` — exit non-zero if the email could not be sent.

## Behaviour

- Reads `.env` from the repo root; otherwise uses the process environment.
- Collects the file list via `git status --short` and a `git diff --stat`.
- Non-blocking: if email is unconfigured or fails, it warns and exits `0` (unless
  `--strict`), so a missing mail never fails a stage.
- Sends over Gmail SMTP (`smtp.gmail.com:465`, TLS).

## Secret safety

The password is read from the environment and never printed or logged.
