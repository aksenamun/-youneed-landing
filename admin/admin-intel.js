const DATE_PRESETS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['month', 'This month'],
  ['last-month', 'Last month'],
  ['year', 'This year'],
  ['all', 'All time'],
  ['custom', 'Custom date range'],
];

const USER_TAGS = [
  ['vip_client', 'VIP Client'],
  ['trusted_provider', 'Trusted Provider'],
  ['new_provider', 'New Provider'],
  ['frequent_complaints', 'Frequent Complaints'],
  ['suspicious_activity', 'Suspicious Activity'],
  ['under_review', 'Under Review'],
];

const INTEL_NOTE = 'These screens need admin/sql/20261102200000_admin_filters_intelligence.sql. It has not been applied. Apply the moderation migration first.';

function ensureFilter(section) {
  if (!state.filters) state.filters = {};
  if (!state.filters[section]) {
    state.filters[section] = {
      city: 'all',
      preset: 'all',
      sort: 'newest',
      from: '',
      to: '',
      subcategory: '',
      type: '',
      owner: '',
      provider: '',
      client: '',
      category: '',
      dispute: '',
      reason: '',
      minAmount: '',
      maxAmount: '',
      minSample: '',
      updatedFrom: '',
      updatedTo: '',
      completedFrom: '',
      completedTo: '',
      signIn: false,
      accountStatus: '',
      accountType: '',
      severity: '',
      query: '',
      page: 1,
    };
  }
  return state.filters[section];
}

