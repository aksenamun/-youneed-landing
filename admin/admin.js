const SUPABASE_URL = 'https://rmjavihkusnwdalwzlmt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zwR1kDFTjxbeQ5WBYmzw3g_UqkUfKNX';
const SESSION_KEY = 'youneed-web-admin-session';
const PAGE_SIZE = 20;

const LISTING_STATUSES = ['draft', 'active', 'paused', 'in_progress', 'completed', 'cancelled'];
const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'rejected'];
const SUGGESTION_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewing' },
  { value: 'accepted', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
const SECTION_TITLES = {
  dashboard: 'Dashboard',
  users: 'Users',
  listings: 'Listings',
  reports: 'Reports',
  deals: 'Deals',
  categories: 'Categories',
  suggestions: 'Category Suggestions',
  verification: 'Identity Verification',
  settings: 'Settings',
};
const CATEGORIES = [
  "When I'm away",
  'Clothes & personal items',
  'Furniture IKEA & home things',
  'Urgent help today',
  'Everyday personal help',
  'Moving & new life',
  'Home & everyday living',
  'Moving, transport & storage',
  'Cleaning & housekeeping',
  'Home maintenance & handyman',
  'Education & learning',
  'Repair & fixing services',
  'Business, digital & office support',
  'Health & personal care',
  'Event planning',
  'Auto & vehicle services',
  'Photo, video & content creation',
  'Pet care services',
  'Legal assistance',
  'Travel & tourism',
  'Childcare & family support',
  'Finance & accounting',
  'Investigation services',
  'Seasonal services',
];

const state = {
  section: 'dashboard',
  adminSince: null,
  user: null,
  users: { query: '', page: 1, selected: null },
  listings: { query: '', category: '', status: 'all', page: 1, selected: null },
  reports: { status: 'all', page: 1, selected: null, note: '', nextStatus: 'open' },
  suggestions: { query: '', status: 'all', page: 1, selected: null },
  verification: { query: '', status: 'all', provider: 'all', page: 1, selected: null },
};

const $ = (id) => document.getElementById(id);

function parseJson(text) {
  if (text == null || text === '') return null;
  const normalized = text.replace(/([:\[,]\s*)(-?\d+)(?=\s*[,}\]])/g, (full, prefix, digits) => {
    const asNumber = Number(digits);
    if (Number.isSafeInteger(asNumber) && String(asNumber) === digits) return full;
    return `${prefix}"${digits}"`;
  });
  return JSON.parse(normalized);
}

function reportId(value) {
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function tone(status) {
  if (status === 'active' || status === 'resolved' || status === 'completed' || status === 'accepted' || status === 'approved') return 'ok';
  if (status === 'rejected' || status === 'cancelled' || status === 'declined' || status === 'failed' || status === 'expired' || status === false) return 'danger';
  if (status === 'open' || status === 'reviewing' || status === 'reviewed' || status === 'new' || status === 'paused' || status === 'draft' || status === 'pending' || status === 'in_review') return 'warn';
  return '';
}

function badge(status) {
  const known = SUGGESTION_FILTERS.find((item) => item.value === status);
  const label = status === true ? 'Active' : status === false ? 'Inactive' : known ? known.label : status || '—';
  return `<span class="badge ${tone(status)}">${escapeHtml(label)}</span>`;
}

function missingRpc(error) {
  return /could not find the function|schema cache|PGRST202|does not exist/i.test(
    String(error && error.message || '')
  );
}

function displayName(profile) {
  if (!profile) return '—';
  if (profile.account_type === 'business') return profile.business_name || profile.full_name || '—';
  return profile.full_name || profile.business_name || '—';
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function authRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message || 'Sign-in failed');
  }
  return data;
}

function sessionFromAuth(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    user: {
      id: data.user && data.user.id,
      email: data.user && data.user.email,
    },
  };
}

async function ensureSession() {
  const session = readSession();
  if (!session || !session.accessToken) return null;
  if (session.expiresAt - Date.now() > 60_000) return session;

  const refreshed = await authRequest('/auth/v1/token?grant_type=refresh_token', {
    refresh_token: session.refreshToken,
  });
  const next = sessionFromAuth(refreshed);
  writeSession(next);
  return next;
}

