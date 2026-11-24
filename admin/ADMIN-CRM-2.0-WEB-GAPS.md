# Admin CRM 2.0 — Web Gaps

**Updated:** 2026-11-25

---

## Missing / limited functionality

| Item | Gap | Backend dependency |
|---|---|---|
| Country on profile | Profile schema does not store country; UI shows “Not stored” | Would need a real column + RPC — **not invented** |
| Hard delete listing | Not offered; archive/hide/restore only | Matches existing authorized RPCs (`admin_archive_listing`, etc.) |
| Payment ledger completeness | Filtered client-side from `admin_list_payment_transactions` (no user filter arg) | Finance/super_admin role; RPC returns recent pages only |
| Security tab data | Empty unless `admin_user_security_events` exists | Optional migration (not applied in this pass) |
| Report detail inside CRM | Links to Reports section / open-report | `admin_report_detail` not embedded as a CRM sub-route |
| Identity filter | May notice if identity tables absent | Existing filter behavior preserved |
| Pretty URL without deploy | `/admin/users/:id` needs Vercel rewrite live | `vercel.json` updated locally; requires deploy |
| Visual confirmation | Not claimed until owner opens deployed Admin | Deploy + hard refresh |

---

## Backend RPCs used (no new SQL)

- `admin_filter_users` / `admin_list_profiles`
- `admin_user_card`
- `admin_user_activity`
- `admin_list_listings` / `admin_listing_directory` / `admin_filter_listings`
- `admin_hide_listing` / `admin_restore_listing` / `admin_archive_listing` / `admin_unarchive_listing`
- `admin_list_deals`
- `admin_deal_messages`
- `admin_list_payment_transactions`
- `admin_search_reports`
- `admin_moderate_user`
- `admin_moderation_history`
- `admin_user_private` / `admin_add_user_note` / `admin_set_user_tag` / `admin_user_reputation`
- `admin_user_security_events` (optional)

---

## What was intentionally not done

- No EAS builds, deploy, commit, push  
- No SQL migrations / schema changes  
- No Stripe / payment activation changes  
- No fabricated IPs, devices, addresses, or activity  