function isoDate(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function presetDates(preset) {
  const today = vilniusDateParts(new Date());
  if (!preset || preset === 'all' || preset === 'custom') return null;
  if (preset === 'today') return { from: isoDate(today), to: isoDate(today) };
  if (preset === 'yesterday') {
    const day = shiftVilniusDate(today.year, today.month, today.day, -1);
    return { from: isoDate(day), to: isoDate(day) };
  }
  if (preset === '7' || preset === '30' || preset === '90') {
    const start = shiftVilniusDate(today.year, today.month, today.day, -(Number(preset) - 1));
    return { from: isoDate(start), to: isoDate(today) };
  }
  if (preset === 'month') return { from: isoDate({ year: today.year, month: today.month, day: 1 }), to: isoDate(today) };
  if (preset === 'last-month') {
    const last = shiftVilniusDate(today.year, today.month, 1, -1);
    return { from: isoDate({ year: last.year, month: last.month, day: 1 }), to: isoDate(last) };
  }
  if (preset === 'year') return { from: `${today.year}-01-01`, to: isoDate(today) };
  return null;
}

function sharedRange(section) {
  const filter = ensureFilter(section);
  if (filter.preset === 'custom') return dateRange(filter.from, filter.to);
  const dates = presetDates(filter.preset);
  if (!dates) {
    const bucket = state[section];
    if (bucket && (bucket.from || bucket.to)) return dateRange(bucket.from, bucket.to);
    return { created_from: null, created_to: null };
  }
  return dateRange(dates.from, dates.to);
}

async function loadCityOptions() {
  if (Array.isArray(state.cityOptions)) return state.cityOptions;
  try {
    const data = await rpc('admin_list_cities');
    state.cityOptions = Array.isArray(data.cities) ? data.cities : [];
  } catch (error) {
    if (typeof missingRpc === 'function' && missingRpc(error)) state.cityOptions = [];
  }
  return state.cityOptions;
}

function filterBar(section, config) {
  const filter = ensureFilter(section);
  const sorts = config.sorts || [];
  const advanced = config.advanced || [];
  const stored = Array.isArray(state.cityOptions) ? state.cityOptions : [];
  const cityOptions = [['all', 'All Lithuania'], ['unspecified', 'Unspecified city']]
    .concat(stored.map((city) => [city, city]));
  const cityNote = config.hideCity || stored.length ? '' : '<p class="muted">Stored city names appear after the filters migration is applied. All Lithuania and Unspecified city still work.</p>';
  return `<div class="filters" data-filter-section="${section}">
    ${config.hideCity ? '' : `<label>${escapeHtml(config.cityLabel || 'City')}<select data-filter-key="city">${cityOptions.map(([value, label]) => `<option value="${escapeHtml(value)}" ${filter.city === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`}
    <label>Date<select data-filter-key="preset">${DATE_PRESETS.map(([value, label]) => `<option value="${value}" ${filter.preset === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
    ${filter.preset === 'custom' ? `<input data-filter-key="from" type="date" value="${escapeHtml(filter.from)}" aria-label="From"><input data-filter-key="to" type="date" value="${escapeHtml(filter.to)}" aria-label="To">` : ''}
    ${sorts.length ? `<label>Sort<select data-filter-key="sort">${sorts.map(([value, label]) => `<option value="${value}" ${filter.sort === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>` : ''}
  </div>
  ${cityNote}
  ${advanced.length ? `<details class="advanced"><summary>Advanced filters</summary><div class="filters">${advanced.map((field) => filterField(section, filter, field)).join('')}</div></details>` : ''}
  <p class="muted">${escapeHtml(config.note || '')}</p>`;
}

function filterField(section, filter, field) {
  if (field.kind === 'check') {
    return `<label><input data-filter-key="${field.key}" type="checkbox" ${filter[field.key] ? 'checked' : ''}> ${escapeHtml(field.label)}</label>`;
  }
  if (field.kind === 'select') {
    return `<label>${escapeHtml(field.label)}<select data-filter-key="${field.key}"><option value="">Any</option>${field.options.map((option) => {
      const value = Array.isArray(option) ? option[0] : option;
      const label = Array.isArray(option) ? option[1] : option;
      return `<option value="${escapeHtml(value)}" ${filter[field.key] === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('')}</select></label>`;
  }
  return `<label>${escapeHtml(field.label)}<input data-filter-key="${field.key}" value="${escapeHtml(filter[field.key] || '')}" placeholder="${escapeHtml(field.placeholder || '')}"></label>`;
}

function bindFilterBar(section) {
  document.querySelectorAll(`[data-filter-section="${section}"] [data-filter-key], details.advanced [data-filter-key]`).forEach((input) => {
    input.addEventListener('change', () => {
      const filter = ensureFilter(section);
      filter[input.dataset.filterKey] = input.type === 'checkbox' ? input.checked : input.value;
      if (state[section] && Object.prototype.hasOwnProperty.call(state[section], 'page')) state[section].page = 1;
      filter.page = 1;
      renderSection();
    });
  });
}

function blankUuid(value) {
  const parsed = uuidOrNull(value || '');
  return parsed === undefined ? undefined : parsed;
}

function amountOrNull(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function renderGlobalSearch(root) {
  const filter = ensureFilter('search');
  let result = null;
  let error = '';
  if ((filter.query || '').trim().length >= 2) {
    try {
      result = await rpc('admin_global_search', { search: filter.query.trim(), page: 1 });
    } catch (caught) {
      error = missingRpc(caught) ? INTEL_NOTE : (caught.message || 'Search failed.');
    }
  }
  const groups = [
    ['users', 'Users', 'open-user'],
    ['listings', 'Listings', 'open-listing'],
    ['offers', 'Offers', 'open-offer'],
    ['deals', 'Deals', 'open-deal'],
    ['reports', 'Reports', 'open-report'],
  ];
  root.innerHTML = `
    ${panelMessage('Search runs on the server and returns at most 8 records in each group. Email and phone appear only after the administrator check.')}
    <div class="filters"><input id="global-search" value="${escapeHtml(filter.query)}" placeholder="Name, email, phone, or record id"></div>
    ${error ? panelMessage(error, 'form-error') : ''}
    ${(filter.query || '').trim().length < 2 ? panelMessage('Enter at least 2 characters.') : ''}
    ${result ? groups.map(([key, title, action]) => {
      const rows = Array.isArray(result[key]) ? result[key] : [];
      return `<section class="panel"><h2>${title}</h2>${rows.length ? `<div class="table-wrap"><table><tbody>${rows.map((row) => `<tr><td>${linkButton(action, row.id, row.label || row.id)}</td><td>${escapeHtml(row.email || row.phone || row.listing_city || row.profile_city || row.status || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No matches.</p>'}</section>`;
    }).join('') : ''}`;
  $('global-search').addEventListener('change', (event) => {
    filter.query = event.target.value.trim();
    renderSection();
  });
}

async function renderNotifications(root) {
  const filter = ensureFilter('notifications');
  const range = sharedRange('notifications');
  let result = { rows: [], total: 0, page: filter.page || 1 };
  let error = '';
  try {
    if (typeof canAct !== 'function' || canAct('notify-write')) {
      try {
        await rpc('admin_refresh_notifications');
      } catch (refreshError) {
        if (typeof missingRpc !== 'function' || !missingRpc(refreshError)) {
          error = refreshError.message || 'Notifications could not be refreshed.';
        }
      }
    }
    result = pageResult(await rpc('admin_list_notifications', {
      severity: filter.severity || null,
      created_from: range.created_from,
      created_to: range.created_to,
      page: filter.page || 1,
      page_size: PAGE_SIZE,
    }));
  } catch (caught) {
    error = missingRpc(caught) ? INTEL_NOTE : (caught.message || 'Notifications could not be loaded.');
  }
  root.innerHTML = `
    ${panelMessage('Each event is stored once. Refresh does not create a second notification for the same report, dispute, or suggestion.')}
    ${error ? panelMessage(error, 'form-error') : ''}
    ${filterBar('notifications', { hideCity: true, sorts: [], note: 'Severity and date apply on the server.' })}
    <label>Severity<select id="notice-severity"><option value="">Any</option>${['critical', 'high', 'normal', 'low'].map((item) => `<option value="${item}" ${filter.severity === item ? 'selected' : ''}>${item}</option>`).join('')}</select></label>
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Severity</th><th>Event</th><th>Summary</th><th>Status</th><th></th></tr></thead><tbody>
      ${result.rows.map((row) => `<tr>
        <td>${escapeHtml(formatVilnius(row.created_at))}</td>
        <td>${badge(row.severity)}</td>
        <td>${escapeHtml(row.event_type)}</td>
        <td>${escapeHtml(row.summary)}</td>
        <td>${row.resolved_at ? 'Resolved' : row.read_at ? 'Read' : 'Unread'}${row.assigned_admin_id ? ` · ${escapeHtml(row.assigned_admin_id)}` : ''}</td>
        <td>
          ${row.user_id ? linkButton('open-user', row.user_id, 'User') : ''}
          ${row.listing_id ? linkButton('open-listing', row.listing_id, 'Listing') : ''}
          ${row.offer_id ? linkButton('open-offer', row.offer_id, 'Offer') : ''}
          ${row.deal_id ? linkButton('open-deal', row.deal_id, 'Deal') : ''}
          ${row.report_id ? linkButton('open-report', row.report_id, 'Report') : ''}
          ${(typeof canAct !== 'function' || canAct('notify-write')) ? `<button class="ghost" data-action="notice-read" data-id="${escapeHtml(row.id)}">Mark read</button>
          <button class="ghost" data-action="notice-resolve" data-id="${escapeHtml(row.id)}">Resolve</button>
          <button class="ghost" data-action="notice-assign" data-id="${escapeHtml(row.id)}">Assign</button>` : ''}
        </td>
      </tr>`).join('')}
    </tbody></table></div>` : error ? '' : '<p class="empty">No notifications.</p>'}
    ${pager(result.page, result.total, 'notifications-page')}`;
  bindFilterBar('notifications');
  const severity = $('notice-severity');
  if (severity) severity.addEventListener('change', (event) => {
    filter.severity = event.target.value;
    filter.page = 1;
    renderSection();
  });
}

async function renderFraud(root) {
  let payload = { rows: [], review_note: '' };
  let error = '';
  try {
    payload = await rpc('admin_fraud_signals');
  } catch (caught) {
    error = missingRpc(caught) ? INTEL_NOTE : (caught.message || 'Fraud signals could not be loaded.');
  }
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  root.innerHTML = `
    ${panelMessage(payload.review_note || 'A signal does not suspend or ban an account. Review it, then use the user card if moderation is still warranted.')}
    ${error ? panelMessage(error, 'form-error') : ''}
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Severity</th><th>Reason</th><th>Evidence</th><th>Review</th><th></th></tr></thead><tbody>
      ${rows.map((row) => `<tr>
        <td>${badge(row.severity)}</td>
        <td>${escapeHtml(row.reason)}</td>
        <td>${escapeHtml(Array.isArray(row.evidence) ? row.evidence.join(', ') : '')}</td>
        <td>${escapeHtml(row.review_status || 'open')}${row.reviewed_at ? ` · ${escapeHtml(formatVilnius(row.reviewed_at))}` : ''}</td>
        <td>
          ${row.user_id ? linkButton('open-user', row.user_id, 'User') : ''}
          ${row.deal_id ? linkButton('open-deal', row.deal_id, 'Deal') : ''}
          ${(typeof canAct !== 'function' || canAct('fraud')) ? `<button class="ghost" data-action="fraud-review" data-id="${escapeHtml(row.signal_key)}" data-status="reviewed">Mark reviewed</button>
          <button class="ghost" data-action="fraud-review" data-id="${escapeHtml(row.signal_key)}" data-status="dismissed">Dismiss</button>` : ''}
        </td>
      </tr>`).join('')}
    </tbody></table></div>` : error ? '' : '<p class="empty">No rule matched the current records.</p>'}`;
}

async function renderCategoryPerformance(root) {
  const filter = ensureFilter('performance');
  const range = sharedRange('performance');
  let result = { rows: [], total: 0, page: filter.page || 1 };
  let error = '';
  try {
    result = pageResult(await rpc('admin_category_performance', {
      city: filter.city,
      created_from: range.created_from,
      created_to: range.created_to,
      page: filter.page || 1,
      page_size: PAGE_SIZE,
    }));
  } catch (caught) {
    error = missingRpc(caught) ? INTEL_NOTE : (caught.message || 'Category performance could not be loaded.');
  }
  root.innerHTML = `
    ${panelMessage('Listing counts, offers, and deals all use the same filtered listings. Conversion is completed deals divided by offers and is left blank when a category has no offers. Average value stays split by currency.')}
    ${error ? panelMessage(error, 'form-error') : ''}
    ${filterBar('performance', { cityLabel: 'Listing city', note: 'City means the listing city, not the owner profile city.' })}
    ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Category</th><th>Subcategory</th><th>Listings</th><th>Without offers</th><th>Offers</th><th>Deals</th><th>Completed</th><th>Conversion</th><th>Average value by currency</th><th>Avg first offer</th><th>Cities</th></tr></thead><tbody>
      ${result.rows.map((row) => {
        const offers = Number(row.offers);
        const completed = Number(row.completed_deals);
        const conversion = offers > 0 ? `${Math.round((completed / offers) * 1000) / 10}%` : '—';
        const seconds = Number(row.average_first_offer_seconds);
        const firstOffer = Number.isFinite(seconds) ? `${Math.round(seconds / 3600)} h` : '—';
        const cities = Array.isArray(row.cities) ? row.cities.map((item) => `${item.city} ${item.listings}`).join(', ') : '—';
        const averages = Array.isArray(row.completed_value) ? row.completed_value.map((item) => `${item.average_value} ${item.currency} (${item.completed_deals})`).join(', ') : '—';
        return `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.subcategory || '—')}</td><td>${escapeHtml(row.listings)}</td><td>${escapeHtml(row.listings_without_offers)}</td><td>${escapeHtml(row.offers)}</td><td>${escapeHtml(row.deals)}</td><td>${escapeHtml(row.completed_deals)}</td><td>${escapeHtml(conversion)}</td><td>${escapeHtml(averages || '—')}</td><td>${escapeHtml(firstOffer)}</td><td>${escapeHtml(cities)}</td></tr>`;
      }).join('')}
    </tbody></table></div>` : error ? '' : '<p class="empty">No listings match this filter.</p>'}
    ${pager(result.page, result.total, 'performance-page')}`;
  bindFilterBar('performance');
}

async function renderFinance(root) {
  const filter = ensureFilter('finance');
  const range = sharedRange('finance');
  let summary = null;
  let error = '';
  try {
    summary = await rpc('admin_finance_summary', { city: filter.city, created_from: range.created_from, created_to: range.created_to });
  } catch (caught) {
    error = missingRpc(caught) ? INTEL_NOTE : (caught.message || 'Finance could not be loaded.');
  }
  const moneyRows = (rows, columns) => (Array.isArray(rows) && rows.length ? `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column[1])}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column[0]] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="empty">No completed deals in this filter.</p>');
  root.innerHTML = `
    ${panelMessage('Completed deal value is gross merchandise value. It is not YouNeed revenue. Calculated commission is the stored rate times the deal amount. It has not been collected unless a payment ledger says so, and no payment ledger is available.')}
    ${error ? panelMessage(error, 'form-error') : ''}
    ${filterBar('finance', { cityLabel: 'Listing city', note: 'Amounts use the listing city and the completion time.' })}
    ${summary ? `<section class="panel"><h2>By currency</h2>${moneyRows(summary.by_currency, [['currency', 'Currency'], ['completed_deals', 'Completed deals'], ['completed_value', 'Completed deal value'], ['average_value', 'Average'], ['calculated_commission', 'Calculated commission'], ['paid_value', 'Marked paid']])}</section>
      <section class="panel"><h2>Monthly</h2>${moneyRows(summary.by_month, [['period', 'Month'], ['currency', 'Currency'], ['deals', 'Deals'], ['completed_value', 'Completed deal value']])}</section>
      <section class="panel"><h2>Quarterly</h2>${moneyRows(summary.by_quarter, [['period', 'Quarter'], ['currency', 'Currency'], ['deals', 'Deals'], ['completed_value', 'Completed deal value']])}</section>
      <section class="panel"><h2>By category</h2>${moneyRows(summary.by_category, [['category', 'Category'], ['currency', 'Currency'], ['deals', 'Deals'], ['completed_value', 'Completed deal value']])}</section>
      <section class="panel"><h2>By listing city</h2>${moneyRows(summary.by_city, [['city', 'Listing city'], ['currency', 'Currency'], ['deals', 'Deals'], ['completed_value', 'Completed deal value']])}</section>
      <p class="muted">${escapeHtml(summary.revenue_meaning || '')}</p>` : ''}`;
  bindFilterBar('finance');
}

async function renderHealth(root) {
  const filter = ensureFilter('health');
  const range = sharedRange('health');
  let health = null;
  let error = '';
  try {
    health = await rpc('admin_marketplace_health', { city: filter.city, created_from: range.created_from, created_to: range.created_to });
  } catch (caught) {
    error = missingRpc(caught) ? INTEL_NOTE : (caught.message || 'Marketplace health could not be loaded.');
  }
  const warnings = health && Array.isArray(health.warnings) ? health.warnings.filter(Boolean) : [];
  root.innerHTML = `
    ${panelMessage('Warnings quote the rate and the sample. There is no single health score.')}
    ${error ? panelMessage(error, 'form-error') : ''}
    ${filterBar('health', { cityLabel: 'City', note: 'Registrations and sign-ins use the profile city. Listings, offers, deals, and reports use the listing city.' })}
    ${health ? `<div class="facts">
      ${fact('New registrations', health.new_registrations)}
      ${fact('Signed in during range', health.signed_in_users)}
      ${fact('Repeat completed-deal users', health.repeat_users)}
      ${fact('New listings', health.new_listings)}
      ${fact('Offers', health.offers)}
      ${fact('Offers per listing', health.offers_per_listing)}
      ${fact('Deals', health.deals)}
      ${fact('Offer-to-deal rate', health.offer_to_deal_rate)}
      ${fact('Completion rate', health.completion_rate)}
      ${fact('Cancellation rate', health.cancellation_rate)}
      ${fact('Dispute rate', health.dispute_rate)}
      ${fact('Reports per 100 profiles', health.reports_per_100_users)}
    </div>
    <p class="muted">${escapeHtml(health.signed_in_meaning || '')}</p>
    <p class="muted">${escapeHtml(health.repeat_formula || '')} ${escapeHtml(health.offer_to_deal_formula || '')} ${escapeHtml(health.completion_formula || '')} ${escapeHtml(health.reports_per_100_formula || '')}</p>
    ${warnings.length ? warnings.map((warning) => panelMessage(warning, 'form-error')).join('') : panelMessage('No warning threshold was reached. A dispute warning needs at least 5 deals and a 10 percent dispute rate. A cancellation warning needs at least 5 deals and a 30 percent cancellation rate.')}` : ''}`;
  bindFilterBar('health');
}

async function renderRoles(root) {
  let payload = { rows: [], note: '' };
  let error = '';
  try {
    payload = await rpc('admin_list_roles');
  } catch (caught) {
    error = missingRpc(caught) ? INTEL_NOTE : (caught.message || 'Roles could not be loaded.');
  }
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  root.innerHTML = `
    ${panelMessage(payload.note || 'Only a Super Admin can assign roles. An administrator without a role cannot use admin functions.')}
    ${error ? panelMessage(error, 'form-error') : ''}
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Administrator</th><th>Role</th><th></th></tr></thead><tbody>
      ${rows.map((row) => `<tr><td>${escapeHtml(row.name || row.user_id)}</td><td>${escapeHtml(row.role || 'No role')}</td><td>
        ${['super_admin', 'moderator', 'support', 'analyst', 'finance'].map((role) => `<button class="ghost" data-action="set-role" data-id="${escapeHtml(row.user_id)}" data-role="${role}">${role}</button>`).join('')}
      </td></tr>`).join('')}
    </tbody></table></div>` : ''}
    <div id="role-error"></div>`;
}

async function userPrivatePanels(userId) {
  let privateCard = null;
  let reputation = null;
  const notesAllowed = typeof canAct !== 'function' || canAct('notes');
  const reputationAllowed = typeof canAct !== 'function' || canAct('reputation');
  if (notesAllowed) {
    try {
      privateCard = await rpc('admin_user_private', { target_user: userId });
    } catch (error) {
      if (!missingRpc(error)) throw error;
    }
  }
  if (reputationAllowed) {
    try {
      reputation = await rpc('admin_user_reputation', { target_user: userId });
    } catch (error) {
      if (!missingRpc(error)) throw error;
    }
  }
  if (!privateCard && !reputation) return '';
  const tags = privateCard && Array.isArray(privateCard.tags) ? privateCard.tags : [];
  const notes = privateCard && Array.isArray(privateCard.notes) ? privateCard.notes : [];
  return `<h3>Internal reputation</h3>
    ${reputation ? `<div class="facts">
      ${fact('Completed deals', reputation.completed_deals)}
      ${fact('Cancelled deals', reputation.cancelled_deals)}
      ${fact('Disputed deals', reputation.disputed_deals)}
      ${fact('Completion rate', reputation.completion_rate)}
      ${fact('Reports received', reputation.reports_received)}
      ${fact('Confirmed violations', 'Not recorded')}
      ${fact('Average response time', 'Not recorded')}
      ${fact('Account created', formatVilnius(reputation.account_created_at))}
    </div>
    <p class="muted">${escapeHtml(reputation.completion_formula || '')}. ${escapeHtml(reputation.confirmed_violations_note || '')} ${escapeHtml(reputation.response_time_note || '')} Public rating is not used.</p>` : ''}
    ${notesAllowed ? `<h3>Internal tags</h3>
    <div class="chips">${USER_TAGS.map(([value, label]) => `<button class="ghost" data-action="user-tag" data-id="${escapeHtml(userId)}" data-tag="${value}" data-enabled="${tags.includes(value) ? 'false' : 'true'}" aria-pressed="${tags.includes(value)}">${escapeHtml(label)}</button>`).join('')}</div>
    <h3>Internal notes</h3>
    ${notes.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Author</th><th>Note</th></tr></thead><tbody>
      ${notes.map((note) => `<tr><td>${escapeHtml(formatVilnius(note.created_at))}</td><td>${escapeHtml(note.author_id)}</td><td>${escapeHtml(note.body)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No internal notes.</p>'}
    <label for="user-note">Add an internal note</label>
    <textarea id="user-note"></textarea>
    <button class="primary" data-action="add-user-note" data-id="${escapeHtml(userId)}">Save note</button>
    <div id="user-note-error"></div>` : ''}`;
}

async function handleIntelClick(event, action, button) {
  if (action === 'notifications-page' || action === 'performance-page') {
    const page = Number(button.dataset.page);
    if (page < 1) return true;
    const section = action === 'notifications-page' ? 'notifications' : 'performance';
    ensureFilter(section).page = page;
    renderSection();
    return true;
  }
  if (action === 'notice-read' || action === 'notice-resolve' || action === 'notice-assign') {
    let assignee = null;
    if (action === 'notice-assign') {
      assignee = window.prompt('Administrator user id');
      if (assignee == null) return true;
      assignee = assignee.trim();
      if (!assignee) return true;
    }
    const errorSlot = $('content');
    try {
      await rpc('admin_update_notification', {
        notification_id: button.dataset.id,
        action: action === 'notice-read' ? 'read' : action === 'notice-resolve' ? 'resolve' : 'assign',
        assignee,
      });
      renderSection();
    } catch (caught) {
      if (errorSlot) errorSlot.insertAdjacentHTML('afterbegin', panelMessage(caught.message || 'The notification could not be updated.', 'form-error'));
    }
    return true;
  }
  if (action === 'fraud-review') {
    if (!window.confirm('Save this fraud review? It does not suspend or ban the account.')) return true;
    await rpc('admin_review_fraud', { signal_key: button.dataset.id, status: button.dataset.status });
    renderSection();
    return true;
  }
  if (action === 'set-role') {
    const error = $('role-error');
    if (!window.confirm(`Assign ${button.dataset.role} to this administrator?`)) return true;
    try {
      await rpc('admin_set_role', { target_user: button.dataset.id, role: button.dataset.role });
      renderSection();
    } catch (caught) {
      if (error) error.innerHTML = panelMessage(caught.message || 'The role could not be saved.', 'form-error');
    }
    return true;
  }
  if (action === 'user-tag') {
    await rpc('admin_set_user_tag', {
      target_user: button.dataset.id,
      tag: button.dataset.tag,
      enabled: button.dataset.enabled === 'true',
    });
    renderSection();
    return true;
  }
  if (action === 'add-user-note') {
    const error = $('user-note-error');
    const body = ($('user-note') || {}).value || '';
    try {
      await rpc('admin_add_user_note', { target_user: button.dataset.id, body: body.trim() });
      renderSection();
    } catch (caught) {
      if (error) error.innerHTML = panelMessage(caught.message || 'The note could not be saved.', 'form-error');
    }
    return true;
  }
  return false;
}

if (typeof startAdmin === 'function') startAdmin();
