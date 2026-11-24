# Admin CRM 2.0 — Web Status

**Project:** `/Users/kseniia/-youneed-landing`  
**Updated:** 2026-11-25  
**Deploy / commit / SQL:** not done (per safety rules)

---

## Verdict

Web Admin Users no longer uses the old “table + inline detail” as the primary CRM. Clicking a user opens a **dedicated full-screen CRM profile** (hash `#users/<uuid>` and path `/admin/users/<uuid>` via Vercel rewrite).

This is **implemented in source** and syntax-validated. It is **not** claimed production-complete until an owner opens the live Admin Panel and confirms the UI after deploy.

---

## 1. Routes implemented

| Route | Behavior |
|---|---|
| `#users` / Users nav | Searchable directory only (no inline expansion) |
| `#users/<uuid>` | Full-screen CRM profile |
| `/admin/users/<uuid>` | SPA rewrite → `admin/index.html`, same CRM profile |
| Breadcrumb / “← Users directory” | Returns to directory |

---

## 2. Components / files changed

| File | Change |
|---|---|
| `admin/admin-crm.js` | **New** — directory + profile tabs + CRM click handlers |
| `admin/admin-boot.js` | **New** — boot after CRM load; hash/popstate sync |
| `admin/admin.js` | Route-aware Users render; `openRecord`/`select-user` → CRM; click wiring |
| `admin/admin-intel.js` | Removed eager `startAdmin()` (boot owns startup) |
| `admin/admin.css` | CRM layout styles |
| `admin/index.html` | Script order: admin → crm → intel → boot |
| `vercel.json` | Rewrite `/admin/users/:id` → `/admin/index.html` |

Existing work in dirty `admin.js` / `admin-intel.js` was preserved (patched, not reset).

---

## 3. Functionality actually wired (source)

| Area | Status in code |
|---|---|
| Directory search / filters / stats | Yes — `admin_filter_users` (+ fallbacks) |
| Dedicated profile header (photo, id, email, phone, status, identity) | Yes — `admin_user_card` |
| Tabs: Overview → Notes | Yes (11 tabs) |
| Moderation suspend / reactivate / ban + reason + confirm | Yes — existing `admin_moderate_user` + `confirmReason` |
| Moderation history | Yes — `admin_moderation_history` on Notes tab |
| Listings + hide/restore/archive | Yes — existing listing moderation RPCs |
| Deals vs Payments separated | Yes |
| Deal / user click-through | Yes — `open-deal` / `open-user` |
| Messages via `admin_deal_messages` | Yes (role-gated bodies) |
| Reports list + navigation | Yes |
| Admin notes / tags | Yes — existing `userPrivatePanels` |
| Country | Explicitly **“Not stored on the profile”** (not invented) |
| Security events | Calls `admin_user_security_events` if present; otherwise honest empty |

---

## 4. Validation run

| Check | Result |
|---|---|
| `node --check` admin.js / admin-crm.js / admin-boot.js / admin-intel.js | **PASS** |
| Script order / exports / Open CRM wiring (static) | **PASS** |
| Browser / deployed Admin Panel visual confirmation | **NOT RUN** (no deploy) |
| TypeScript project tests | **N/A** (vanilla JS Admin) |

---

## 5. Owner actions remaining

1. Deploy / publish the updated `admin/` assets (when approved).  
2. Hard-refresh the Admin Panel and open **Users → Open CRM**.  
3. Confirm tabs, moderation, deals vs payments, and deal message load against production RPCs.  
4. Optional: apply security-events SQL on backend if Security tab should show events (not done here).  

See `ADMIN-CRM-2.0-WEB-GAPS.md` for backend dependencies and known gaps.
