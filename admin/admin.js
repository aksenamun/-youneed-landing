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
  messages: 'Deal Messages',
  prices: 'Price Analytics',
  search: 'Global Search',
  notifications: 'Notifications',
  fraud: 'Fraud Detection',
  performance: 'Category Performance',
  finance: 'Finance',
  health: 'Marketplace Health',
  roles: 'Admin Roles',
  categories: 'Categories',
  suggestions: 'Category Suggestions',
  verification: 'Identity Verification',
  settings: 'Settings',
};
const CATEGORIES = window.YOUNEED_CATALOG && Array.isArray(window.YOUNEED_CATALOG.categories)
  ? window.YOUNEED_CATALOG.categories.map((category) => category.name)
  : [];

const state = {
  section: 'dashboard',
  adminSince: null,
  user: null,
  users: { query: '', page: 1, selected: null, activityPage: {}, historyPage: 1 },
  listings: { query: '', category: '', status: 'all', page: 1, selected: null },
  offers: { query: '', status: 'all', user: '', from: '', to: '', page: 1, selected: null },
  deals: { query: '', status: 'all', user: '', from: '', to: '', page: 1, selected: null, messagesPage: 1 },
  reports: { query: '', status: 'all', user: '', page: 1, selected: null, note: '', nextStatus: 'open', noteLoaded: false, detailError: '' },
  messages: { query: '', user: '', from: '', to: '', page: 1, selected: null, messagesPage: 1 },
  prices: { query: '', from: '', to: '', page: 1 },
  suggestions: { query: '', status: 'all', page: 1, selected: null },
  verification: { query: '', status: 'all', provider: 'all', page: 1, selected: null },
  adminRole: null,
  roleLegacy: true,
  needsBootstrap: false,
  bootstrapReady: false,
  roleNote: '',
};

const ROLE_SECTIONS = {
  dashboard: ['super_admin', 'moderator', 'support', 'analyst', 'finance'],
  search: ['super_admin', 'moderator', 'support'],
  users: ['super_admin', 'moderator', 'support'],
  listings: ['super_admin', 'moderator', 'support', 'analyst'],
  offers: ['super_admin', 'moderator', 'support', 'analyst'],
  deals: ['super_admin', 'moderator', 'support', 'analyst'],
  messages: ['super_admin', 'moderator', 'support', 'analyst'],
  reports: ['super_admin', 'moderator', 'support', 'analyst'],
  prices: ['super_admin', 'moderator', 'analyst', 'finance'],
  performance: ['super_admin', 'moderator', 'analyst', 'finance'],
  finance: ['super_admin', 'finance'],
  health: ['super_admin', 'moderator', 'support', 'analyst', 'finance'],
  notifications: ['super_admin', 'moderator', 'support', 'analyst'],
  fraud: ['super_admin', 'moderator'],
  roles: ['super_admin'],
  categories: ['super_admin', 'moderator', 'support', 'analyst'],
  suggestions: ['super_admin', 'moderator', 'support'],
  verification: ['super_admin', 'moderator', 'support'],
  settings: ['super_admin', 'moderator', 'support', 'analyst', 'finance'],
};

const ACTION_ROLES = {
  moderate: ['moderator'],
  'listing-moderate': ['moderator'],
  notes: ['moderator', 'support'],
  reputation: ['moderator', 'support', 'analyst'],
  'notify-write': ['moderator', 'support'],
  fraud: ['moderator'],
  'message-body': ['moderator', 'support'],
  'report-write': ['moderator', 'support'],
};

function roleAllows(section) {
  if (state.roleLegacy) return true;
  if (state.needsBootstrap || !state.adminRole) return false;
  return (ROLE_SECTIONS[section] || []).includes(state.adminRole);
}

function canAct(action) {
  if (state.roleLegacy) return true;
  if (!state.adminRole) return false;
  if (state.adminRole === 'super_admin') return true;
  return (ACTION_ROLES[action] || []).includes(state.adminRole);
}

function applyRoleNav() {
  document.querySelectorAll('.sidebar button[data-section]').forEach((button) => {
    button.hidden = !roleAllows(button.dataset.section);
  });
}

function confirmReason(statement) {
  if (!window.confirm(statement)) return null;
  const reason = window.prompt('Reason for this moderation action');
  if (reason == null) return null;
  if (!reason.trim()) {
    window.alert('A reason is required.');
    return null;
  }
  return reason.trim();
}

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

