const SUPABASE_URL = 'https://rmjavihkusnwdalwzlmt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zwR1kDFTjxbeQ5WBYmzw3g_UqkUfKNX';
const SESSION_KEY = 'youneed-web-admin-session';
const PAGE_SIZE = 20;

const LISTING_STATUSES = ['draft', 'active', 'paused', 'in_progress', 'completed', 'cancelled'];
const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'rejected'];
const OFFER_STATUSES = ['pending', 'accepted', 'declined'];
const DEAL_STATUSES = ['pending', 'accepted', 'in_progress', 'provider_completed', 'waiting_client', 'completed', 'cancelled', 'disputed'];
const CRM_MIGRATION = 'The CRM functions are not available in this session, so platform-wide records stay hidden.';
const USER_ACTIVITY = [
  ['listings_task', 'Listings published'],
  ['listings_service', 'Services published'],
  ['offers_sent', 'Offers sent'],
  ['offers_received', 'Offers received'],
  ['deals_client', 'Deals as a client'],
  ['deals_provider', 'Deals as a provider'],
  ['reports_submitted', 'Reports submitted'],
  ['reports_received', 'Reports received'],
  ['disputes', 'Disputes'],
];
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
  offers: 'Offers',
  deals: 'Deals',
  reports: 'Reports',
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
  users: { query: '', page: 1, selected: null, activityPage: {} },
  listings: { query: '', category: '', status: 'all', page: 1, selected: null },
  offers: { query: '', status: 'all', user: '', from: '', to: '', page: 1, selected: null },
  deals: { query: '', status: 'all', user: '', from: '', to: '', page: 1, selected: null, messagesPage: 1 },
  reports: { query: '', status: 'all', user: '', page: 1, selected: null, note: '', nextStatus: 'open', noteLoaded: false },
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

function named(name, id) {
  return name || id || '—';
}

function linkButton(action, id, label) {
  if (id == null || id === '') return '—';
  return `<button class="linkish" type="button" data-action="${action}" data-id="${escapeHtml(id)}">${escapeHtml(named(label, id))}</button>`;
}

function uuidOrNull(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : undefined;
}

