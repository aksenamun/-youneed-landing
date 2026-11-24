# Admin CRM 2.0 — Pre-Deployment Audit

**Project:** `/Users/kseniia/-youneed-landing`  
**Date:** 2026-11-25  
**Scope:** Web Admin CRM 2.0 source only  
**Actions not taken:** EAS, SQL migrations, Stripe changes, landing-page publish  

---

## Overall publication readiness

**DEPLOYED to production.** Static audit **PASS**. Unauthenticated browser smoke **PASS** (assets, rewrite, globals, no console errors). **Authenticated CRM flows (Users → Open CRM → tabs) remain owner-verified** — no admin credentials were available in this session.

---

## Deployment record

| Field | Value |
|---|---|
| Git commit | `02cde984ce18d6d014f39e908d683dfdfe29cfc7` |
| Commit message | Publish Web Admin CRM 2.0 dedicated customer profiles. |
| Production URL | https://www.youneed.lt/admin/ |
| Pretty CRM route | https://www.youneed.lt/admin/users/:id |
| GitHub Deployment ID | `8044161547` |
| Vercel deployment URL | https://youneedlanding-9qtreljfl-you-need.vercel.app |
| Vercel status | **success** — “Deployment has completed” (2026-11-24T23:57:53Z) |
| Deploy method | Git push to `origin/main` (SSH); Vercel production auto-deploy |

### Included in the publish commit (CRM only)

`admin/admin-crm.js`, `admin/admin-boot.js`, `admin/admin.js` (CRM wiring only), `admin/admin-intel.js` (`startAdmin` removal only), `admin/admin.css`, `admin/index.html`, `vercel.json`, audit/status/gaps markdown.

### Explicitly excluded from the publish commit

- Root `index.html` (landing delete-account link) — left uncommitted  
- Payment settings / finance Stripe overview UI in working-tree `admin.js` / `admin-intel.js` — restored after commit, **not** published  
- `admin/sql/`, `admin/review-package/`, `.DS_Store`  

### Pre-deploy fix confirmation (live)

| Fix | Live asset |
|---|---|
| hashchange loop / `setSection` selection clear | Present in production `admin-boot.js` + `admin.js` |
| Reports missing-RPC honest message | Present in production `admin-crm.js` |

---

## Checklist results

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Review changed / new files | **PASS** | See file inventory below |
| 2 | CRM init does not break Admin dashboard | **PASS** (static) | Single `startAdmin()` via `admin-boot.js` after `admin.js` → `admin-crm.js` → `admin-intel.js`. Intel no longer auto-starts. Dashboard still rendered by existing `renderDashboard` |
| 3 | Profile routes `#users/<uuid>` and `/admin/users/<uuid>` | **PASS** (static) | `parseAdminRoute()` reads hash and pathname; UUID validated |
| 4 | Users → Open CRM → back | **PASS** (static) | `open-crm-user` / `crm-back` / `closeCrmUser` / `setSection('users')`. **Browser NOT VERIFIED** |
| 5 | CRM tabs handlers / queries / runtime | **PASS** with notes | All 11 tabs have renderers; CRM `data-action`s handled. Reports missing-RPC path corrected (no false empty/unscoped list). Security tab honest empty if RPC absent |
| 6 | Moderation + listing actions use existing RPCs | **PASS** | `admin_moderate_user`, `admin_hide_listing`, `admin_restore_listing`, `admin_archive_listing`, `admin_unarchive_listing` via existing `confirmReason` path in `admin.js`. No hard delete UI |
| 7 | Deals vs Payments separate | **PASS** | Deals tab = `admin_list_deals` only. Payments tab = ledger (`admin_list_payment_transactions`) + labeled “Deal amounts (not payment history)” |
| 8 | `admin_deal_messages` + RPC contracts | **PASS** (static) | Args `{ deal_id, page, page_size }` match local SQL (`deal_id uuid`). Bodies gated by `canAct('message-body')`. bigint JSON still decimal-string via existing `parseJson` |
| 9 | Role permissions / RLS assumptions | **PASS** (static) | Publishable key + user JWT only; admin RPCs are security definer + `authenticated` execute (revoked from `anon`/`service_role` in reference SQL). UI uses `roleAllows` / `canAct`; no RLS bypass |
| 10 | Vercel routing + asset loading | **PASS** (static) | `vercel.json` rewrites `/admin/users/:id` → `/admin/index.html`. Scripts are absolute `/admin/*.js` (safe under pretty URLs) |
| 11 | No new secrets / sensitive data in assets | **PASS** | CRM files add no keys. Pre-existing publishable key in `admin.js` unchanged. No sample PII embedded |
| 12 | Relevant available checks / tests | **PASS** | `node --check` on admin.js, admin-crm.js, admin-boot.js, admin-intel.js. No Admin TypeScript suite. **No browser test** |

---

## File inventory (CRM-relevant)

### New
| File | Role |
|---|---|
| `admin/admin-crm.js` | Directory, profile, tabs, CRM click handlers |
| `admin/admin-boot.js` | Boot + hash/popstate route sync |
| `admin/ADMIN-CRM-2.0-WEB-STATUS.md` | Status report |
| `admin/ADMIN-CRM-2.0-WEB-GAPS.md` | Gaps report |
| `admin/ADMIN-CRM-2.0-PREDEPLOY-AUDIT.md` | This audit |

