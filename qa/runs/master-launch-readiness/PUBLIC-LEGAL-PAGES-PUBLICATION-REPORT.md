# Public Legal Pages Publication Report

**Date:** 2026-11-25  
**Repository:** `/Users/kseniia/-youneed-landing`  
**Goal:** Publish `/privacy`, `/terms`, `/support` on `www.youneed.lt`  

---

## Privacy factual updates (verified)

### AI / Gemini — disclosed

**Verified in mobile app / Edge Function (read-only):**

- `YouNeed/src/app/voice-task-preview.tsx` invokes Supabase function `ai-task-assistant` with transcript text, language, date and catalog payload when the user chooses AI structuring.
- `YouNeed/supabase/functions/ai-task-assistant/index.ts` calls Google Generative Language API with `GEMINI_API_KEY` and model ids `gemini-3.8-flash` / `gemini-3.7-flash` / `gemini-3.6-flash`.

**Policy change:** Added **§15 Voice task AI assistance** describing on-device speech → text, then Gemini structuring of that text. Updated “Last updated” to **25 November 2026**.

### Analytics / diagnostics — narrowed

**Verified:**

- No Amplitude, Firebase Analytics, Sentry, Bugsnag, Segment, PostHog or Mixpanel dependency in `YouNeed/package.json`.
- Security-event client exists (`security-events.ts` → `record-security-event`); collection only when ingest is enabled (section 13 already covers this).
- No separate crash-reporting SDK found in app dependencies.

**Policy change:** §6 no longer lists generic “analytics”. It now states providers for hosting, payments, authentication, maps, notifications, technical support, security, fraud prevention, **operational and security logging**, and voice connectivity when enabled, and explicitly that YouNeed does **not currently** use a separate product-analytics or advertising measurement SDK.

**Unchanged:** Approved Terms of Use §§1–15 wording (still dated 8 November 2026). Privacy §§1–5 and §§7–14 body text preserved aside from §6 and new §15 / date.

---

## Deployment

| Field | Value |
|---|---|
| Method | Git push to `origin/main` (Vercel production auto-deploy — same as prior landing deploys) |
| Scope committed | Legal pages only — **not** dirty Admin CRM Customer 360 working tree |
| Commit | _(filled after push)_ |
| Production URLs | https://www.youneed.lt/privacy · /terms · /support |

### Included in publish commit

- `privacy.html`, `terms.html`, `support.html`
- `vercel.json` (rewrites)
- `index.html`, `delete-account.html` (footer links)
- `qa/runs/master-launch-readiness/PUBLIC-LEGAL-PAGES-*.md`

### Explicitly excluded

- Modified/untracked `admin/*` Customer 360 and related SQL/review packages  
- `.DS_Store`  

---

## HTTP verification (production)

_(filled after deploy)_

| URL | Expected | Result |
|---|---|---|
| https://www.youneed.lt/privacy | 200 | |
| https://www.youneed.lt/terms | 200 | |
| https://www.youneed.lt/support | 200 | |
| https://www.youneed.lt/ | 200 | |
| https://www.youneed.lt/delete-account | 200 | |

Footer checks (homepage + delete-account): links to `/privacy`, `/terms`, `/support` present in source; re-verified live after deploy.

---

## Remaining issues

1. In-app Privacy/Terms strings in the **mobile** app still show the pre-amendment §6 text and lack §15 until a separate mobile copy update (out of scope — mobile app not modified).  
2. Google’s own Gemini API terms remain Google’s; counsel may still want a DPA/subprocessor register entry.  
3. Whether Expo/OS emit additional diagnostics outside app dependencies is not fully enumerable from app source alone — disclosed as possible device/OS facilities only.  
4. Personal Gmail remains the published privacy/support contact (existing approved contact).  

---

## Explicit non-actions

No mobile app code changes · no Supabase/Stripe/secrets changes · no EAS build · Admin CRM dirty tree left uncommitted.  
