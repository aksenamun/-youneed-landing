# Public Legal Pages Implementation Report

**Date:** 2026-11-25  
**Repository:** `/Users/kseniia/-youneed-landing`  
**Target URLs:** `/privacy`, `/terms`, `/support` on `www.youneed.lt`  
**Safety:** No production deploy · no secrets/DB/Stripe changes · no mobile app changes · no commit/push  

---

## Summary

Implemented three public, unauthenticated HTML pages matching existing YouNeed.lt branding (cream background, Inter/system type, card panels, shared nav/footer). Privacy and Terms use the **approved in-app legal text** (EN, last updated 8 November 2026). Support uses only verified contacts already present in the project.

**Production deploy was not performed.** Live `www.youneed.lt/privacy` and `/terms` remain 404 until the owner deploys this repo.

---

## Changed files

| File | Change |
|---|---|
| `privacy.html` | **New** — Privacy Policy (approved §§1–14) + counsel-flagged product notes |
| `terms.html` | **New** — Terms of Use (approved §§1–15) |
| `support.html` | **New** — Support hub |
| `vercel.json` | Rewrites for `/privacy`, `/terms`, `/support` (+ trailing slashes) |
| `index.html` | Footer links: Privacy/Terms → real paths; added Support |
| `delete-account.html` | Footer links to Privacy, Terms, Support |
| `qa/runs/master-launch-readiness/PUBLIC-LEGAL-PAGES-IMPLEMENTATION-REPORT.md` | This report |

Existing rewrites preserved: `/task/:id`, `/delete-account`, `/admin/users/:id`.

---

## Content sources

| Page | Source |
|---|---|
| Privacy §§1–14 + date | `/Users/kseniia/YouNeed/src/constants/translations.ts` → `en.legal` (same as in-app `privacy.tsx`) |
| Terms §§1–15 + date | Same `en.legal` (same as in-app `terms.tsx`) |
| Privacy contact | `nuzhnakseniia@gmail.com` (legal `p12b`) |
| Terms/support contact | `nuzhnakseniia@gmail.com` (legal `t15b`) |
| General contact | `hello@youneed.app` (landing waitlist / contact — already on site) |
| Account deletion link | Existing `/delete-account` |

No phone numbers invented. No new legal entity details invented.

---

## Privacy: accuracy / flagged items

Approved numbered policy is published **unchanged**.

A separate **“Product implementation notes (not a substitute for counsel review)”** block on `/privacy` documents verified product mapping and open questions:

| Topic | Status on page |
|---|---|
| Supabase hosting/auth | Noted as current hosting/auth provider (maps to §§1,5,6) |
| Stripe Checkout / Connect | Noted; full PANs processed by Stripe (§3) |
| Photos & messaging | Noted as user content (§1) |
| Voice / LiveKit | Covered by approved §14 |
| AI / Gemini (`ai-task-assistant`) | **Flagged** — used for voice-task structuring in app code but **not named** in approved §§1–14; counsel should confirm an explicit AI disclosure |
| “Analytics” in §6 | **Flagged** — no separate product-analytics/ads SDK in the mobile app; counsel should confirm whether to narrow wording |
| Maps | Noted (Apple Maps links / map views) |

---

## Local verification

Local HTTP server applying the same clean-path rewrites as `vercel.json`:

| Route | Result |
|---|---|
| `/privacy`, `/privacy/` | **200** — title `Privacy Policy — YouNeed` |
| `/terms`, `/terms/` | **200** — title `Terms of Use — YouNeed` |
| `/support`, `/support/` | **200** — title `Support — YouNeed` |
| `/delete-account` | **200** (unchanged) |
| `/` | **200** (unchanged) |

Additional checks:

- Internal links across `index.html`, `privacy.html`, `terms.html`, `support.html`, `delete-account.html` → **0 broken**
- Viewport meta present on all three new pages (mobile-readable layout)
- No authentication gate on privacy/terms/support
- `vercel.json` parses; prior admin/task/delete-account rewrites still present

**Not verified against live production** (deploy blocked by task rules).

---

## Unresolved legal questions (owner / counsel)

1. Add an explicit **AI / Gemini** subsection to the formal Privacy Policy?  
2. Narrow §6 **“analytics”** given no product-analytics SDK?  
3. Keep **personal Gmail** (`nuzhnakseniia@gmail.com`) as public privacy/support contact long-term?  
4. Confirm copyright / rights-holder naming (`YouNeed.app` vs registered entity) for footer consistency.  
5. Exact financial retention periods remain “confirm with counsel” (already reflected on delete-account page).

---

## Exact deployment action required (owner approval)

When approved, deploy **this landing repo** to the existing Vercel project that serves `www.youneed.lt` (same process used for prior landing/admin deploys). After deploy, confirm:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -L https://www.youneed.lt/privacy
curl -sS -o /dev/null -w "%{http_code}\n" -L https://www.youneed.lt/terms
curl -sS -o /dev/null -w "%{http_code}\n" -L https://www.youneed.lt/support
```

Expected: `200` for each.

Then set App Store Connect:

- Privacy Policy URL → `https://www.youneed.lt/privacy`
- Support URL → `https://www.youneed.lt/support`
- (Recommended) Terms → `https://www.youneed.lt/terms`

**This agent stopped before production deployment.**

---

## Explicit non-actions

- No production deploy  
- No commit / push  
- No Stripe / Supabase / secret changes  
- No mobile app edits  