function formatVilnius(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('lt-LT', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function tablesUnavailable(error) {
  return missingRpc(error) || /required tables are not available|identity tables are not available/i.test(
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

function vilniusOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Vilnius', timeZoneName: 'shortOffset' }).formatToParts(date);
  const name = (parts.find((part) => part.type === 'timeZoneName') || {}).value || '';
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 180;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
}

function vilniusDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vilnius', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const pick = (type) => Number((parts.find((part) => part.type === type) || {}).value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

function shiftVilniusDate(year, month, day, days) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function vilniusStartIso(year, month, day) {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = vilniusOffsetMinutes(new Date(utcGuess));
  return new Date(utcGuess - offset * 60000).toISOString();
}

function dateRange(from, to) {
  const start = typeof from === 'string' ? from.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const end = typeof to === 'string' ? to.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  let createdTo = null;
  if (end) {
    const next = shiftVilniusDate(Number(end[1]), Number(end[2]), Number(end[3]), 1);
    createdTo = vilniusStartIso(next.year, next.month, next.day);
  }
  return {
    created_from: start ? vilniusStartIso(Number(start[1]), Number(start[2]), Number(start[3])) : null,
    created_to: createdTo,
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

const LEGACY_MOBILE_STATUS_REASON = 'Installed mobile admin changed active or paused status. That app version cannot collect a separate reason.';

function auditReasonLabel(reason) {
  if (reason === LEGACY_MOBILE_STATUS_REASON) {
    return `Legacy mobile status change. Audit reason: ${reason}`;
  }
  return reason || '—';
}

function panelMessage(text, kind) {
  return `<div class="notice banner ${kind || 'info'}">${escapeHtml(text)}</div>`;
}

async function renderSection() {
  const root = $('content');
  if (!state.roleLegacy && state.needsBootstrap) {
    root.innerHTML = `
      ${panelMessage(state.roleNote || 'Super Admin activation is blocked.')}
      <section class="panel"><h2>Super Admin activation</h2>
        <p>Production activation requires one verified administrator UUID in <code>admin_bootstrap_config.super_admin_id</code>. That value is not in this project, and this screen cannot choose an account. The database owner sets it once. Only that account can complete activation, only once, and the function cannot promote any other account.</p>
        ${state.bootstrapReady ? '<button class="primary" type="button" data-action="bootstrap-role">Complete activation</button>' : ''}
        <div id="role-error"></div>
      </section>`;
    return;
  }
  if (!state.roleLegacy && !state.adminRole) {
    root.innerHTML = panelMessage(state.roleNote || 'This administrator has no role. A Super Admin must assign one.', 'form-error');
    return;
  }
  if (!roleAllows(state.section)) {
    root.innerHTML = panelMessage('This section is not available for the current administrator role.', 'form-error');
    return;
  }
  root.innerHTML = '<div class="loading">Loading…</div>';
  if (typeof loadCityOptions === 'function') await loadCityOptions();
  try {
    if (state.section === 'dashboard') await renderDashboard(root);
    else if (state.section === 'users') await renderUsers(root);
    else if (state.section === 'listings') await renderListings(root);
    else if (state.section === 'offers') await renderOffers(root);
    else if (state.section === 'deals') await renderDeals(root);
    else if (state.section === 'reports') await renderReports(root);
    else if (state.section === 'messages') await renderMessages(root);
    else if (state.section === 'prices') await renderPrices(root);
    else if (state.section === 'search') await renderGlobalSearch(root);
    else if (state.section === 'notifications') await renderNotifications(root);
    else if (state.section === 'fraud') await renderFraud(root);
    else if (state.section === 'performance') await renderCategoryPerformance(root);
    else if (state.section === 'finance') await renderFinance(root);
    else if (state.section === 'health') await renderHealth(root);
    else if (state.section === 'roles') await renderRoles(root);
    else if (state.section === 'categories') await renderCategories(root);
    else if (state.section === 'suggestions') await renderSuggestions(root);
    else if (state.section === 'verification') await renderVerification(root);
    else await renderSettings(root);
  } catch (error) {
    root.innerHTML = panelMessage(error.message || 'This section could not be loaded.', 'form-error');
  }
}

async function renderDashboard(root) {
  const filter = typeof ensureFilter === 'function' ? ensureFilter('dashboard') : { city: 'all' };
  const range = typeof sharedRange === 'function' ? sharedRange('dashboard') : { created_from: null, created_to: null };
  let filtered = null;
  let filteredError = '';
  try {
    filtered = await rpc('admin_filter_dashboard', {
      city: filter.city,
      category: filter.category || null,
      created_from: range.created_from,
      created_to: range.created_to,
    });
  } catch (error) {
    if (!missingRpc(error)) filteredError = error.message || 'Filtered totals could not be loaded.';
  }
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
    ${typeof filterBar === 'function' ? filterBar('dashboard', {
      cityLabel: 'City',
      note: 'People use the profile city. Listings, offers, deals, and reports use the listing city. Category applies to marketplace records, not to people. The cards below stay unfiltered.',
      advanced: [{ key: 'category', label: 'Category', kind: 'select', options: CATEGORIES }],
    }) : ''}
    ${filteredError ? panelMessage(filteredError, 'form-error') : ''}
    ${filtered ? `<section class="panel"><h2>Filtered totals</h2><div class="facts">
      ${fact('Profiles in this city', filtered.profile_users)}
      ${fact('Listings', filtered.listings)}
      ${fact('Offers', filtered.offers)}
      ${fact('Deals', filtered.deals)}
      ${fact('Completed deals', filtered.completed_deals)}
      ${fact('Reports', filtered.reports)}
    </div><p class="muted">${escapeHtml(filtered.profile_users_meaning || '')} ${escapeHtml(filtered.marketplace_city_meaning || '')}</p></section>` : panelMessage('City, category, and date totals need admin/sql/20261102200000_admin_filters_intelligence.sql. The cards below stay unfiltered.')}
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
  if (typeof bindFilterBar === 'function') bindFilterBar('dashboard');
}

async function renderUsers(root) {
  const filter = typeof ensureFilter === 'function' ? ensureFilter('users') : { city: 'all', sort: 'newest', accountStatus: '', accountType: '', signIn: false };
  const range = typeof sharedRange === 'function' ? sharedRange('users') : { created_from: null, created_to: null };
  let result;
  filter.identityNotice = '';
  try {
    result = pageResult(await rpc('admin_filter_users', {
      search: state.users.query || null,
      city: filter.city,
      account_status: filter.accountStatus || null,
      account_type: filter.accountType || null,
      created_from: range.created_from,
      created_to: range.created_to,
      sign_in_from: filter.signIn ? range.created_from : null,
      sign_in_to: filter.signIn ? range.created_to : null,
      sort: filter.sort || 'newest',
      identity: filter.identity || null,
      page: state.users.page,
      page_size: PAGE_SIZE,
    }));
  } catch (error) {
    const identityMissing = filter.identity && /identity tables are not available|identity review state is not available/i.test(error.message || '');
    if (identityMissing) {
      filter.identityNotice = 'Identity tables are not available, so this list is not filtered by verification.';
      result = pageResult(await rpc('admin_filter_users', {
        search: state.users.query || null,
        city: filter.city,
        account_status: filter.accountStatus || null,
        account_type: filter.accountType || null,
        created_from: range.created_from,
        created_to: range.created_to,
        sign_in_from: filter.signIn ? range.created_from : null,
        sign_in_to: filter.signIn ? range.created_to : null,
        sort: filter.sort || 'newest',
        page: state.users.page,
        page_size: PAGE_SIZE,
      }));
    } else if (missingRpc(error)) {
      result = pageResult(await rpc('admin_list_profiles', {
        search: state.users.query || null,
        page: state.users.page,
        page_size: PAGE_SIZE,
      }));
    } else {
      throw error;
    }
  }
  const selectedId = state.users.selected;
  let detail = '';
  if (selectedId) {
    detail = await userDetail(selectedId);
  }

  root.innerHTML = `
    ${filter.identityNotice ? panelMessage(filter.identityNotice) : ''}
    ${typeof filterBar === 'function' ? filterBar('users', {
      cityLabel: 'Profile city',
      sorts: [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['most_active', 'Most active'], ['most_deals', 'Most completed deals'], ['most_reports', 'Most reports received']],
      note: 'Profile city is the city stored on the account. It is not the city of that person’s listings.',
      advanced: [
        { key: 'accountStatus', label: 'Account status', kind: 'select', options: ['active', 'inactive'] },
        { key: 'accountType', label: 'Account type', kind: 'select', options: ['personal', 'business'] },
        { key: 'identity', label: 'Identity verification', kind: 'select', options: [['verified', 'Verified'], ['pending', 'Pending review'], ['not_verified', 'Not verified'], ['not_started', 'Not started']] },
        { key: 'signIn', label: 'Use the date range for last sign-in as well', kind: 'check' },
      ],
    }) : ''}
    <div class="filters">
      <input id="user-search" value="${escapeHtml(state.users.query)}" placeholder="Search name, email, phone, or user id">
    </div>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Role</th><th>Status</th><th>Profile city</th><th>Registered</th></tr></thead><tbody>
      ${result.rows.map((profile) => `<tr data-action="select-user" data-id="${escapeHtml(profile.id)}" aria-selected="${profile.id === selectedId}">
        <td>${escapeHtml(displayName(profile))}</td>
        <td>${escapeHtml(profile.account_type || '—')}</td>
        <td>${escapeHtml(profile.role || '—')}</td>
        <td>${badge(profile.is_active !== false)}</td>
        <td>${escapeHtml(profile.profile_city || '—')}</td>
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
  if (typeof bindFilterBar === 'function') bindFilterBar('users');
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
  let history = { rows: [], total: 0, page: 1 };
  try {
    history = pageResult(await rpc('admin_moderation_history', {
      target_kind: 'user',
      target_id: userId,
      page: state.users.historyPage || 1,
      page_size: PAGE_SIZE,
    }));
  } catch (error) {
    if (!missingRpc(error)) throw error;
  }

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
      ${fact('Profile city', card.city)}
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
    <div class="chips">
      ${canAct('moderate') ? `<button class="ghost" data-action="moderate-user" data-id="${escapeHtml(card.id)}" data-moderation="suspend">Suspend account</button>
      <button class="ghost" data-action="moderate-user" data-id="${escapeHtml(card.id)}" data-moderation="reactivate">Reactivate account</button>
      <button class="danger" data-action="moderate-user" data-id="${escapeHtml(card.id)}" data-moderation="ban">Ban account</button>` : ''}
      <button class="ghost" data-action="user-reports" data-id="${escapeHtml(card.id)}">Reports involving this user</button>
    </div>
    <div id="user-moderation-error"></div>
    ${typeof userPrivatePanels === 'function' ? await userPrivatePanels(userId) : ''}
    <h3>Moderation history</h3>
    ${history.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Administrator</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>
      ${history.rows.map((row) => `<tr><td>${escapeHtml(formatVilnius(row.created_at))}</td><td>${escapeHtml(row.action)}</td><td>${linkButton('open-user', row.admin_id, row.admin_id)}</td><td>${escapeHtml(row.previous_status || '—')}</td><td>${escapeHtml(row.new_status || '—')}</td><td>${escapeHtml(row.reason)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No moderation history.</p>'}
    ${pager(history.page, history.total, 'user-history')}
    ${panelMessage('Suspension sets the profile inactive, bans new sign-in, and deletes active sessions and refresh tokens when those tables exist. A current access token can still be used until it expires. While the token is valid, database policies block that account from creating or updating listings, offers, deals, tasks, messages, and its profile. Existing deals and disputes are kept. A ban uses the same block and can be reversed by a moderator.')}
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
  const filter = typeof ensureFilter === 'function' ? ensureFilter('listings') : { city: 'all', sort: 'newest', subcategory: '', type: '', owner: '', updatedFrom: '', updatedTo: '' };
  const range = typeof sharedRange === 'function' ? sharedRange('listings') : { created_from: null, created_to: null };
  const updated = dateRange(filter.updatedFrom, filter.updatedTo);
  const owner = typeof blankUuid === 'function' ? blankUuid(filter.owner) : null;
  const listingArgs = {
    search: state.listings.query || null,
    category: state.listings.category || null,
    status: state.listings.status === 'all' ? null : state.listings.status,
    owner_id: owner || null,
    page: state.listings.page,
    page_size: PAGE_SIZE,
  };
  let result;
  let moderationReady = true;
  if (owner === undefined) {
    result = { rows: [], total: 0, page: state.listings.page };
  } else {
    try {
      result = pageResult(await rpc('admin_filter_listings', {
        ...listingArgs,
        subcategory: filter.subcategory || null,
        listing_type: filter.type || null,
        city: filter.city,
        created_from: range.created_from,
        created_to: range.created_to,
        updated_from: updated.created_from,
        updated_to: updated.created_to,
        sort: filter.sort || 'newest',
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
      try {
        result = pageResult(await rpc('admin_listing_directory', listingArgs));
      } catch (directoryError) {
        if (!missingRpc(directoryError)) throw directoryError;
        moderationReady = false;
        result = pageResult(await rpc('admin_list_listings', listingArgs));
      }
    }
  }
  const selected = result.rows.find((row) => row.id === state.listings.selected) || null;
  let listingHistory = { rows: [], total: 0, page: 1 };
  if (selected && canAct('listing-moderate')) {
    try {
      listingHistory = pageResult(await rpc('admin_moderation_history', {
        target_kind: 'listing',
        target_id: selected.id,
        page: state.listings.historyPage || 1,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
    }
  }

  root.innerHTML = `
    ${owner === undefined ? panelMessage('Enter a full owner id, or leave the owner filter empty.', 'form-error') : ''}
    ${typeof filterBar === 'function' ? filterBar('listings', {
      cityLabel: 'Listing city',
      sorts: [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['most_offers', 'Most offers']],
      note: 'Listing city is the city stored on the listing. A provider who lives in another city is not moved into this filter.',
      advanced: [
        { key: 'subcategory', label: 'Subcategory', kind: 'text', placeholder: 'Exact subcategory' },
        { key: 'type', label: 'Listing type', kind: 'select', options: ['task', 'service'] },
        { key: 'owner', label: 'Owner id', kind: 'text' },
        { key: 'updatedFrom', label: 'Updated from', kind: 'text', placeholder: 'YYYY-MM-DD' },
        { key: 'updatedTo', label: 'Updated to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      ],
    }) : ''}
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
    ${moderationReady ? '' : panelMessage('Hide, restore, and delete stay unavailable until admin/sql/20261102190000_admin_moderation_prices.sql is applied.')}
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Listing</th><th>Title</th><th>Type</th><th>Category</th><th>Published</th><th>Updated</th><th>Offers</th><th>Deals</th><th>Status</th><th>Owner</th></tr></thead><tbody>
      ${result.rows.map((listing) => `<tr data-action="select-listing" data-id="${escapeHtml(listing.id)}" aria-selected="${selected && selected.id === listing.id}">
        <td>${escapeHtml(listing.id)}</td>
        <td>${escapeHtml(listing.title)}</td>
        <td>${escapeHtml(listing.listing_type || '—')}</td>
        <td>${escapeHtml([listing.category, listing.subcategory].filter(Boolean).join(' · ') || '—')}</td>
        <td>${escapeHtml(formatVilnius(listing.created_at))}</td>
        <td>${escapeHtml(formatVilnius(listing.updated_at))}</td>
        <td>${escapeHtml(listing.offer_count ?? '—')}</td>
        <td>${escapeHtml(listing.deal_count ?? '—')}</td>
        <td>${badge(listing.status)}</td>
        <td>${linkButton('open-user', listing.user_id, listing.user_id)}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No matching listings.</p>'}
    ${pager(result.page, result.total, 'listings-page')}
    ${selected ? `<section class="panel"><h2>${escapeHtml(selected.title)}</h2>
      <div class="facts">
        ${fact('Listing ID', selected.id)}
        ${fact('Owner', selected.user_id)}
        ${fact('Type', selected.listing_type)}
        ${fact('Category', [selected.category, selected.subcategory].filter(Boolean).join(' · '))}
        ${fact('Published', formatVilnius(selected.created_at))}
        ${fact('Updated', formatVilnius(selected.updated_at))}
        ${fact('Offers', selected.offer_count ?? '—')}
        ${fact('Deals', selected.deal_count ?? '—')}
        ${fact('Status', selected.status)}
      </div>
      <p class="muted">Owner ${linkButton('open-user', selected.user_id, selected.user_id)}</p>
      <p>${selected.budget != null ? escapeHtml(`${selected.budget} ${selected.currency || ''}`) : '—'}</p>
      <p>${escapeHtml(selected.description || '')}</p>
      ${fact('Moderation', selected.moderation_lock || 'None')}
      ${moderationReady && canAct('listing-moderate') ? `<div class="chips">
        <button class="ghost" data-action="hide-listing" data-id="${escapeHtml(selected.id)}">Hide listing</button>
        <button class="ghost" data-action="restore-listing" data-id="${escapeHtml(selected.id)}">Restore hidden listing</button>
        <button class="danger" data-action="archive-listing" data-id="${escapeHtml(selected.id)}">Archive listing</button>
        <button class="ghost" data-action="unarchive-listing" data-id="${escapeHtml(selected.id)}">Restore from archive</button>
        ${selected.moderation_lock == null && selected.status === 'active' ? `<button class="ghost" data-action="listing-status" data-id="${escapeHtml(selected.id)}" data-status="paused">Pause listing</button>` : ''}
        ${selected.moderation_lock == null && selected.status === 'paused' ? `<button class="ghost" data-action="listing-status" data-id="${escapeHtml(selected.id)}" data-status="active">Return listing to active</button>` : ''}
      </div>
      <p class="muted">Draft, in progress, completed, and cancelled are business states. Administrators cannot set them here. An unlocked active listing can be paused, and an unlocked paused listing can return to active. Hide and archive do not mark a listing completed or cancelled. Archive keeps the listing and its deals.</p>` : ''}
      ${canAct('listing-moderate') ? `<h3>Moderation history</h3>
      ${listingHistory.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Administrator</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>
        ${listingHistory.rows.map((row) => `<tr><td>${escapeHtml(formatVilnius(row.created_at))}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.admin_id)}</td><td>${escapeHtml(row.previous_status || '—')}</td><td>${escapeHtml(row.new_status || '—')}</td><td>${escapeHtml(auditReasonLabel(row.reason))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No moderation history.</p>'}
      ${pager(listingHistory.page, listingHistory.total, 'listing-history')}` : ''}
      <div id="listing-error"></div>
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
  if (typeof bindFilterBar === 'function') bindFilterBar('listings');
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
      const reportFilter = typeof ensureFilter === 'function' ? ensureFilter('reports') : { city: 'all', sort: 'newest', reason: '', reporter: '', reported: '' };
      const reportRange = typeof sharedRange === 'function' ? sharedRange('reports') : { created_from: null, created_to: null };
      const reporterId = typeof blankUuid === 'function' ? blankUuid(reportFilter.reporter) : null;
      const reportedId = typeof blankUuid === 'function' ? blankUuid(reportFilter.reported) : null;
      if (reporterId === undefined || reportedId === undefined) {
        blocked = panelMessage('Enter a full reporter or reported-user id, or leave that filter empty.', 'form-error');
      } else {
      result = pageResult(await rpc('admin_filter_reports', {
        search: state.reports.query || null,
        status: state.reports.status === 'all' ? null : state.reports.status,
        user_id: userId,
        city: reportFilter.city,
        reason: reportFilter.reason || null,
        created_from: reportRange.created_from,
        created_to: reportRange.created_to,
        sort: reportFilter.sort || 'newest',
        page: state.reports.page,
        page_size: PAGE_SIZE,
        p_reporter: reporterId,
        p_reported: reportedId,
      }));
      }
    } catch (filterError) {
      if (!missingRpc(filterError)) throw filterError;
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
  }
  let selected = null;
  const selectedReportId = reportId(state.reports.selected);
  if (!blocked && selectedReportId != null) {
    try {
      selected = await rpc(detailed ? 'admin_report_detail' : 'admin_report', { report_id: selectedReportId });
      state.reports.detailError = '';
      if (!state.reports.noteLoaded) {
        state.reports.note = selected.admin_note || '';
        state.reports.nextStatus = selected.status || 'open';
        state.reports.noteLoaded = true;
      }
    } catch (error) {
      state.reports.detailError = error.message || 'This report could not be loaded.';
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
    ${typeof filterBar === 'function' ? filterBar('reports', {
      cityLabel: 'Listing city',
      sorts: [['newest', 'Newest first'], ['oldest', 'Oldest first']],
      note: 'A report uses the related listing city. Reports without a listing match Unspecified city.',
      advanced: [
        { key: 'reason', label: 'Report reason', kind: 'text', placeholder: 'Exact reason' },
        { key: 'reporter', label: 'Reporter id', kind: 'text' },
        { key: 'reported', label: 'Reported user id', kind: 'text' },
      ],
    }) : ''}
    <div class="filters">
      <input id="report-search" value="${escapeHtml(state.reports.query)}" placeholder="Search reason, description, name, or listing" ${detailed ? '' : 'disabled'}>
      <input id="report-user" value="${escapeHtml(state.reports.user)}" placeholder="User id" ${detailed ? '' : 'disabled'}>
    </div>
    <div class="chips">${['all', ...REPORT_STATUSES].map((status) => `<button class="ghost" data-action="reports-filter" data-status="${status}" aria-pressed="${state.reports.status === status}">${status}</button>`).join('')}</div>
    ${blocked ? '' : result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Reason</th><th>Reporter</th><th>Reported user</th><th>Listing</th><th>Status</th><th>Created</th></tr></thead><tbody>
      ${reportRows}
    </tbody></table></div>` : '<p class="empty">No reports.</p>'}
    ${blocked ? '' : pager(result.page, result.total, 'reports-page')}
    ${state.reports.detailError ? panelMessage(state.reports.detailError, 'form-error') : ''}
    ${blocked || state.reports.detailError ? '' : selected ? `<section class="panel"><h2>${escapeHtml(selected.reason || 'Report')}</h2>
      <p>Reporter ${linkButton('open-user', selected.reporter_id, selected.reporter_name || selected.reporter_id)} · Reported account ${linkButton('open-user', selected.reported_user_id, selected.reported_name || selected.reported_user_id)}</p>
      <p>Listing ${selected.listing_id ? linkButton('open-listing', selected.listing_id, selected.listing_title || selected.listing_id) : 'No linked listing'} · Task ${escapeHtml(selected.task_id ?? 'No linked task')}</p>
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
      ${canAct('report-write') ? `<button class="primary" data-action="save-report" data-id="${escapeHtml(reportId(selected.id) || '')}">Save report</button>` : panelMessage('Report changes are limited to moderator and support.')}
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
  if (typeof bindFilterBar === 'function') bindFilterBar('reports');
}

async function renderOffers(root) {
  const userId = uuidOrNull(state.offers.user);
  const filter = typeof ensureFilter === 'function' ? ensureFilter('offers') : { city: 'all', sort: 'newest', category: '', provider: '', client: '', minAmount: '', maxAmount: '' };
  const range = typeof sharedRange === 'function' ? sharedRange('offers') : dateRange(state.offers.from, state.offers.to);
  const providerId = typeof blankUuid === 'function' ? blankUuid(filter.provider) : null;
  const clientId = typeof blankUuid === 'function' ? blankUuid(filter.client) : null;
  let result = { rows: [], total: 0, page: state.offers.page };
  let blocked = '';
  if (userId === undefined || providerId === undefined || clientId === undefined) {
    blocked = panelMessage('Enter a full user id, or leave the user filter empty.', 'form-error');
  } else {
    try {
      result = pageResult(await rpc('admin_filter_offers', {
        search: state.offers.query || null,
        status: state.offers.status === 'all' ? null : state.offers.status,
        user_id: userId,
        provider_id: providerId,
        client_id: clientId,
        city: filter.city,
        category: filter.category || null,
        created_from: range.created_from,
        created_to: range.created_to,
        min_amount: amountOrNull(filter.minAmount),
        max_amount: amountOrNull(filter.maxAmount),
        sort: filter.sort || 'newest',
        page: state.offers.page,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
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
      } catch (fallbackError) {
        if (!missingRpc(fallbackError)) throw fallbackError;
        blocked = panelMessage(CRM_MIGRATION);
      }
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
    ${typeof filterBar === 'function' ? filterBar('offers', {
      cityLabel: 'Listing city',
      sorts: [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['highest', 'Highest amount'], ['lowest', 'Lowest amount']],
      note: 'Offer location follows the listing city.',
      advanced: [
        { key: 'category', label: 'Category', kind: 'select', options: CATEGORIES },
        { key: 'provider', label: 'Provider id', kind: 'text' },
        { key: 'client', label: 'Client id', kind: 'text' },
        { key: 'minAmount', label: 'Minimum amount', kind: 'text' },
        { key: 'maxAmount', label: 'Maximum amount', kind: 'text' },
      ],
    }) : ''}
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
  if (typeof bindFilterBar === 'function') bindFilterBar('offers');
}

async function renderDeals(root) {
  const userId = uuidOrNull(state.deals.user);
  const filter = typeof ensureFilter === 'function' ? ensureFilter('deals') : { city: 'all', sort: 'newest', category: '', client: '', provider: '', dispute: '', completedFrom: '', completedTo: '', minAmount: '', maxAmount: '' };
  const range = typeof sharedRange === 'function' ? sharedRange('deals') : dateRange(state.deals.from, state.deals.to);
  const completed = dateRange(filter.completedFrom, filter.completedTo);
  const clientId = typeof blankUuid === 'function' ? blankUuid(filter.client) : null;
  const providerId = typeof blankUuid === 'function' ? blankUuid(filter.provider) : null;
  let result = { rows: [], total: 0, page: state.deals.page };
  let blocked = '';
  if (userId === undefined || clientId === undefined || providerId === undefined) {
    blocked = panelMessage('Enter a full user id, or leave the user filter empty.', 'form-error');
  } else {
    try {
      result = pageResult(await rpc('admin_filter_deals', {
        search: state.deals.query || null,
        status: state.deals.status === 'all' ? null : state.deals.status,
        user_id: userId,
        client_id: clientId,
        provider_id: providerId,
        city: filter.city,
        category: filter.category || null,
        dispute_status: filter.dispute || null,
        created_from: range.created_from,
        created_to: range.created_to,
        completed_from: completed.created_from,
        completed_to: completed.created_to,
        min_amount: amountOrNull(filter.minAmount),
        max_amount: amountOrNull(filter.maxAmount),
        sort: filter.sort || 'newest',
        page: state.deals.page,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
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
  }
  let selected = null;
  let messages = { rows: [], total: 0, page: 1 };
  let dealError = '';
  if (!blocked && state.deals.selected) {
    try {
      selected = await rpc('admin_deal', { deal_id: state.deals.selected });
      if (!canAct('message-body')) {
        dealError = 'Message text is limited to moderator and support.';
      } else messages = pageResult(await rpc('admin_deal_messages', {
        deal_id: state.deals.selected,
        page: state.deals.messagesPage,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      dealError = error.message || 'This deal could not be loaded.';
    }
  }
  const disputes = selected && Array.isArray(selected.disputes) ? selected.disputes : [];
  const reports = selected && Array.isArray(selected.reports) ? selected.reports : [];
  root.innerHTML = `
    ${panelMessage('Deal status and payment records are read-only in this dashboard.')}
    ${blocked}
    ${typeof filterBar === 'function' ? filterBar('deals', {
      cityLabel: 'Listing city',
      sorts: [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['highest', 'Highest amount'], ['lowest', 'Lowest amount']],
      note: 'Deal location follows the listing city. Completion dates are separate from creation dates.',
      advanced: [
        { key: 'category', label: 'Category', kind: 'select', options: CATEGORIES },
        { key: 'client', label: 'Client id', kind: 'text' },
        { key: 'provider', label: 'Provider id', kind: 'text' },
        { key: 'dispute', label: 'Dispute status', kind: 'select', options: ['none', 'open', 'under_review', 'resolved', 'rejected', 'cancelled'] },
        { key: 'completedFrom', label: 'Completed from', kind: 'text', placeholder: 'YYYY-MM-DD' },
        { key: 'completedTo', label: 'Completed to', kind: 'text', placeholder: 'YYYY-MM-DD' },
        { key: 'minAmount', label: 'Minimum amount', kind: 'text' },
        { key: 'maxAmount', label: 'Maximum amount', kind: 'text' },
      ],
    }) : ''}
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
    ${dealError ? panelMessage(dealError, 'form-error') : ''}
    ${dealError ? '' : selected ? `<section class="panel"><h2>Deal</h2>
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
        ${messages.rows.map((message) => `<tr><td>${escapeHtml(formatVilnius(message.created_at))}</td><td>${linkButton('open-user', message.sender_id, message.sender_name || message.sender_id)}</td><td>${escapeHtml(message.message)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No messages in this deal.</p>'}
      ${pager(messages.page, messages.total, 'deal-messages-page')}
    </section>` : blocked || dealError ? '' : panelMessage('Select a deal to see the participants, listing, offer, reports, and conversation.')}`;

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
  if (typeof bindFilterBar === 'function') bindFilterBar('deals');
}

async function renderMessages(root) {
  const userId = uuidOrNull(state.messages.user);
  const range = dateRange(state.messages.from, state.messages.to);
  let result = { rows: [], total: 0, page: state.messages.page };
  let blocked = '';
  if (userId === undefined) {
    blocked = panelMessage('Enter a full user id, or leave the participant filter empty.', 'form-error');
  } else {
    const threadFilter = typeof ensureFilter === 'function' ? ensureFilter('messages') : { city: 'all' };
    const threadRange = typeof sharedRange === 'function' ? sharedRange('messages') : range;
    try {
      result = pageResult(await rpc('admin_filter_threads', {
        search: state.messages.query || null,
        user_id: userId,
        city: threadFilter.city,
        created_from: threadRange.created_from,
        created_to: threadRange.created_to,
        page: state.messages.page,
        page_size: PAGE_SIZE,
      }));
    } catch (filterError) {
      if (!missingRpc(filterError)) throw filterError;
    try {
      result = pageResult(await rpc('admin_list_deal_threads', {
        search: state.messages.query || null,
        user_id: userId,
        created_from: range.created_from,
        created_to: range.created_to,
        page: state.messages.page,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      if (!missingRpc(error)) throw error;
      blocked = panelMessage('Deal message search needs admin/sql/20261102190000_admin_moderation_prices.sql. It has not been applied.');
    }
    }
  }
  let messages = { rows: [], total: 0, page: 1 };
  let threadError = '';
  if (!blocked && state.messages.selected && !canAct('message-body')) {
    threadError = 'Message text is limited to moderator and support.';
  } else if (!blocked && state.messages.selected) {
    try {
      messages = pageResult(await rpc('admin_deal_messages', {
        deal_id: state.messages.selected,
        page: state.messages.messagesPage,
        page_size: PAGE_SIZE,
      }));
    } catch (error) {
      threadError = error.message || 'This conversation could not be loaded.';
    }
  }
  const selectedRow = result.rows.find((row) => row.id === state.messages.selected) || null;
  root.innerHTML = `
    ${panelMessage('Messages are read-only. This screen cannot send, edit, or delete them. Messages do not store attachment metadata.')}
    ${blocked}
    ${typeof filterBar === 'function' ? filterBar('messages', {
      cityLabel: 'Listing city',
      note: 'A conversation follows the listing city. It is included when at least one message falls in the date range.',
    }) : ''}
    <div class="filters">
      <input id="thread-search" value="${escapeHtml(state.messages.query)}" placeholder="Deal id, name, or listing">
      <input id="thread-user" value="${escapeHtml(state.messages.user)}" placeholder="Participant id">
      <input id="thread-from" type="date" value="${escapeHtml(state.messages.from)}">
      <input id="thread-to" type="date" value="${escapeHtml(state.messages.to)}">
    </div>
    ${blocked ? '' : result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Deal</th><th>Client</th><th>Provider</th><th>Listing</th><th>Messages</th><th>First</th><th>Last</th></tr></thead><tbody>
      ${result.rows.map((row) => `<tr data-action="select-thread" data-id="${escapeHtml(row.id)}" aria-selected="${state.messages.selected === row.id}">
        <td>${escapeHtml(row.id)}</td>
        <td>${linkButton('open-user', row.client_id, row.client_name)}</td>
        <td>${linkButton('open-user', row.provider_id, row.provider_name)}</td>
        <td>${linkButton('open-listing', row.listing_id, row.listing_title)}</td>
        <td>${escapeHtml(row.message_count)}</td>
        <td>${escapeHtml(formatVilnius(row.first_message_at))}</td>
        <td>${escapeHtml(formatVilnius(row.last_message_at))}</td>
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No conversations.</p>'}
    ${blocked ? '' : pager(result.page, result.total, 'threads-page')}
    ${threadError ? panelMessage(threadError, 'form-error') : ''}
    ${!threadError && state.messages.selected ? `<section class="panel"><h2>Conversation</h2>
      <p>Deal ${linkButton('open-deal', state.messages.selected, state.messages.selected)}
        ${selectedRow ? ` · Client ${linkButton('open-user', selectedRow.client_id, selectedRow.client_name)} · Provider ${linkButton('open-user', selectedRow.provider_id, selectedRow.provider_name)} · Listing ${linkButton('open-listing', selectedRow.listing_id, selectedRow.listing_title)}` : ''}</p>
      ${messages.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Sender</th><th>Message</th></tr></thead><tbody>
        ${messages.rows.map((message) => `<tr><td>${escapeHtml(formatVilnius(message.created_at))}</td><td>${linkButton('open-user', message.sender_id, message.sender_name || message.sender_id)}</td><td>${escapeHtml(message.message || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No messages in this deal.</p>'}
      ${pager(messages.page, messages.total, 'thread-messages-page')}
    </section>` : ''}`;
  $('thread-search').addEventListener('change', (event) => {
    state.messages.query = event.target.value.trim();
    state.messages.page = 1;
    renderSection();
  });
  $('thread-user').addEventListener('change', (event) => {
    state.messages.user = event.target.value.trim();
    state.messages.page = 1;
    renderSection();
  });
  $('thread-from').addEventListener('change', (event) => {
    state.messages.from = event.target.value;
    state.messages.page = 1;
    renderSection();
  });
  $('thread-to').addEventListener('change', (event) => {
    state.messages.to = event.target.value;
    state.messages.page = 1;
    renderSection();
  });
  if (typeof bindFilterBar === 'function') bindFilterBar('messages');
}

async function renderPrices(root) {
  const filter = typeof ensureFilter === 'function' ? ensureFilter('prices') : { city: 'all', subcategory: '', minSample: '' };
  const range = typeof sharedRange === 'function' ? sharedRange('prices') : dateRange(state.prices.from, state.prices.to);
  let result;
  try {
    const sample = String(filter.minSample || '').trim();
    result = pageResult(await rpc('admin_filter_prices', {
      search: state.prices.query || null,
      city: filter.city,
      subcategory: filter.subcategory || null,
      created_from: range.created_from,
      created_to: range.created_to,
      min_sample: /^\d+$/.test(sample) ? Number(sample) : null,
      page: state.prices.page,
      page_size: PAGE_SIZE,
    }));
  } catch (filterError) {
    if (!missingRpc(filterError)) throw filterError;
  try {
    result = pageResult(await rpc('admin_price_analytics', {
      search: state.prices.query || null,
      created_from: range.created_from,
      created_to: range.created_to,
      page: state.prices.page,
      page_size: PAGE_SIZE,
    }));
  } catch (error) {
    if (missingRpc(error)) {
      root.innerHTML = panelMessage('Price analytics needs admin/sql/20261102190000_admin_moderation_prices.sql. It has not been applied.');
      return;
    }
    throw error;
  }
  }
  root.innerHTML = `
    ${panelMessage('Figures use completed deals only, counted once, and never mix currencies. A row with fewer than 5 deals is marked insufficient and does not show a price recommendation.')}
    ${typeof filterBar === 'function' ? filterBar('prices', {
      cityLabel: 'Listing city',
      note: 'Prices follow the listing city. The minimum sample hides rows below that completed-deal count. It does not invent a recommendation.',
      advanced: [
        { key: 'subcategory', label: 'Subcategory', kind: 'text', placeholder: 'Exact subcategory' },
        { key: 'minSample', label: 'Minimum completed deals', kind: 'text', placeholder: '5' },
      ],
    }) : ''}
    <div class="filters">
      <input id="price-search" value="${escapeHtml(state.prices.query)}" placeholder="Search category or subcategory">
      <input id="price-from" type="date" value="${escapeHtml(state.prices.from)}">
      <input id="price-to" type="date" value="${escapeHtml(state.prices.to)}">
    </div>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Category</th><th>Subcategory</th><th>Currency</th><th>Sample</th><th>Average</th><th>Median</th><th>Min</th><th>Max</th><th>P25</th><th>P75</th><th>30-day average</th><th>Prior 30 days</th><th>90-day average</th><th>Prior 90 days</th></tr></thead><tbody>
      ${result.rows.map((row) => `<tr>
        <td>${escapeHtml(row.category || '—')}</td>
        <td>${escapeHtml(row.subcategory || '—')}</td>
        <td>${escapeHtml(row.currency || '—')}</td>
        <td><b>${escapeHtml(row.sample_size)}</b></td>
        ${row.recommendation_ready ? `<td>${escapeHtml(money(row.average, ''))}</td><td>${escapeHtml(money(row.median, ''))}</td><td>${escapeHtml(money(row.minimum, ''))}</td><td>${escapeHtml(money(row.maximum, ''))}</td><td>${escapeHtml(money(row.p25, ''))}</td><td>${escapeHtml(money(row.p75, ''))}</td><td>${escapeHtml(money(row.recent_30, ''))}</td><td>${escapeHtml(money(row.prior_30, ''))}</td><td>${escapeHtml(money(row.recent_90, ''))}</td><td>${escapeHtml(money(row.prior_90, ''))}</td>` : '<td colspan="10">Insufficient data</td>'}
      </tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No completed deals match these filters.</p>'}
    ${pager(result.page, result.total, 'prices-page')}`;
  $('price-search').addEventListener('change', (event) => {
    state.prices.query = event.target.value.trim();
    state.prices.page = 1;
    renderSection();
  });
  $('price-from').addEventListener('change', (event) => {
    state.prices.from = event.target.value;
    state.prices.page = 1;
    renderSection();
  });
  $('price-to').addEventListener('change', (event) => {
    state.prices.to = event.target.value;
    state.prices.page = 1;
    renderSection();
  });
  if (typeof bindFilterBar === 'function') bindFilterBar('prices');
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
    if (tablesUnavailable(error)) {
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
    if (tablesUnavailable(error)) {
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
  state.roleLegacy = false;
  state.adminRole = null;
  state.needsBootstrap = false;
  state.bootstrapReady = false;
  state.roleNote = '';
  try {
    const status = await rpc('admin_role_status');
    state.adminRole = status && status.role ? status.role : null;
    state.needsBootstrap = !!(status && status.needs_bootstrap);
    state.bootstrapReady = !!(status && status.bootstrap_ready);
    state.roleNote = status && status.note || '';
  } catch (error) {
    if (!missingRpc(error)) throw error;
    state.roleLegacy = true;
  }
  show('shell');
  applyRoleNav();
  const requested = (location.hash || '#dashboard').slice(1) || 'dashboard';
  setSection(roleAllows(requested) ? requested : 'dashboard');
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action], [data-section]');
  if (!button) return;
  if (button.dataset.section) {
    setSection(button.dataset.section);
    return;
  }
  const action = button.dataset.action;
  if (typeof handleIntelClick === 'function' && await handleIntelClick(event, action, button)) return;
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
  if (action === 'bootstrap-role') {
    if (!state.bootstrapReady) return;
    if (!window.confirm('Complete Super Admin activation for this designated account? This can be done only once and cannot assign any other account.')) return;
    try {
      await rpc('admin_bootstrap_super_admin');
      state.adminRole = 'super_admin';
      state.needsBootstrap = false;
      state.bootstrapReady = false;
      state.roleNote = '';
      applyRoleNav();
      setSection('roles');
    } catch (error) {
      const slot = $('role-error');
      if (slot) slot.innerHTML = panelMessage(error.message || 'Super Admin activation did not complete.', 'form-error');
    }
    return;
  }
  if (action === 'users-page' || action === 'listings-page' || action === 'offers-page' || action === 'deals-page' || action === 'deal-messages-page' || action === 'reports-page' || action === 'suggestions-page' || action === 'verification-page' || action === 'user-activity' || action === 'user-history' || action === 'listing-history' || action === 'threads-page' || action === 'thread-messages-page' || action === 'prices-page') {
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
    if (action === 'user-history') state.users.historyPage = page;
    if (action === 'listing-history') state.listings.historyPage = page;
    if (action === 'threads-page') state.messages.page = page;
    if (action === 'thread-messages-page') state.messages.messagesPage = page;
    if (action === 'prices-page') state.prices.page = page;
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
  if (action === 'select-thread') {
    state.messages.selected = button.dataset.id;
    state.messages.messagesPage = 1;
    renderSection();
    return;
  }
  if (action === 'user-reports') {
    state.reports.user = button.dataset.id || '';
    state.reports.page = 1;
    state.reports.selected = null;
    state.reports.detailError = '';
    setSection('reports');
    return;
  }
  if (action === 'moderate-user' || action === 'hide-listing' || action === 'restore-listing' || action === 'archive-listing' || action === 'unarchive-listing') {
    const statements = {
      'moderate-user': `Confirm ${button.dataset.moderation} for this account.`,
      'hide-listing': 'Hide this listing from the marketplace?',
      'restore-listing': 'Return this hidden listing to active?',
      'archive-listing': 'Archive this listing? It stays in history and can be restored.',
      'unarchive-listing': 'Restore this listing from the archive?',
    };
    const reason = confirmReason(statements[action]);
    if (!reason) return;
    const calls = {
      'moderate-user': ['admin_moderate_user', { target_user: button.dataset.id, action: button.dataset.moderation, reason }],
      'hide-listing': ['admin_hide_listing', { listing_id: button.dataset.id, reason }],
      'restore-listing': ['admin_restore_listing', { listing_id: button.dataset.id, reason }],
      'archive-listing': ['admin_archive_listing', { listing_id: button.dataset.id, reason }],
      'unarchive-listing': ['admin_unarchive_listing', { listing_id: button.dataset.id, reason }],
    };
    button.disabled = true;
    try {
      await rpc(calls[action][0], calls[action][1]);
      renderSection();
    } catch (error) {
      button.disabled = false;
      const slot = $('user-moderation-error') || $('listing-error');
      if (slot) slot.innerHTML = panelMessage(error.message || 'Moderation could not be saved.', 'form-error');
      else window.alert(error.message || 'Moderation could not be saved.');
    }
    return;
  }
  if (action === 'listing-status') {
    const reason = confirmReason(`Change this listing to ${button.dataset.status}? Draft, in progress, completed, and cancelled cannot be set here.`);
    if (!reason) return;
    button.disabled = true;
    try {
      await rpc('admin_set_listing_status', {
        listing_id: button.dataset.id,
        next_status: button.dataset.status,
        reason,
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
    if (!canAct('report-write')) return;
    if (!window.confirm('Save this report status and note?')) return;
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
function startAdmin() {
  enter().catch((error) => {
    show('login');
    const slot = $('login-error');
    if (slot) slot.textContent = error.message || 'Admin access could not be verified.';
  });
}