### Modified (CRM)
| File | Role |
|---|---|
| `admin/admin.js` | Route-aware Users render; CRM open/select; `setSection` clears CRM selection |
| `admin/admin-intel.js` | Removed eager `startAdmin()` (required for correct boot order) |
| `admin/admin.css` | CRM layout |
| `admin/index.html` | Script tags for crm + boot |
| `vercel.json` | `/admin/users/:id` rewrite |

### Also dirty in the same working tree (not CRM blockers; co-deploy if published)
| File | Note |
|---|---|
| `admin/admin.js` / `admin-intel.js` | Payment settings UI + finance Stripe overview (pre-existing dirty work preserved) |
| `index.html` (landing) | Delete-account footer link — unrelated to CRM |

Untracked `admin/sql/`, `admin/review-package/`, `.DS_Store` are **not** required for CRM. Prefer git-based deploy so untracked SQL/review packages are not accidentally uploaded.

---

## Corrections applied during this audit

| Issue | Severity | File | Fix |
|---|---|---|---|
| `syncRoute` could re-call `setSection` while `state.users.selected` remained set after leaving CRM → **hashchange loop** | **Blocker** | `admin/admin-boot.js`, `admin/admin.js` | Sync only on section mismatch or `#users` directory with leftover selection; `setSection` always clears CRM selection |
| Reports tab on missing `admin_search_reports` fell through to empty rows (and previously risked unscoped fallback) | Medium | `admin/admin-crm.js` | Honest message; no fake/unscoped customer reports |

---

## Deployment blockers

| Item | Status |
|---|---|
| Syntax / missing CRM click handlers | **None remaining** after corrections |
| Missing Vercel rewrite for pretty URLs | **None** in source (`vercel.json` updated); **must be published** with the app for `/admin/users/:id` |
| Live browser confirmation | **Open** — not a code blocker; required before claiming production UI success |
| Backend RPCs | Assumed already deployed (existing Admin). Security events RPC optional |

---

## Exact files requiring correction

**Before this audit:** `admin/admin-boot.js`, `admin/admin.js`, `admin/admin-crm.js` (corrected above).

**Remaining code corrections for CRM publication:** **none identified**.

Optional non-blockers (documented in GAPS): country not on profile; payment ledger client-filtered; security events RPC may be absent.

---

## Functionality matrix (source-backed)

| Capability | Working in source? | Browser verified? |
|---|---|---|
| Directory search / filters / stats | Yes | No |
| Open CRM full-screen profile | Yes | No |
| Back to directory | Yes | No |
| `#users/<uuid>` | Yes | No |
| `/admin/users/<uuid>` (with rewrite live) | Yes | No |
| Overview / Personal / Activity | Yes | No |
| Listings + hide/restore/archive | Yes | No |
| Deals (click → Deal Workspace) | Yes | No |
| Messages (`admin_deal_messages`) | Yes | No |
| Payments separate from deals | Yes | No |
| Connections / Reports / Notes | Yes | No |
| Security (if RPC present) | Yes / empty otherwise | No |
| Suspend / reactivate / ban + reason | Yes | No |

---

## Validation commands run

```text
node --check admin/admin.js
node --check admin/admin-crm.js
node --check admin/admin-boot.js
node --check admin/admin-intel.js
→ ALL_SYNTAX_OK
```

Static enumeration of CRM `data-action` values → all handled by `handleCrmClick` or existing `admin.js` moderation/open handlers.

---

## Post-deploy smoke test (2026-11-25)

| Check | Result | Evidence |
|---|---|---|
| Deployment completed successfully | **PASS** | GitHub deployment `8044161547` state `success` |
| `admin-crm.js` / `admin-boot.js` live | **PASS** | HTTP 200 on www.youneed.lt |
| Admin index loads CRM scripts | **PASS** | Script tags include admin-crm.js + admin-boot.js |
| `/admin/users/:id` rewrite | **PASS** | HTTP 200 HTML; browser URL kept; `parseAdminRoute()` → `{ section:'users', crmId }` |
| CRM globals present | **PASS** | `openCrmUser`, `parseAdminRoute`, `renderCrmProfile`, `handleCrmClick`, `startAdmin` are functions |
| Asset network load | **PASS** | admin.js/css/crm/boot/intel/catalog all 200 |
| Console / unhandled errors (login page) | **PASS** | No errors / rejections observed |
| Login screen still works | **PASS** | Browser opened production Admin login |
| Users directory (authenticated) | **NOT VERIFIED** | No admin credentials in session |
| Open CRM / profile / all tabs | **NOT VERIFIED** | Requires signed-in administrator |
| Back navigation | **NOT VERIFIED** | Requires signed-in administrator |
| Dashboard (authenticated) | **NOT VERIFIED** | Requires signed-in administrator |

---

## Owner actions remaining

1. Hard-refresh https://www.youneed.lt/admin/ and sign in.  
2. Confirm **Users → Open CRM**, all tabs, back navigation, Deals vs Payments.  
3. Do not enable Stripe LIVE or apply SQL as part of this CRM publish.  
4. Uncommitted local work still present: payment settings / finance UI in `admin.js` + `admin-intel.js`, and landing `index.html` — preserved, not published.

---

## Verdict summary

| Gate | Result |
|---|---|
| Source / static CRM audit | **PASS** |
| Known runtime blockers in CRM boot/nav | **PASS** (fixed before publish) |
| Production deploy | **PASS** — live on www.youneed.lt |
| Unauthenticated browser smoke | **PASS** |
| Authenticated CRM UI confirmation | **NOT VERIFIED** (owner sign-in required) |
| Ready / published? | **YES — published**; owner should complete authenticated smoke |