async function api(path, options = {}) {
  const session = await ensureSession();
  if (!session) throw new Error('Sign in required');

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = parseJson(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message = (data && (data.message || data.error_description || data.msg)) || 'Request failed';
    throw new Error(message);
  }
  return data;
}

function rpc(name, args) {
  return api(`/rest/v1/rpc/${name}`, { method: 'POST', body: args || {} });
}

async function lookupAdmin(userId) {
  const rows = await api(
    `/rest/v1/admins?select=user_id,created_at&user_id=eq.${encodeURIComponent(userId)}`
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

function show(name) {
  for (const id of ['login', 'denied', 'shell']) {
    $(id).classList.toggle('hidden', id !== name);
  }
}

function setSection(section) {
  state.section = section;
  const title = $('title');
  if (title) title.textContent = SECTION_TITLES[section] || 'Admin';
  location.hash = section;
  document.querySelectorAll('.sidebar button[data-section]').forEach((button) => {
    button.setAttribute('aria-current', button.dataset.section === section ? 'page' : 'false');
  });
  renderSection();
}

function pageResult(data) {
  const row = data && typeof data === 'object' ? data : {};
  const rows = Array.isArray(row.rows) ? row.rows : [];
  return {
    rows,
    total: Number(row.total ?? rows.length) || 0,
    page: Number(row.page ?? 1) || 1,
  };
}

function pager(page, total, action) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return `<div class="pager">
    <button class="ghost" data-action="${action}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
    <span class="muted">${page} / ${pages} · ${total} rows</span>
    <button class="ghost" data-action="${action}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>
  </div>`;
}

function panelMessage(text, kind) {
  return `<div class="notice banner ${kind || 'info'}">${escapeHtml(text)}</div>`;
}

async function renderSection() {
  const root = $('content');
  root.innerHTML = '<div class="loading">Loading…</div>';
  try {
    if (state.section === 'dashboard') await renderDashboard(root);
    else if (state.section === 'users') await renderUsers(root);
    else if (state.section === 'listings') await renderListings(root);
    else if (state.section === 'reports') await renderReports(root);
    else if (state.section === 'deals') await renderDeals(root);
    else if (state.section === 'categories') await renderCategories(root);
    else if (state.section === 'suggestions') await renderSuggestions(root);
    else if (state.section === 'verification') await renderVerification(root);
    else await renderSettings(root);
  } catch (error) {
    root.innerHTML = panelMessage(error.message || 'This section could not be loaded.', 'form-error');
  }
}

async function renderDashboard(root) {
  const [stats, active, recentProfiles, recentListings, counts, reviews, offers] = await Promise.all([
    rpc('get_admin_dashboard_stats'),
    rpc('admin_list_listings', { search: null, category: null, status: 'active', owner_id: null, page: 1, page_size: 8 }),
    rpc('admin_list_profiles', { search: null, page: 1, page_size: 8 }),
    rpc('admin_list_listings', { search: null, category: null, status: null, owner_id: null, page: 1, page_size: 8 }),
    rpc('admin_report_counts'),
    api('/rest/v1/reviews?select=id,rating,created_at&order=created_at.desc&limit=6'),
    api('/rest/v1/offers?select=id,status,created_at&order=created_at.desc&limit=6'),
  ]);
  const profiles = pageResult(recentProfiles);
  const listings = pageResult(recentListings);
  const activeCount = pageResult(active).total;
  const activity = [
    ...(Array.isArray(reviews) ? reviews.map((row) => ({ kind: 'Review', label: `Rating ${row.rating}`, created_at: row.created_at })) : []),
    ...(Array.isArray(offers) ? offers.map((row) => ({ kind: 'Offer', label: row.status || 'Offer', created_at: row.created_at })) : []),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  root.innerHTML = `
    <div class="stats">
      <div class="stat"><span>Registered users</span><b>${escapeHtml(stats.users)}</b></div>
      <div class="stat"><span>Active listings</span><b>${escapeHtml(activeCount)}</b></div>
      <div class="stat"><span>Deals</span><b>${escapeHtml(stats.deals)}</b></div>
      <div class="stat"><span>Open reports</span><b>${escapeHtml(counts.open)}</b></div>
    </div>
    <div class="stats">
      ${REPORT_STATUSES.map((status) => `<div class="stat"><span>${escapeHtml(status)}</span><b>${escapeHtml(counts[status])}</b></div>`).join('')}
    </div>
    <section class="panel"><h2>Recent registrations</h2>
      ${profiles.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Registered</th></tr></thead><tbody>
        ${profiles.rows.map((profile) => `<tr><td>${escapeHtml(displayName(profile))}</td><td>${escapeHtml(profile.account_type || '—')}</td><td>${escapeHtml(formatWhen(profile.created_at))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No registrations.</p>'}
    </section>
    <section class="panel"><h2>Recent listings</h2>
      ${listings.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Created</th></tr></thead><tbody>
        ${listings.rows.map((listing) => `<tr><td>${escapeHtml(listing.title)}</td><td>${escapeHtml(listing.category || '—')}</td><td>${badge(listing.status)}</td><td>${escapeHtml(formatWhen(listing.created_at))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No listings.</p>'}
    </section>
    <section class="panel"><h2>Recent activity</h2>
      ${activity.length ? `<div class="table-wrap"><table><thead><tr><th>Type</th><th>Detail</th><th>When</th></tr></thead><tbody>
        ${activity.map((item) => `<tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(formatWhen(item.created_at))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No recent reviews or offers.</p>'}
    </section>`;
}

async function renderUsers(root) {
  const result = pageResult(await rpc('admin_list_profiles', {
    search: state.users.query || null,
    page: state.users.page,
    page_size: PAGE_SIZE,
  }));
  if (state.users.selected && !result.rows.some((row) => row.id === state.users.selected.id)) {
    state.users.selected = null;
  }
  const selected = result.rows.find((row) => state.users.selected && row.id === state.users.selected.id) || null;
  let ownerListings = [];
  if (selected) {
    ownerListings = pageResult(await rpc('admin_list_listings', {
      search: null,
      category: null,
      status: null,
      owner_id: selected.id,
      page: 1,
      page_size: PAGE_SIZE,
    })).rows;
  }

  root.innerHTML = `
    <div class="filters">
      <input id="user-search" value="${escapeHtml(state.users.query)}" placeholder="Search name">
    </div>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Role</th><th>Status</th><th>Registered</th></tr></thead><tbody>
      ${result.rows.map((profile) => `<tr data-action="select-user" data-id="${escapeHtml(profile.id)}" aria-selected="${selected && selected.id === profile.id}">
        <td>${escapeHtml(displayName(profile))}</td>
        <td>${escapeHtml(profile.account_type || '—')}</td>
        <td>${escapeHtml(profile.role || '—')}</td>
        <td>${badge(profile.is_active !== false)}</td>
        <td>${escapeHtml(formatWhen(profile.created_at))}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No matching users.</p>'}
    ${pager(result.page, result.total, 'users-page')}
    ${selected ? `<section class="panel"><h2>${escapeHtml(displayName(selected))}</h2>
      <p class="muted">Account id ${escapeHtml(selected.id)}</p>
      <p>Type ${escapeHtml(selected.account_type || '—')} · Role ${escapeHtml(selected.role || '—')} · ${selected.is_active === false ? 'Inactive' : 'Active'}</p>
      <p class="muted">Registered ${escapeHtml(formatWhen(selected.created_at))}</p>
      ${panelMessage('Account activation cannot be changed here. There is no admin function that updates account status.')}
      <h3>Listings</h3>
      ${ownerListings.length ? `<div class="table-wrap"><table><thead><tr><th>Title</th><th>Status</th></tr></thead><tbody>
        ${ownerListings.map((listing) => `<tr><td>${escapeHtml(listing.title)}</td><td>${badge(listing.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No listings for this account.</p>'}
    </section>` : panelMessage('Select a user to see details.')}`;

  $('user-search').addEventListener('change', (event) => {
    state.users.query = event.target.value.trim();
    state.users.page = 1;
    renderSection();
  });
}

async function renderListings(root) {
  const result = pageResult(await rpc('admin_list_listings', {
    search: state.listings.query || null,
    category: state.listings.category || null,
    status: state.listings.status === 'all' ? null : state.listings.status,
    owner_id: null,
    page: state.listings.page,
    page_size: PAGE_SIZE,
  }));
  const selected = result.rows.find((row) => row.id === state.listings.selected) || null;

  root.innerHTML = `
    <div class="filters">
      <input id="listing-search" value="${escapeHtml(state.listings.query)}" placeholder="Search title, category, or city">
      <select id="listing-category">
        <option value="">All categories</option>
        ${CATEGORIES.map((name) => `<option value="${escapeHtml(name)}" ${name === state.listings.category ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
      </select>
      <select id="listing-status">
        <option value="all">All statuses</option>
        ${LISTING_STATUSES.map((status) => `<option value="${status}" ${status === state.listings.status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
    </div>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Title</th><th>Category</th><th>City</th><th>Status</th><th>Owner</th></tr></thead><tbody>
      ${result.rows.map((listing) => `<tr data-action="select-listing" data-id="${escapeHtml(listing.id)}" aria-selected="${selected && selected.id === listing.id}">
        <td>${escapeHtml(listing.title)}</td><td>${escapeHtml(listing.category || '—')}</td><td>${escapeHtml(listing.city || '—')}</td><td>${badge(listing.status)}</td><td>${escapeHtml(listing.user_id)}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No matching listings.</p>'}
    ${pager(result.page, result.total, 'listings-page')}
    ${selected ? `<section class="panel"><h2>${escapeHtml(selected.title)}</h2>
      <p class="muted">Owner ${escapeHtml(selected.user_id)}</p>
      <p>${escapeHtml([selected.category, selected.subcategory, selected.city].filter(Boolean).join(' · ') || '—')}</p>
      <p>${selected.budget != null ? escapeHtml(`${selected.budget} ${selected.currency || ''}`) : '—'}</p>
      <p>${escapeHtml(selected.description || '')}</p>
      <div class="chips">${LISTING_STATUSES.map((status) => `<button class="ghost" data-action="listing-status" data-id="${escapeHtml(selected.id)}" data-status="${status}" aria-pressed="${selected.status === status}">${status}</button>`).join('')}</div>
    </section>` : panelMessage('Select a listing to moderate it.')}`;

  $('listing-search').addEventListener('change', (event) => {
    state.listings.query = event.target.value.trim();
    state.listings.page = 1;
    renderSection();
  });
  $('listing-category').addEventListener('change', (event) => {
    state.listings.category = event.target.value;
    state.listings.page = 1;
    renderSection();
  });
  $('listing-status').addEventListener('change', (event) => {
    state.listings.status = event.target.value;
    state.listings.page = 1;
    renderSection();
  });
}

async function renderReports(root) {
  const result = pageResult(await rpc('admin_list_reports', {
    status: state.reports.status === 'all' ? null : state.reports.status,
    page: state.reports.page,
    page_size: PAGE_SIZE,
  }));
  let selected = null;
  const selectedReportId = reportId(state.reports.selected);
  if (selectedReportId != null) {
    selected = await rpc('admin_report', { report_id: selectedReportId });
    if (!state.reports.noteLoaded) {
      state.reports.note = selected.admin_note || '';
      state.reports.nextStatus = selected.status || 'open';
      state.reports.noteLoaded = true;
    }
  }

  const reportRows = result.rows.map((report) => {
    const rowId = reportId(report.id);
    return `<tr data-action="select-report" data-id="${escapeHtml(rowId || '')}" aria-selected="${selectedReportId !== null && selectedReportId === rowId}">
        <td>${escapeHtml(report.reason)}</td><td>${badge(report.status)}</td><td>${escapeHtml(formatWhen(report.created_at))}</td>
      </tr>`;
  }).join('');

  root.innerHTML = `
    <div class="chips">${['all', ...REPORT_STATUSES].map((status) => `<button class="ghost" data-action="reports-filter" data-status="${status}" aria-pressed="${state.reports.status === status}">${status}</button>`).join('')}</div>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Reason</th><th>Status</th><th>Created</th></tr></thead><tbody>
      ${reportRows}
    </tbody></table></div>` : '<p class="empty">No reports.</p>'}
    ${pager(result.page, result.total, 'reports-page')}
    ${selected ? `<section class="panel"><h2>${escapeHtml(selected.reason)}</h2>
      <p class="muted">Reporter ${escapeHtml(selected.reporter_id)} · Reported account ${escapeHtml(selected.reported_user_id || '—')}</p>
      <p class="muted">Task ${escapeHtml(selected.task_id ?? '—')} · Created ${escapeHtml(formatWhen(selected.created_at))} · Resolved ${escapeHtml(formatWhen(selected.resolved_at))}</p>
      <p>${escapeHtml(selected.description || '')}</p>
      <label for="report-note">Admin note</label>
      <textarea id="report-note">${escapeHtml(state.reports.note)}</textarea>
      <div class="chips">${REPORT_STATUSES.map((status) => `<button class="ghost" data-action="report-status" data-status="${status}" aria-pressed="${state.reports.nextStatus === status}">${status}</button>`).join('')}</div>
      <button class="primary" data-action="save-report" data-id="${escapeHtml(reportId(selected.id) || '')}">Save report</button>
      <div id="report-error"></div>
    </section>` : panelMessage('Select a report to review it.')}`;
}

async function renderDeals(root) {
  const [stats, rows] = await Promise.all([
    rpc('get_admin_dashboard_stats'),
    api('/rest/v1/deals?select=id,listing_id,status,created_at&order=created_at.desc&limit=20'),
  ]);
  const deals = Array.isArray(rows) ? rows : [];
  root.innerHTML = `
    <div class="stat"><span>All deals</span><b>${escapeHtml(stats.deals)}</b></div>
    ${panelMessage('The count includes every deal. The table shows only deals this signed-in account participates in. There is no admin function for a full deal directory, and payment fields are not requested.')}
    ${deals.length ? `<div class="table-wrap"><table><thead><tr><th>Deal</th><th>Listing</th><th>Status</th><th>Created</th></tr></thead><tbody>
      ${deals.map((deal) => `<tr><td>${escapeHtml(deal.id)}</td><td>${escapeHtml(deal.listing_id)}</td><td>${badge(deal.status)}</td><td>${escapeHtml(formatWhen(deal.created_at))}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No deals are visible for this account.</p>'}`;
}

async function renderCategories(root) {
  root.innerHTML = `
    ${panelMessage('Categories are defined in the app catalog. There is no categories table and no admin function to edit them. Submitted ideas are listed under Category Suggestions.')}
    <div class="table-wrap"><table><thead><tr><th>Catalog category</th></tr></thead><tbody>
      ${CATEGORIES.map((name) => `<tr><td>${escapeHtml(name)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

async function renderSuggestions(root) {
  let result;
  try {
    result = pageResult(await rpc('admin_list_category_suggestions', {
      search: state.suggestions.query || null,
      status: state.suggestions.status === 'all' ? null : state.suggestions.status,
      page: state.suggestions.page,
      page_size: PAGE_SIZE,
    }));
  } catch (error) {
    if (missingRpc(error)) {
      root.innerHTML = panelMessage('Category suggestions are not available to administrators yet. The database functions in 20261101210000_admin_category_suggestions.sql have not been applied. Existing row access still shows a person only their own suggestion.');
      return;
    }
    throw error;
  }

  let selected = null;
  if (state.suggestions.selected) {
    try {
      selected = await rpc('admin_category_suggestion', {
        suggestion_id: state.suggestions.selected,
      });
    } catch (error) {
      if (!missingRpc(error) && !/not found/i.test(String(error.message || ''))) throw error;
      state.suggestions.selected = null;
    }
  }
  const processed = selected && (selected.status === 'accepted' || selected.status === 'rejected');

  root.innerHTML = `
    <div class="filters">
      <input id="suggestion-search" value="${escapeHtml(state.suggestions.query)}" placeholder="Search suggestion text">
    </div>
    <div class="chips">${SUGGESTION_FILTERS.map((item) => `<button class="ghost" data-action="suggestions-filter" data-status="${item.value}" aria-pressed="${state.suggestions.status === item.value}">${item.label}</button>`).join('')}</div>
    ${panelMessage('Approving records the status as accepted. It does not add a category. The catalog is application code, and this table has no admin note column.')}
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Suggestion</th><th>Type</th><th>Submitter</th><th>Status</th><th>Submitted</th></tr></thead><tbody>
      ${result.rows.map((row) => `<tr data-action="select-suggestion" data-id="${escapeHtml(row.id)}" aria-selected="${selected && selected.id === row.id}">
        <td>${escapeHtml(row.suggestion)}</td>
        <td>${escapeHtml(row.listing_type || '—')}</td>
        <td>${escapeHtml(row.user_id || '—')}</td>
        <td>${badge(row.status)}</td>
        <td>${escapeHtml(formatWhen(row.created_at))}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No matching suggestions.</p>'}
    ${pager(result.page, result.total, 'suggestions-page')}
    ${selected ? `<section class="panel"><h2>Suggestion</h2>
      <p>${escapeHtml(selected.suggestion)}</p>
      <p class="muted">The suggestion text is the only description the form stores. There is no separate comment field.</p>
      <p class="muted">Submitter ${escapeHtml(selected.user_id || '—')}</p>
      <p class="muted">Type ${escapeHtml(selected.listing_type || '—')} · City ${escapeHtml(selected.city || '—')} · Language ${escapeHtml(selected.language || '—')}</p>
      <p class="muted">Submitted ${escapeHtml(formatWhen(selected.created_at))} · Updated ${escapeHtml(formatWhen(selected.updated_at))}</p>
      <p>Status ${badge(selected.status)}</p>
      ${processed ? panelMessage('This suggestion is already processed. Approving or rejecting it again is blocked.') : `<div class="chips">
        <button class="ghost" data-action="suggestion-status" data-id="${escapeHtml(selected.id)}" data-status="reviewed" ${selected.status === 'reviewed' ? 'disabled' : ''}>Mark as reviewing</button>
        <button class="ghost" data-action="suggestion-status" data-id="${escapeHtml(selected.id)}" data-status="accepted">Approve</button>
        <button class="ghost" data-action="suggestion-status" data-id="${escapeHtml(selected.id)}" data-status="rejected">Reject</button>
      </div>`}
      <div id="suggestion-error"></div>
    </section>` : panelMessage('Select a suggestion to review it.')}`;

  $('suggestion-search').addEventListener('change', (event) => {
    state.suggestions.query = event.target.value.trim();
    state.suggestions.page = 1;
    renderSection();
  });
}

function providerLabel(provider) {
  if (provider === 'smart_id') return 'Smart-ID';
  if (provider === 'mobile_id') return 'Mobile-ID';
  if (provider === 'didit') return 'Document + Selfie';
  return provider || '—';
}

function verificationFailure(code) {
  const labels = {
    sandbox_not_identity: 'Sandbox result. Not identity verification.',
    demo_not_identity: 'Demo result. Not identity verification.',
    required_checks_missing: 'A required check was missing or not approved.',
    wrong_workflow: 'Workflow did not match the configured workflow.',
    live_acceptance_not_enabled: 'Live acceptance is not enabled.',
    superseded: 'Replaced by a newer attempt.',
  };
  if (!code) return '—';
  if (Object.prototype.hasOwnProperty.call(labels, code)) return labels[code];
  return /^[a-z0-9_]{1,80}$/.test(code) ? code : '—';
}

function verificationResult(row) {
  const sandbox = typeof row.failure_code === 'string' && row.failure_code.indexOf('sandbox_') === 0;
  if (sandbox) return '<span class="badge warn">Sandbox — not verified</span>';
  if (row.authoritative === true && row.identity_verified === true) return '<span class="badge ok">Verified</span>';
  return '<span class="badge">Not verified</span>';
}

function avatarCell(row) {
  const name = displayName(row);
  const host = 'https://rmjavihkusnwdalwzlmt.supabase.co/';
  const image = typeof row.avatar_url === 'string' && row.avatar_url.startsWith(host)
    ? `<img class="avatar" src="${escapeHtml(row.avatar_url)}" alt="">`
    : `<span class="avatar-fallback">${escapeHtml(name.charAt(0) || '?')}</span>`;
  return `<div class="person">${image}<span>${escapeHtml(name)}</span></div>`;
}

async function renderVerification(root) {
  const filters = state.verification;
  let counts = { verified_users: 0, pending_attempts: 0, failed_attempts: 0 };
  try {
    counts = await rpc('admin_verification_counts');
  } catch (error) {
    if (missingRpc(error)) {
      root.innerHTML = panelMessage('Identity verification is not available until local migration 20261101230000_identity_verification.sql is applied.', 'form-error');
      return;
    }
    throw error;
  }
  const result = pageResult(await rpc('admin_list_verification_attempts', {
    search: filters.query || null,
    status: filters.status === 'all' ? null : filters.status,
    provider: filters.provider === 'all' ? null : filters.provider,
    page: filters.page,
    page_size: PAGE_SIZE,
  }));
  const selected = result.rows.find((row) => row.user_id === filters.selected) || null;
  let history = [];
  if (selected) {
    history = (await rpc('admin_verification_history', { target_user: selected.user_id })).rows || [];
  }
  const statuses = ['all', 'pending', 'in_review', 'approved', 'declined', 'failed', 'cancelled', 'expired'];
  const providers = ['all', 'smart_id', 'mobile_id', 'didit'];
  root.innerHTML = `
    <div class="stats">
      <article class="stat"><span>Verified users</span><b>${escapeHtml(counts.verified_users)}</b></article>
      <article class="stat"><span>Pending attempts</span><b>${escapeHtml(counts.pending_attempts)}</b></article>
      <article class="stat"><span>Failed attempts</span><b>${escapeHtml(counts.failed_attempts)}</b></article>
    </div>
    ${panelMessage('Administrators cannot set identity verification manually. Demo and sandbox results stay unverified until a trusted provider result is authoritative.')}
    <div class="filters">
      <input id="verification-search" value="${escapeHtml(filters.query)}" placeholder="Search name">
      <select id="verification-status">
        ${statuses.map((status) => `<option value="${status}" ${status === filters.status ? 'selected' : ''}>${status === 'all' ? 'All statuses' : status}</option>`).join('')}
      </select>
      <select id="verification-provider">
        ${providers.map((provider) => `<option value="${provider}" ${provider === filters.provider ? 'selected' : ''}>${provider === 'all' ? 'All providers' : providerLabel(provider)}</option>`).join('')}
      </select>
    </div>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>User</th><th>Provider</th><th>Status</th><th>Result</th><th>Started</th><th>Completed</th><th>Failure</th></tr></thead><tbody>
      ${result.rows.map((row) => `<tr data-action="select-verification" data-id="${escapeHtml(row.user_id)}" aria-selected="${selected && selected.user_id === row.user_id}">
        <td>${avatarCell(row)}</td>
        <td>${escapeHtml(providerLabel(row.provider))}</td>
        <td>${badge(row.status)}</td>
        <td>${verificationResult(row)}</td>
        <td>${escapeHtml(formatWhen(row.created_at))}</td>
        <td>${escapeHtml(formatWhen(row.completed_at))}</td>
        <td>${escapeHtml(verificationFailure(row.failure_code))}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No verification attempts.</p>'}
    ${pager(result.page, result.total, 'verification-page')}
    ${selected ? `<section class="panel"><h2>Verification history</h2>
      ${history.length ? `<div class="table-wrap"><table><thead><tr><th>Provider</th><th>Status</th><th>Result</th><th>Started</th><th>Completed</th><th>Failure</th></tr></thead><tbody>
        ${history.map((row) => `<tr><td>${escapeHtml(providerLabel(row.provider))}</td><td>${badge(row.status)}</td><td>${verificationResult(row)}</td><td>${escapeHtml(formatWhen(row.created_at))}</td><td>${escapeHtml(formatWhen(row.completed_at))}</td><td>${escapeHtml(verificationFailure(row.failure_code))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No history for this user.</p>'}
    </section>` : ''}`;
  $('verification-search').addEventListener('change', (event) => {
    state.verification.query = event.target.value.trim();
    state.verification.page = 1;
    renderSection();
  });
  $('verification-status').addEventListener('change', (event) => {
    state.verification.status = event.target.value;
    state.verification.page = 1;
    renderSection();
  });
  $('verification-provider').addEventListener('change', (event) => {
    state.verification.provider = event.target.value;
    state.verification.page = 1;
    renderSection();
  });
}

function renderSettings(root) {
  const session = readSession();
  root.innerHTML = `
    <section class="panel">
      <h2>Administrator</h2>
      <p>${escapeHtml(session && session.user && session.user.email || 'Signed in')}</p>
      <p class="muted">Account id ${escapeHtml(state.user && state.user.id || '')}</p>
      <p class="muted">Admin since ${escapeHtml(formatWhen(state.adminSince))}</p>
      <button class="danger" data-action="logout">Log out</button>
    </section>`;
}

async function signIn(event) {
  event.preventDefault();
  $('login-error').textContent = '';
  try {
    const data = await authRequest('/auth/v1/token?grant_type=password', {
      email: $('email').value.trim(),
      password: $('password').value,
    });
    const session = sessionFromAuth(data);
    writeSession(session);
    $('password').value = '';
    await enter();
  } catch (error) {
    $('login-error').textContent = 'Sign-in failed. Check the email and password.';
  }
}

async function logout() {
  const session = readSession();
  clearSession();
  if (session && session.accessToken) {
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
      },
    }).catch(() => {});
  }
  state.user = null;
  show('login');
}

async function enter() {
  const session = await ensureSession();
  if (!session || !session.user || !session.user.id) {
    show('login');
    return;
  }
  const admin = await lookupAdmin(session.user.id);
  if (!admin) {
    show('denied');
    return;
  }
  state.user = session.user;
  state.adminSince = admin.created_at;
  show('shell');
  setSection((location.hash || '#dashboard').slice(1) || 'dashboard');
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action], [data-section]');
  if (!button) return;
  if (button.dataset.section) {
    setSection(button.dataset.section);
    return;
  }
  const action = button.dataset.action;
  if (action === 'logout') {
    logout();
    return;
  }
  if (action === 'users-page' || action === 'listings-page' || action === 'reports-page' || action === 'suggestions-page' || action === 'verification-page') {
    const page = Number(button.dataset.page);
    if (page < 1) return;
    if (action === 'users-page') state.users.page = page;
    if (action === 'listings-page') state.listings.page = page;
    if (action === 'reports-page') state.reports.page = page;
    if (action === 'suggestions-page') state.suggestions.page = page;
    if (action === 'verification-page') state.verification.page = page;
    renderSection();
    return;
  }
  if (action === 'suggestions-filter') {
    state.suggestions.status = button.dataset.status;
    state.suggestions.page = 1;
    renderSection();
    return;
  }
  if (action === 'select-suggestion') {
    state.suggestions.selected = button.dataset.id;
    renderSection();
    return;
  }
  if (action === 'suggestion-status') {
    button.disabled = true;
    try {
      await rpc('admin_update_category_suggestion', {
        suggestion_id: button.dataset.id,
        next_status: button.dataset.status,
      });
      renderSection();
    } catch (error) {
      button.disabled = false;
      const slot = $('suggestion-error');
      if (slot) slot.innerHTML = panelMessage(error.message || 'Suggestion could not be updated.', 'form-error');
    }
    return;
  }
  if (action === 'select-verification') {
    state.verification.selected = button.dataset.id;
    renderSection();
    return;
  }
  if (action === 'select-user') {
    state.users.selected = { id: button.dataset.id };
    renderSection();
    return;
  }
  if (action === 'select-listing') {
    state.listings.selected = button.dataset.id;
    renderSection();
    return;
  }
  if (action === 'listing-status') {
    button.disabled = true;
    try {
      await rpc('admin_set_listing_status', {
        listing_id: button.dataset.id,
        next_status: button.dataset.status,
      });
      renderSection();
    } catch (error) {
      button.disabled = false;
      alert(error.message || 'Listing status could not be changed.');
    }
    return;
  }
  if (action === 'reports-filter') {
    state.reports.status = button.dataset.status;
    state.reports.page = 1;
    renderSection();
    return;
  }
  if (action === 'select-report') {
    const id = reportId(button.dataset.id);
    if (id == null) return;
    state.reports.selected = id;
    state.reports.noteLoaded = false;
    renderSection();
    return;
  }
  if (action === 'report-status') {
    state.reports.nextStatus = button.dataset.status;
    state.reports.note = $('report-note') ? $('report-note').value : state.reports.note;
    renderSection();
    return;
  }
  if (action === 'save-report') {
    const note = $('report-note') ? $('report-note').value : state.reports.note;
    try {
      const id = reportId(button.dataset.id);
      if (id == null) {
        const slot = $('report-error');
        if (slot) slot.innerHTML = panelMessage('This report identifier could not be used.');
        return;
      }
      await rpc('admin_update_report', {
        report_id: id,
        next_status: state.reports.nextStatus,
        admin_note: note,
      });
      state.reports.noteLoaded = false;
      renderSection();
    } catch (error) {
      const slot = $('report-error');
      if (slot) slot.innerHTML = panelMessage(error.message || 'Report could not be saved.');
    }
  }
});

$('login-form').addEventListener('submit', signIn);
$('denied-logout').addEventListener('click', logout);
enter().catch((error) => {
  show('login');
  const slot = $('login-error');
  if (slot) slot.textContent = error.message || 'Admin access could not be verified.';
});