function dateRange(from, to) {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T00:00:00`) : null;
  if (end && !Number.isNaN(end.getTime())) end.setDate(end.getDate() + 1);
  return {
    created_from: start && !Number.isNaN(start.getTime()) ? start.toISOString() : null,
    created_to: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
  };
}

function money(amount, currency) {
  if (amount == null || amount === '') return '—';
  return `${amount} ${currency || ''}`.trim();
}

function fact(label, value) {
  return `<div class="fact"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '—')}</b></div>`;
}

function identityText(card) {
  if (!card || card.identity_available !== true) return 'Identity tables are not available';
  if (card.identity_verified === true) return `Verified ${formatWhen(card.identity_verified_at)}`;
  return 'Not verified';
}

function openRecord(section, id) {
  if (section === 'users') {
    state.users.selected = id;
    state.users.activityPage = {};
  } else if (section === 'listings') {
    state.listings.selected = id;
  } else if (section === 'offers') {
    state.offers.selected = integerId(id);
  } else if (section === 'deals') {
    state.deals.selected = id;
    state.deals.messagesPage = 1;
  } else if (section === 'reports') {
    state.reports.selected = integerId(id);
    state.reports.noteLoaded = false;
  }
  setSection(section);
}

function integerId(value) {
  return reportId(value);
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

function pager(page, total, action, extra) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const attrs = extra ? ` ${extra}` : '';
  return `<div class="pager">
    <button class="ghost" data-action="${action}" data-page="${page - 1}"${attrs} ${page <= 1 ? 'disabled' : ''}>Previous</button>
    <span class="muted">${page} / ${pages} · ${total} rows</span>
    <button class="ghost" data-action="${action}" data-page="${page + 1}"${attrs} ${page >= pages ? 'disabled' : ''}>Next</button>
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
    else if (state.section === 'offers') await renderOffers(root);
    else if (state.section === 'deals') await renderDeals(root);
    else if (state.section === 'reports') await renderReports(root);
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
  const selectedId = state.users.selected;
  let detail = '';
  if (selectedId) {
    detail = await userDetail(selectedId);
  }

  root.innerHTML = `
    <div class="filters">
      <input id="user-search" value="${escapeHtml(state.users.query)}" placeholder="Search name">
    </div>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Role</th><th>Status</th><th>Registered</th></tr></thead><tbody>
      ${result.rows.map((profile) => `<tr data-action="select-user" data-id="${escapeHtml(profile.id)}" aria-selected="${profile.id === selectedId}">
        <td>${escapeHtml(displayName(profile))}</td>
        <td>${escapeHtml(profile.account_type || '—')}</td>
        <td>${escapeHtml(profile.role || '—')}</td>
        <td>${badge(profile.is_active !== false)}</td>
        <td>${escapeHtml(formatWhen(profile.created_at))}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No matching users.</p>'}
    ${pager(result.page, result.total, 'users-page')}
    ${detail || panelMessage('Select a user to see details.')}`;

  $('user-search').addEventListener('change', (event) => {
    state.users.query = event.target.value.trim();
    state.users.page = 1;
    renderSection();
  });
}

async function userDetail(userId) {
  let card = null;
  try {
    card = await rpc('admin_user_card', { target_user: userId });
  } catch (error) {
    if (!missingRpc(error)) throw error;
  }

  if (!card) {
    const listings = pageResult(await rpc('admin_list_listings', {
      search: null,
      category: null,
      status: null,
      owner_id: userId,
      page: 1,
      page_size: PAGE_SIZE,
    })).rows;
    return `<section class="panel"><h2>User</h2>
      <p class="muted">Account id ${escapeHtml(userId)}</p>
      ${panelMessage(CRM_MIGRATION)}
      ${panelMessage('Account activation cannot be changed here. There is no admin function that updates account status.')}
      <h3>Listings</h3>
      ${listings.length ? `<div class="table-wrap"><table><thead><tr><th>Title</th><th>Status</th></tr></thead><tbody>
        ${listings.map((listing) => `<tr><td>${linkButton('open-listing', listing.id, listing.title)}</td><td>${badge(listing.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No listings for this account.</p>'}
    </section>`;
  }

  const activity = await Promise.all(USER_ACTIVITY.map(async ([kind, title]) => {
    const page = state.users.activityPage[kind] || 1;
    const result = pageResult(await rpc('admin_user_activity', {
      target_user: userId,
      kind,
      page,
      page_size: PAGE_SIZE,
    }));
    return { kind, title, result };
  }));
  const identity = identityText(card);

  return `<section class="panel"><h2>${escapeHtml(displayName(card))}</h2>
    <div class="facts">
      ${fact('User ID', card.id)}
      ${fact('Full name', card.full_name)}
      ${fact('Email', card.email)}
      ${fact('Phone', card.phone)}
      ${fact('Business phone', card.business_phone)}
      ${fact('Sign-in phone', card.sign_in_phone)}
      ${fact('Address', card.address)}
      ${fact('Business address', card.business_address)}
      ${fact('City', card.city)}
      ${fact('District', card.district)}
      ${fact('Country', 'Not stored on the profile')}
      ${fact('Registered', formatWhen(card.created_at))}
      ${fact('Profile updated', formatWhen(card.updated_at))}
      ${fact('Last sign-in', formatWhen(card.last_sign_in_at))}
      ${fact('Account type', card.account_type)}
      ${fact('Role', card.role)}
      ${fact('Account status', card.is_active === false ? 'Inactive' : 'Active')}
      ${fact('Availability', card.availability)}
      ${fact('Identity verification', identity)}
    </div>
    ${panelMessage('Account activation cannot be changed here. There is no admin function that updates account status.')}
    <div class="activity-grid">
      ${activity.map(({ kind, title, result }) => `<section class="panel"><h3>${escapeHtml(title)}</h3>
        ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Record</th><th>Status</th><th>When</th></tr></thead><tbody>
          ${result.rows.map((row) => `<tr><td>${linkButton(`open-${row.record_type}`, row.record_id, row.label)}</td><td>${badge(row.status)}</td><td>${escapeHtml(formatWhen(row.created_at))}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">None.</p>'}
        ${pager(result.page, result.total, 'user-activity', `data-kind="${kind}"`)}
      </section>`).join('')}
    </div>
  </section>`;
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
        <td>${escapeHtml(listing.title)}</td><td>${escapeHtml(listing.category || '—')}</td><td>${escapeHtml(listing.city || '—')}</td><td>${badge(listing.status)}</td><td>${linkButton('open-user', listing.user_id, listing.user_id)}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No matching listings.</p>'}
    ${pager(result.page, result.total, 'listings-page')}
    ${selected ? `<section class="panel"><h2>${escapeHtml(selected.title)}</h2>
      <p class="muted">Owner ${linkButton('open-user', selected.user_id, selected.user_id)}</p>
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
  const userId = uuidOrNull(state.reports.user);
  let result = { rows: [], total: 0, page: state.reports.page };
  let detailed = true;
  let blocked = '';
  if (userId === undefined) {
    blocked = panelMessage('Enter a full user id, or leave the user filter empty.', 'form-error');
  } else {
    try {
      result = pageResult(await rpc('admin_search_reports', {
        search: state.reports.query || null,
        status: state.reports.status === 'all' ? null : state.reports.status,
        user_id: userId,
        page: state.reports.page,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
      detailed = false;
      result = pageResult(await rpc('admin_list_reports', {
        status: state.reports.status === 'all' ? null : state.reports.status,
        page: state.reports.page,
        page_size: PAGE_SIZE,
      }));
    }
  }
  let selected = null;
  const selectedReportId = reportId(state.reports.selected);
  if (!blocked && selectedReportId != null) {
    selected = await rpc(detailed ? 'admin_report_detail' : 'admin_report', { report_id: selectedReportId });
    if (!state.reports.noteLoaded) {
      state.reports.note = selected.admin_note || '';
      state.reports.nextStatus = selected.status || 'open';
      state.reports.noteLoaded = true;
    }
  }

  const reportRows = result.rows.map((report) => {
    const rowId = reportId(report.id);
    return `<tr data-action="select-report" data-id="${escapeHtml(rowId || '')}" aria-selected="${selectedReportId !== null && selectedReportId === rowId}">
        <td>${escapeHtml(report.reason)}</td>
        <td>${linkButton('open-user', report.reporter_id, report.reporter_name || report.reporter_id)}</td>
        <td>${linkButton('open-user', report.reported_user_id, report.reported_name || report.reported_user_id)}</td>
        <td>${linkButton('open-listing', report.listing_id, report.listing_title || report.listing_id)}</td>
        <td>${badge(report.status)}</td>
        <td>${escapeHtml(formatWhen(report.created_at))}</td>
      </tr>`;
  }).join('');

  const relatedOffers = selected && Array.isArray(selected.offers) ? selected.offers : [];
  const relatedDeals = selected && Array.isArray(selected.deals) ? selected.deals : [];
  root.innerHTML = `
    ${blocked || (detailed ? '' : panelMessage(CRM_MIGRATION))}
    <div class="filters">
      <input id="report-search" value="${escapeHtml(state.reports.query)}" placeholder="Search reason, description, name, or listing" ${detailed ? '' : 'disabled'}>
      <input id="report-user" value="${escapeHtml(state.reports.user)}" placeholder="User id" ${detailed ? '' : 'disabled'}>
    </div>
    <div class="chips">${['all', ...REPORT_STATUSES].map((status) => `<button class="ghost" data-action="reports-filter" data-status="${status}" aria-pressed="${state.reports.status === status}">${status}</button>`).join('')}</div>
    ${blocked ? '' : result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Reason</th><th>Reporter</th><th>Reported user</th><th>Listing</th><th>Status</th><th>Created</th></tr></thead><tbody>
      ${reportRows}
    </tbody></table></div>` : '<p class="empty">No reports.</p>'}
    ${blocked ? '' : pager(result.page, result.total, 'reports-page')}
    ${blocked ? '' : selected ? `<section class="panel"><h2>${escapeHtml(selected.reason)}</h2>
      <p>Reporter ${linkButton('open-user', selected.reporter_id, selected.reporter_name || selected.reporter_id)} · Reported account ${linkButton('open-user', selected.reported_user_id, selected.reported_name || selected.reported_user_id)}</p>
      <p>Listing ${linkButton('open-listing', selected.listing_id, selected.listing_title || selected.listing_id)} · Task ${escapeHtml(selected.task_id ?? '—')}</p>
      <p class="muted">Created ${escapeHtml(formatWhen(selected.created_at))} · Resolved ${escapeHtml(formatWhen(selected.resolved_at))}</p>
      <p>${escapeHtml(selected.description || '')}</p>
      ${panelMessage('Reports do not store evidence or attachments. Dispute evidence is shown on the related deal.')}
      <h3>Related offers</h3>
      ${relatedOffers.length ? `<div class="table-wrap"><table><thead><tr><th>Offer</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        ${relatedOffers.map((offer) => `<tr><td>${linkButton('open-offer', offer.id, offer.id)}</td><td>${escapeHtml(money(offer.amount, offer.currency))}</td><td>${badge(offer.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No related offer is stored on this report.</p>'}
      <h3>Related deals</h3>
      ${relatedDeals.length ? `<div class="table-wrap"><table><thead><tr><th>Deal</th><th>Status</th></tr></thead><tbody>
        ${relatedDeals.map((deal) => `<tr><td>${linkButton('open-deal', deal.id, deal.id)}</td><td>${badge(deal.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No related deal is stored on this report.</p>'}
      <label for="report-note">Internal admin note</label>
      <textarea id="report-note">${escapeHtml(state.reports.note)}</textarea>
      <div class="chips">${REPORT_STATUSES.map((status) => `<button class="ghost" data-action="report-status" data-status="${status}" aria-pressed="${state.reports.nextStatus === status}">${status}</button>`).join('')}</div>
      <button class="primary" data-action="save-report" data-id="${escapeHtml(reportId(selected.id) || '')}">Save report</button>
      <div id="report-error"></div>
    </section>` : blocked ? '' : panelMessage('Select a report to review it.')}`;

  const search = $('report-search');
  const user = $('report-user');
  if (search) search.addEventListener('change', (event) => {
    state.reports.query = event.target.value.trim();
    state.reports.page = 1;
    renderSection();
  });
  if (user) user.addEventListener('change', (event) => {
    state.reports.user = event.target.value.trim();
    state.reports.page = 1;
    renderSection();
  });
}

async function renderOffers(root) {
  const userId = uuidOrNull(state.offers.user);
  const range = dateRange(state.offers.from, state.offers.to);
  let result = { rows: [], total: 0, page: state.offers.page };
  let blocked = '';
  if (userId === undefined) {
    blocked = panelMessage('Enter a full user id, or leave the user filter empty.', 'form-error');
  } else {
    try {
      result = pageResult(await rpc('admin_list_offers', {
        search: state.offers.query || null,
        status: state.offers.status === 'all' ? null : state.offers.status,
        user_id: userId,
        created_from: range.created_from,
        created_to: range.created_to,
        page: state.offers.page,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
      blocked = panelMessage(CRM_MIGRATION);
    }
  }
  let selected = null;
  const selectedId = integerId(state.offers.selected);
  if (!blocked && selectedId != null) {
    selected = await rpc('admin_offer', { offer_id: selectedId });
  }
  root.innerHTML = `
    ${panelMessage('Offers are read-only here. Accepting or rejecting an offer stays in the app.')}
    ${blocked}
    <div class="filters">
      <input id="offer-search" value="${escapeHtml(state.offers.query)}" placeholder="Search name, listing, or message">
      <input id="offer-user" value="${escapeHtml(state.offers.user)}" placeholder="User id">
      <input id="offer-from" type="date" value="${escapeHtml(state.offers.from)}">
      <input id="offer-to" type="date" value="${escapeHtml(state.offers.to)}">
      <select id="offer-status">
        <option value="all">All statuses</option>
        ${OFFER_STATUSES.map((status) => `<option value="${status}" ${status === state.offers.status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
    </div>
    ${blocked ? '' : result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Offer</th><th>Provider</th><th>Client</th><th>Listing</th><th>Price</th><th>Message</th><th>Status</th><th>Deal</th><th>Created</th></tr></thead><tbody>
      ${result.rows.map((offer) => {
        const id = integerId(offer.id);
        return `<tr data-action="select-offer" data-id="${escapeHtml(id || '')}" aria-selected="${selectedId !== null && selectedId === id}">
          <td>${escapeHtml(id || '—')}</td>
          <td>${linkButton('open-user', offer.provider_id, offer.provider_name)}</td>
          <td>${linkButton('open-user', offer.client_id, offer.client_name)}</td>
          <td>${linkButton('open-listing', offer.listing_id, offer.listing_title)}</td>
          <td>${escapeHtml(money(offer.amount, offer.currency))}</td>
          <td>${escapeHtml(offer.message_preview || '—')}</td>
          <td>${badge(offer.status)}</td>
          <td>${linkButton('open-deal', offer.deal_id, offer.deal_id ? 'Open' : '')}</td>
          <td>${escapeHtml(formatWhen(offer.created_at))}</td>
        </tr>`;
      }).join('')}
    </tbody></table></div>` : '<p class="empty">No matching offers.</p>'}
    ${blocked ? '' : pager(result.page, result.total, 'offers-page')}
    ${selected ? `<section class="panel"><h2>Offer ${escapeHtml(integerId(selected.id))}</h2>
      <p>Provider ${linkButton('open-user', selected.provider_id, selected.provider_name)} · Client ${linkButton('open-user', selected.client_id, selected.client_name)}</p>
      <p>Listing ${linkButton('open-listing', selected.listing_id, selected.listing_title)} · Deal ${linkButton('open-deal', selected.deal_id, selected.deal_id || 'None')}</p>
      <p>${escapeHtml(money(selected.amount, selected.currency))} · ${badge(selected.status)} · ${escapeHtml(formatWhen(selected.created_at))}</p>
      <p>${escapeHtml(selected.message || 'No message.')}</p>
    </section>` : blocked ? '' : panelMessage('Select an offer to read it.')}`;

  $('offer-search').addEventListener('change', (event) => {
    state.offers.query = event.target.value.trim();
    state.offers.page = 1;
    renderSection();
  });
  $('offer-user').addEventListener('change', (event) => {
    state.offers.user = event.target.value.trim();
    state.offers.page = 1;
    renderSection();
  });
  $('offer-from').addEventListener('change', (event) => {
    state.offers.from = event.target.value;
    state.offers.page = 1;
    renderSection();
  });
  $('offer-to').addEventListener('change', (event) => {
    state.offers.to = event.target.value;
    state.offers.page = 1;
    renderSection();
  });
  $('offer-status').addEventListener('change', (event) => {
    state.offers.status = event.target.value;
    state.offers.page = 1;
    renderSection();
  });
}

async function renderDeals(root) {
  const userId = uuidOrNull(state.deals.user);
  const range = dateRange(state.deals.from, state.deals.to);
  let result = { rows: [], total: 0, page: state.deals.page };
  let blocked = '';
  if (userId === undefined) {
    blocked = panelMessage('Enter a full user id, or leave the user filter empty.', 'form-error');
  } else {
    try {
      result = pageResult(await rpc('admin_list_deals', {
        search: state.deals.query || null,
        status: state.deals.status === 'all' ? null : state.deals.status,
        user_id: userId,
        created_from: range.created_from,
        created_to: range.created_to,
        page: state.deals.page,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
      blocked = panelMessage(CRM_MIGRATION);
    }
  }
  let selected = null;
  let messages = { rows: [], total: 0, page: 1 };
  if (!blocked && state.deals.selected) {
    selected = await rpc('admin_deal', { deal_id: state.deals.selected });
    messages = pageResult(await rpc('admin_deal_messages', {
      deal_id: state.deals.selected,
      page: state.deals.messagesPage,
      page_size: PAGE_SIZE,
    }));
  }
  const disputes = selected && Array.isArray(selected.disputes) ? selected.disputes : [];
  const reports = selected && Array.isArray(selected.reports) ? selected.reports : [];
  root.innerHTML = `
    ${panelMessage('Deal status and payment records are read-only in this dashboard.')}
    ${blocked}
    <div class="filters">
      <input id="deal-search" value="${escapeHtml(state.deals.query)}" placeholder="Search name or listing">
      <input id="deal-user" value="${escapeHtml(state.deals.user)}" placeholder="User id">
      <input id="deal-from" type="date" value="${escapeHtml(state.deals.from)}">
      <input id="deal-to" type="date" value="${escapeHtml(state.deals.to)}">
      <select id="deal-status">
        <option value="all">All statuses</option>
        ${DEAL_STATUSES.map((status) => `<option value="${status}" ${status === state.deals.status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
    </div>
    ${blocked ? '' : result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Deal</th><th>Client</th><th>Provider</th><th>Listing</th><th>Amount</th><th>Status</th><th>Dispute</th><th>Created</th></tr></thead><tbody>
      ${result.rows.map((deal) => `<tr data-action="select-deal" data-id="${escapeHtml(deal.id)}" aria-selected="${selected && selected.id === deal.id}">
        <td>${escapeHtml(deal.id)}</td>
        <td>${linkButton('open-user', deal.client_id, deal.client_name)}</td>
        <td>${linkButton('open-user', deal.provider_id, deal.provider_name)}</td>
        <td>${linkButton('open-listing', deal.listing_id, deal.listing_title)}</td>
        <td>${escapeHtml(money(deal.amount, deal.currency))}</td>
        <td>${badge(deal.status)}</td>
        <td>${badge(deal.dispute_status || 'none')}</td>
        <td>${escapeHtml(formatWhen(deal.created_at))}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No matching deals.</p>'}
    ${blocked ? '' : pager(result.page, result.total, 'deals-page')}
    ${selected ? `<section class="panel"><h2>Deal</h2>
      <p>Client ${linkButton('open-user', selected.client_id, selected.client_name)} · Provider ${linkButton('open-user', selected.provider_id, selected.provider_name)}</p>
      <p>Listing ${linkButton('open-listing', selected.listing_id, selected.listing_title)} · Offer ${linkButton('open-offer', selected.offer_id, selected.offer_id || 'None')}</p>
      <p>${escapeHtml(money(selected.amount, selected.currency))} · ${badge(selected.status)} · Payment ${escapeHtml(selected.payment_status || '—')}</p>
      <p class="muted">Created ${escapeHtml(formatWhen(selected.created_at))} · Messages ${escapeHtml(selected.message_count)}</p>
      <h3>Disputes</h3>
      ${disputes.length ? `<div class="table-wrap"><table><thead><tr><th>Reason</th><th>Status</th><th>Evidence</th></tr></thead><tbody>
        ${disputes.map((dispute) => `<tr><td>${escapeHtml(dispute.reason)}</td><td>${badge(dispute.status)}</td><td>${escapeHtml(Array.isArray(dispute.evidence_urls) && dispute.evidence_urls.length ? dispute.evidence_urls.join(', ') : 'None')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No disputes.</p>'}
      <h3>Reports</h3>
      ${reports.length ? `<div class="table-wrap"><table><thead><tr><th>Reason</th><th>Status</th></tr></thead><tbody>
        ${reports.map((report) => `<tr><td>${linkButton('open-report', report.id, report.reason)}</td><td>${badge(report.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No related reports.</p>'}
      <h3>Conversation</h3>
      ${messages.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>From</th><th>Message</th></tr></thead><tbody>
        ${messages.rows.map((message) => `<tr><td>${escapeHtml(formatWhen(message.created_at))}</td><td>${linkButton('open-user', message.sender_id, message.sender_id)}</td><td>${escapeHtml(message.message)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No messages in this deal.</p>'}
      ${pager(messages.page, messages.total, 'deal-messages-page')}
    </section>` : blocked ? '' : panelMessage('Select a deal to see the participants, listing, offer, reports, and conversation.')}`;

  $('deal-search').addEventListener('change', (event) => {
    state.deals.query = event.target.value.trim();
    state.deals.page = 1;
    renderSection();
  });
  $('deal-user').addEventListener('change', (event) => {
    state.deals.user = event.target.value.trim();
    state.deals.page = 1;
    renderSection();
  });
  $('deal-from').addEventListener('change', (event) => {
    state.deals.from = event.target.value;
    state.deals.page = 1;
    renderSection();
  });
  $('deal-to').addEventListener('change', (event) => {
    state.deals.to = event.target.value;
    state.deals.page = 1;
    renderSection();
  });
  $('deal-status').addEventListener('change', (event) => {
    state.deals.status = event.target.value;
    state.deals.page = 1;
    renderSection();
  });
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
  const recordSections = {
    'open-user': 'users',
    'open-listing': 'listings',
    'open-offer': 'offers',
    'open-deal': 'deals',
    'open-report': 'reports',
  };
  if (recordSections[action]) {
    if (!button.dataset.id) return;
    openRecord(recordSections[action], button.dataset.id);
    return;
  }
  if (action === 'users-page' || action === 'listings-page' || action === 'offers-page' || action === 'deals-page' || action === 'deal-messages-page' || action === 'reports-page' || action === 'suggestions-page' || action === 'verification-page' || action === 'user-activity') {
    const page = Number(button.dataset.page);
    if (page < 1) return;
    if (action === 'users-page') state.users.page = page;
    if (action === 'listings-page') state.listings.page = page;
    if (action === 'offers-page') state.offers.page = page;
    if (action === 'deals-page') state.deals.page = page;
    if (action === 'deal-messages-page') state.deals.messagesPage = page;
    if (action === 'reports-page') state.reports.page = page;
    if (action === 'suggestions-page') state.suggestions.page = page;
    if (action === 'verification-page') state.verification.page = page;
    if (action === 'user-activity' && button.dataset.kind) state.users.activityPage[button.dataset.kind] = page;
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
    state.users.selected = button.dataset.id;
    state.users.activityPage = {};
    renderSection();
    return;
  }
  if (action === 'select-offer') {
    const id = integerId(button.dataset.id);
    if (id == null) return;
    state.offers.selected = id;
    renderSection();
    return;
  }
  if (action === 'select-deal') {
    state.deals.selected = button.dataset.id;
    state.deals.messagesPage = 1;
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
