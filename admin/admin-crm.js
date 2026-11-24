/**
 * YouNeed Web Admin CRM 2.0
 * Dedicated customer profiles at #users/<uuid> (and /admin/users/<uuid> when rewritten).
 * Uses existing deployed admin_* RPCs only. Does not invent missing data.
 */
(function () {
  const CRM_TABS = [
    ['overview', 'Overview'],
    ['personal', 'Personal Data'],
    ['activity', 'Activity'],
    ['listings', 'Listings'],
    ['deals', 'Deals'],
    ['messages', 'Messages'],
    ['payments', 'Payments'],
    ['connections', 'Connections'],
    ['security', 'Security'],
    ['reports', 'Reports'],
    ['notes', 'Admin Notes'],
  ];

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function ensureCrmState() {
    if (!state.users.crmTab) state.users.crmTab = 'overview';
    if (!state.users.messageDealId) state.users.messageDealId = null;
    if (!('messagesPage' in state.users)) state.users.messagesPage = 1;
    if (!('listingsPage' in state.users)) state.users.listingsPage = 1;
    if (!('dealsPage' in state.users)) state.users.dealsPage = 1;
    if (!('paymentsPage' in state.users)) state.users.paymentsPage = 1;
    if (!('reportsPage' in state.users)) state.users.reportsPage = 1;
  }

  function isUuid(value) {
    return typeof value === 'string' && UUID_RE.test(value);
  }

  window.parseAdminRoute = function parseAdminRoute() {
    const pathMatch = location.pathname.match(/\/admin\/users\/([^/]+)\/?$/i);
    if (pathMatch && isUuid(pathMatch[1])) {
      return { section: 'users', crmId: pathMatch[1] };
    }
    const raw = (location.hash || '#dashboard').replace(/^#/, '') || 'dashboard';
    const userMatch = raw.match(/^users\/([^/]+)$/i);
    if (userMatch && isUuid(userMatch[1])) {
      return { section: 'users', crmId: userMatch[1] };
    }
    const section = raw.split('/')[0] || 'dashboard';
    return { section, crmId: null };
  };

  window.openCrmUser = function openCrmUser(userId) {
    if (!isUuid(userId)) return;
    ensureCrmState();
    state.users.selected = userId;
    state.users.crmTab = 'overview';
    state.users.activityPage = {};
    state.users.messageDealId = null;
    state.section = 'users';
    const title = $('title');
    if (title) title.textContent = 'Customer CRM';
    document.querySelectorAll('.sidebar button[data-section]').forEach((button) => {
      button.setAttribute('aria-current', button.dataset.section === 'users' ? 'page' : 'false');
    });
    if (location.pathname.indexOf('/admin/users/') === 0) {
      history.pushState({}, '', `/admin/users/${userId}`);
      location.hash = '';
    } else {
      location.hash = `users/${userId}`;
    }
    renderSection();
  };

  window.closeCrmUser = function closeCrmUser() {
    state.users.selected = null;
    state.users.messageDealId = null;
    if (location.pathname.indexOf('/admin/users/') === 0) {
      history.pushState({}, '', '/admin/');
    }
    setSection('users');
  };

  function money(amount, currency) {
    if (amount == null || amount === '') return '—';
    return `${amount} ${currency || ''}`.trim();
  }

  function avatarHtml(card) {
    const name = displayName(card) || '?';
    if (card.avatar_url) {
      return `<img class="avatar crm-avatar" src="${escapeHtml(card.avatar_url)}" alt="">`;
    }
    return `<span class="avatar-fallback crm-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
  }

  async function safeRpc(name, args) {
    try {
      return { ok: true, data: await rpc(name, args || {}) };
    } catch (error) {
      if (missingRpc(error)) return { ok: false, missing: true, error };
      return { ok: false, missing: false, error };
    }
  }

  async function loadCard(userId) {
    const remote = await safeRpc('admin_user_card', { target_user: userId });
    if (remote.ok && remote.data) return { card: remote.data, source: 'rpc' };
    return {
      card: {
        id: userId,
        full_name: null,
        email: null,
        phone: null,
        business_phone: null,
        sign_in_phone: null,
        address: null,
        business_address: null,
        city: null,
        district: null,
        created_at: null,
        updated_at: null,
        last_sign_in_at: null,
        account_type: null,
        role: null,
        is_active: null,
        availability: null,
        avatar_url: null,
        identity_available: false,
        identity_verified: null,
        identity_verified_at: null,
      },
      source: 'fallback',
    };
  }

  function tabBar(active) {
    return `<nav class="crm-tabs" role="tablist">${CRM_TABS.map(([id, label]) => `
      <button type="button" class="crm-tab" data-action="crm-tab" data-tab="${id}" aria-selected="${active === id}">${escapeHtml(label)}</button>
    `).join('')}</nav>`;
  }

  function profileHeader(card, source) {
    const identity = identityText(card);
    return `<div class="crm-header">
      <button type="button" class="ghost" data-action="crm-back">← Users directory</button>
      <div class="crm-header-main">
        ${avatarHtml(card)}
        <div>
          <h2>${escapeHtml(displayName(card) || 'Unnamed account')}</h2>
          <p class="muted">ID · ${escapeHtml(card.id)}</p>
          <div class="chips">
            ${badge(card.account_type === 'business' ? 'business' : 'personal')}
            ${badge(card.is_active === false ? 'inactive' : 'active')}
            <span class="badge">${escapeHtml(identity)}</span>
          </div>
        </div>
      </div>
      <div class="facts crm-header-facts">
        ${fact('Email', card.email || (source === 'fallback' ? 'Hidden without admin_user_card' : '—'))}
        ${fact('Phone', card.phone || card.business_phone || card.sign_in_phone || '—')}
        ${fact('Registered', formatWhen(card.created_at))}
        ${fact('Last activity', formatWhen(card.last_sign_in_at) || 'Not collected historically')}
      </div>
      ${source === 'fallback' ? panelMessage('admin_user_card is unavailable in this session. Email and auth phone stay hidden.') : ''}
    </div>`;
  }

  function moderationBar(card) {
    if (!canAct('moderate')) {
      return panelMessage('Moderation actions require the moderator role (or Super Admin).');
    }
    return `<div class="crm-moderation panel">
      <h3>Moderation</h3>
      <p class="muted">Reason is required. Destructive actions ask for confirmation.</p>
      <div class="chips">
        <button class="ghost" data-action="moderate-user" data-id="${escapeHtml(card.id)}" data-moderation="suspend">Suspend</button>
        <button class="ghost" data-action="moderate-user" data-id="${escapeHtml(card.id)}" data-moderation="reactivate">Reactivate</button>
        <button class="danger" data-action="moderate-user" data-id="${escapeHtml(card.id)}" data-moderation="ban">Permanent ban</button>
        <button class="ghost" data-action="user-reports" data-id="${escapeHtml(card.id)}">Open reports</button>
      </div>
      <div id="user-moderation-error"></div>
    </div>`;
  }

  async function renderOverview(card, userId) {
    const listings = pageResult((await safeRpc('admin_list_listings', {
      search: null, category: null, status: null, owner_id: userId, page: 1, page_size: 1,
    })).data || { rows: [], total: 0 });
    const deals = pageResult((await safeRpc('admin_list_deals', {
      search: null, status: null, user_id: userId, created_from: null, created_to: null, page: 1, page_size: 1,
    })).data || { rows: [], total: 0 });
    const reports = pageResult((await safeRpc('admin_search_reports', {
      search: null, status: null, user_id: userId, page: 1, page_size: 1,
    })).data || { rows: [], total: 0 });
    return `<div class="crm-section">
      <div class="stats">
        <div class="stat"><span>Listings</span><b>${escapeHtml(listings.total)}</b></div>
        <div class="stat"><span>Deals</span><b>${escapeHtml(deals.total)}</b></div>
        <div class="stat"><span>Reports</span><b>${escapeHtml(reports.total)}</b></div>
        <div class="stat"><span>Status</span><b>${escapeHtml(card.is_active === false ? 'Inactive' : 'Active')}</b></div>
      </div>
      <div class="facts">
        ${fact('Account type', card.account_type)}
        ${fact('Role', card.role)}
        ${fact('Availability', card.availability)}
        ${fact('Profile updated', formatWhen(card.updated_at))}
        ${fact('City', card.city)}
        ${fact('District', card.district)}
        ${fact('Country', 'Not stored on the profile')}
      </div>
      ${moderationBar(card)}
    </div>`;
  }

  function renderPersonal(card) {
    return `<div class="crm-section">
      <div class="facts">
        ${fact('Full name', card.full_name)}
        ${fact('Business name', card.business_name)}
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
        ${fact('Last sign-in', formatWhen(card.last_sign_in_at))}
        ${fact('Identity', identityText(card))}
      </div>
    </div>`;
  }

  async function renderActivity(userId) {
    const blocks = await Promise.all(USER_ACTIVITY.map(async ([kind, title]) => {
      const page = state.users.activityPage[kind] || 1;
      const remote = await safeRpc('admin_user_activity', {
        target_user: userId, kind, page, page_size: PAGE_SIZE,
      });
      if (remote.missing) {
        return `<section class="panel"><h3>${escapeHtml(title)}</h3>${panelMessage(CRM_MIGRATION)}</section>`;
      }
      if (!remote.ok) {
        return `<section class="panel"><h3>${escapeHtml(title)}</h3>${panelMessage(remote.error.message || 'Could not load.', 'form-error')}</section>`;
      }
      const result = pageResult(remote.data);
      return `<section class="panel"><h3>${escapeHtml(title)}</h3>
        ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Record</th><th>Status</th><th>When</th></tr></thead><tbody>
          ${result.rows.map((row) => `<tr><td>${linkButton(`open-${row.record_type}`, row.record_id, row.label)}</td><td>${badge(row.status)}</td><td>${escapeHtml(formatWhen(row.created_at))}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">None.</p>'}
        ${pager(result.page, result.total, 'user-activity', `data-kind="${kind}"`)}
      </section>`;
    }));
    return `<div class="crm-section activity-grid">${blocks.join('')}</div>`;
  }

  async function renderListingsTab(userId) {
    const page = state.users.listingsPage || 1;
    let result = { rows: [], total: 0, page };
    let moderationReady = true;
    const listingArgs = {
      search: null, category: null, status: null, owner_id: userId, page, page_size: PAGE_SIZE,
    };
    const filtered = await safeRpc('admin_filter_listings', {
      ...listingArgs,
      subcategory: null,
      listing_type: null,
      city: 'all',
      created_from: null,
      created_to: null,
      updated_from: null,
      updated_to: null,
      sort: 'newest',
    });
    if (filtered.ok) {
      result = pageResult(filtered.data);
    } else {
      const directory = await safeRpc('admin_listing_directory', listingArgs);
      if (directory.ok) result = pageResult(directory.data);
      else {
        const basic = await safeRpc('admin_list_listings', listingArgs);
        if (basic.missing) moderationReady = false;
        if (basic.ok) result = pageResult(basic.data);
        else if (!basic.missing) {
          return panelMessage(basic.error.message || 'Listings could not be loaded.', 'form-error');
        }
      }
    }
    const selected = result.rows.find((row) => row.id === state.listings.selected) || null;
    return `<div class="crm-section">
      ${moderationReady ? '' : panelMessage('Hide / restore / archive need moderation RPCs.')}
      ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Title</th><th>Status</th><th>Published</th><th>Moderation</th></tr></thead><tbody>
        ${result.rows.map((listing) => `<tr data-action="crm-select-listing" data-id="${escapeHtml(listing.id)}" aria-selected="${selected && selected.id === listing.id}">
          <td>${escapeHtml(listing.title)}</td>
          <td>${badge(listing.status)}</td>
          <td>${escapeHtml(formatVilnius(listing.created_at))}</td>
          <td>${escapeHtml(listing.moderation_lock || 'None')}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No listings for this account.</p>'}
      ${pager(result.page, result.total, 'crm-listings-page')}
      ${selected ? `<section class="panel"><h3>${escapeHtml(selected.title)}</h3>
        <div class="facts">
          ${fact('Listing ID', selected.id)}
          ${fact('Status', selected.status)}
          ${fact('Type', selected.listing_type)}
          ${fact('Category', [selected.category, selected.subcategory].filter(Boolean).join(' · '))}
          ${fact('Published', formatVilnius(selected.created_at))}
          ${fact('Updated', formatVilnius(selected.updated_at))}
          ${fact('Moderation', selected.moderation_lock || 'None')}
        </div>
        ${canAct('listing-moderate') ? `<div class="chips">
          <button class="ghost" data-action="hide-listing" data-id="${escapeHtml(selected.id)}">Hide</button>
          <button class="ghost" data-action="restore-listing" data-id="${escapeHtml(selected.id)}">Restore hidden</button>
          <button class="danger" data-action="archive-listing" data-id="${escapeHtml(selected.id)}">Archive</button>
          <button class="ghost" data-action="unarchive-listing" data-id="${escapeHtml(selected.id)}">Restore archive</button>
        </div>
        <p class="muted">Delete is not offered here. Archive keeps history and related deals. Uses existing admin listing RPCs only.</p>` : ''}
        <div id="listing-error"></div>
      </section>` : panelMessage('Select a listing to moderate it.')}
    </div>`;
  }

  async function renderDealsTab(userId) {
    const page = state.users.dealsPage || 1;
    const remote = await safeRpc('admin_list_deals', {
      search: null,
      status: null,
      user_id: userId,
      created_from: null,
      created_to: null,
      page,
      page_size: PAGE_SIZE,
    });
    if (remote.missing) return panelMessage(CRM_MIGRATION);
    if (!remote.ok) return panelMessage(remote.error.message || 'Deals could not be loaded.', 'form-error');
    const result = pageResult(remote.data);
    return `<div class="crm-section">
      <p class="muted">Deal history only. Payment ledger is on the Payments tab.</p>
      ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Deal</th><th>Status</th><th>Amount</th><th>Client</th><th>Provider</th><th>When</th></tr></thead><tbody>
        ${result.rows.map((deal) => `<tr>
          <td>${linkButton('open-deal', deal.id, deal.id)}</td>
          <td>${badge(deal.status)}</td>
          <td>${escapeHtml(money(deal.amount, deal.currency))}</td>
          <td>${linkButton('open-user', deal.client_id, deal.client_id)}</td>
          <td>${linkButton('open-user', deal.provider_id, deal.provider_id)}</td>
          <td>${escapeHtml(formatWhen(deal.created_at))}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No deals for this account.</p>'}
      ${pager(result.page, result.total, 'crm-deals-page')}
    </div>`;
  }

  async function renderMessagesTab(userId) {
    const dealsRemote = await safeRpc('admin_list_deals', {
      search: null, status: null, user_id: userId, created_from: null, created_to: null, page: 1, page_size: 50,
    });
    const deals = dealsRemote.ok ? pageResult(dealsRemote.data).rows : [];
    const dealId = state.users.messageDealId;
    let messagesHtml = panelMessage('Select a deal to load chronological messages via admin_deal_messages.');
    if (dealId) {
      const remote = await safeRpc('admin_deal_messages', {
        deal_id: dealId,
        page: state.users.messagesPage || 1,
        page_size: PAGE_SIZE,
      });
      if (remote.missing) {
        messagesHtml = panelMessage('admin_deal_messages is not available in this session.');
      } else if (!remote.ok) {
        messagesHtml = panelMessage(remote.error.message || 'Messages could not be loaded.', 'form-error');
      } else if (!canAct('message-body')) {
        messagesHtml = panelMessage('Message bodies are limited to moderator and support roles.');
      } else {
        const result = pageResult(remote.data);
        messagesHtml = `
          <div class="chips">
            <button class="ghost" data-action="open-deal" data-id="${escapeHtml(dealId)}">Open deal workspace</button>
          </div>
          ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>From</th><th>To</th><th>Message</th></tr></thead><tbody>
            ${result.rows.map((row) => `<tr>
              <td>${escapeHtml(formatWhen(row.created_at))}</td>
              <td>${linkButton('open-user', row.sender_id, row.sender_id)}</td>
              <td>${linkButton('open-user', row.receiver_id, row.receiver_id)}</td>
              <td>${escapeHtml(row.message || '')}</td>
            </tr>`).join('')}
          </tbody></table></div>` : '<p class="empty">No messages in this deal.</p>'}
          ${pager(result.page, result.total, 'crm-messages-page')}
        `;
      }
    }
    return `<div class="crm-section">
      <h3>Deals with threads</h3>
      ${deals.length ? `<div class="table-wrap"><table><thead><tr><th>Deal</th><th>Status</th><th></th></tr></thead><tbody>
        ${deals.map((deal) => `<tr aria-selected="${dealId === deal.id}">
          <td>${escapeHtml(deal.id)}</td>
          <td>${badge(deal.status)}</td>
          <td><button class="ghost" data-action="crm-load-messages" data-id="${escapeHtml(deal.id)}">${dealId === deal.id ? 'Selected' : 'Load messages'}</button></td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No deals available for message history.</p>'}
      <h3>Thread</h3>
      ${messagesHtml}
    </div>`;
  }

  async function renderPaymentsTab(userId) {
    const dealsRemote = await safeRpc('admin_list_deals', {
      search: null, status: null, user_id: userId, created_from: null, created_to: null, page: 1, page_size: 100,
    });
    const deals = dealsRemote.ok ? pageResult(dealsRemote.data).rows : [];
    const dealIds = new Set(deals.map((d) => String(d.id)));
    const paymentsRemote = await safeRpc('admin_list_payment_transactions', {
      page: state.users.paymentsPage || 1,
      page_size: 100,
    });
    let ledgerNote = '';
    let rows = [];
    if (paymentsRemote.missing) {
      ledgerNote = 'Payment ledger requires admin_list_payment_transactions (finance / super_admin). Deal amounts below are not payment history.';
    } else if (!paymentsRemote.ok) {
      ledgerNote = paymentsRemote.error.message || 'Payment ledger could not be loaded.';
    } else {
      const all = Array.isArray(paymentsRemote.data) ? paymentsRemote.data : [];
      rows = all.filter((row) => dealIds.has(String(row.deal_id)));
      ledgerNote = rows.length
        ? 'Payment ledger rows matched to this user’s deals.'
        : 'No payment_transactions matched this user’s deals yet.';
    }
    return `<div class="crm-section">
      <h3>Payment history</h3>
      ${panelMessage(ledgerNote)}
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Method</th><th>Kind</th><th>Status</th><th>Amount</th><th>Fee</th><th>Deal</th><th>Refund</th></tr></thead><tbody>
        ${rows.map((row) => `<tr>
          <td>${escapeHtml(formatWhen(row.created_at))}</td>
          <td>${escapeHtml(row.method || '—')}</td>
          <td>${escapeHtml(row.kind || '—')}</td>
          <td>${badge(row.status)}</td>
          <td>${escapeHtml(money(row.amount, row.currency))}</td>
          <td>${escapeHtml(row.application_fee_amount != null ? row.application_fee_amount : '—')}</td>
          <td>${linkButton('open-deal', row.deal_id, row.deal_id)}</td>
          <td>${escapeHtml(row.stripe_refund_id || '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No ledger rows for this user.</p>'}
      <h3>Deal amounts (not payment history)</h3>
      ${deals.filter((d) => d.amount != null).length ? `<div class="table-wrap"><table><thead><tr><th>Deal</th><th>Status</th><th>Amount</th><th>When</th></tr></thead><tbody>
        ${deals.filter((d) => d.amount != null).map((deal) => `<tr>
          <td>${linkButton('open-deal', deal.id, deal.id)}</td>
          <td>${badge(deal.status)}</td>
          <td>${escapeHtml(money(deal.amount, deal.currency))}</td>
          <td>${escapeHtml(formatWhen(deal.created_at))}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No deal amounts visible.</p>'}
    </div>`;
  }

  async function renderConnectionsTab(userId) {
    const dealsRemote = await safeRpc('admin_list_deals', {
      search: null, status: null, user_id: userId, created_from: null, created_to: null, page: 1, page_size: 50,
    });
    const deals = dealsRemote.ok ? pageResult(dealsRemote.data).rows : [];
    const map = new Map();
    for (const deal of deals) {
      for (const other of [deal.client_id, deal.provider_id]) {
        if (!other || other === userId) continue;
        if (!map.has(other)) {
          map.set(other, { id: other, deals: 0, label: 'Shared deal' });
        }
        map.get(other).deals += 1;
      }
    }
    const reportsRemote = await safeRpc('admin_search_reports', {
      search: null, status: null, user_id: userId, page: 1, page_size: 50,
    });
    const reportRows = reportsRemote.ok ? pageResult(reportsRemote.data).rows : [];
    for (const report of reportRows) {
      const other = report.reporter_id;
      if (!other || other === userId) continue;
      if (!map.has(other)) map.set(other, { id: other, deals: 0, label: 'Report relationship' });
      else map.get(other).label = 'Deal + report relationship';
    }
    const rows = [...map.values()];
    return `<div class="crm-section">
      <p class="muted">Confirmed relationships from shared deals and reports only. IP/device matches are not invented.</p>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>User</th><th>Relationship</th><th>Shared deals</th></tr></thead><tbody>
        ${rows.map((row) => `<tr>
          <td>${linkButton('open-user', row.id, row.id)}</td>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.deals)}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No confirmed relationships.</p>'}
    </div>`;
  }

  async function renderSecurityTab(userId) {
    const remote = await safeRpc('admin_user_security_events', {
      target_user: userId, page: 1, page_size: PAGE_SIZE,
    });
    if (remote.missing) {
      return panelMessage('No security event store is available in this environment. Historical IPs and devices were never collected and are not shown.');
    }
    if (!remote.ok) {
      return panelMessage(remote.error.message || 'Security events could not be loaded.', 'form-error');
    }
    if (!canAct('moderate') && state.adminRole !== 'super_admin' && !state.roleLegacy) {
      return panelMessage('Support and analyst roles do not receive raw IP or device evidence.');
    }
    const result = pageResult(remote.data);
    return `<div class="crm-section">
      ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Kind</th><th>Platform</th><th>Geo</th><th>IP hash</th></tr></thead><tbody>
        ${result.rows.map((row) => `<tr>
          <td>${escapeHtml(formatWhen(row.created_at))}</td>
          <td>${escapeHtml(row.kind || '—')}</td>
          <td>${escapeHtml(row.platform || '—')}</td>
          <td>${escapeHtml(row.approximate_geo || '—')}</td>
          <td>${escapeHtml(row.ip_hash ? `${String(row.ip_hash).slice(0, 12)}…` : '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No security events recorded for this account.</p>'}
    </div>`;
  }

  async function renderReportsTab(userId) {
    const page = state.users.reportsPage || 1;
    const remote = await safeRpc('admin_search_reports', {
      search: null, status: null, user_id: userId, page, page_size: PAGE_SIZE,
    });
    if (remote.missing) {
      // admin_list_reports is not user-scoped — do not show an unfiltered list as this customer's reports.
      return panelMessage('admin_search_reports is unavailable, so user-scoped reports cannot be listed here. Use the Reports section.');
    }
    if (!remote.ok) {
      return panelMessage(remote.error.message || 'Reports could not be loaded.', 'form-error');
    }
    const result = pageResult(remote.data);
    return `<div class="crm-section">
      ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Reason</th><th>Status</th><th>Reporter</th><th>When</th><th>Note</th></tr></thead><tbody>
        ${result.rows.map((report) => `<tr>
          <td>${linkButton('open-report', report.id, report.reason)}</td>
          <td>${badge(report.status)}</td>
          <td>${linkButton('open-user', report.reporter_id, report.reporter_id)}</td>
          <td>${escapeHtml(formatWhen(report.created_at))}</td>
          <td>${escapeHtml(report.admin_note || report.description || '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No reports for this account.</p>'}
      ${pager(result.page, result.total, 'crm-reports-page')}
      <button class="ghost" data-action="user-reports" data-id="${escapeHtml(userId)}">Open full reports filter</button>
    </div>`;
  }

  async function renderNotesTab(userId) {
    let history = { rows: [], total: 0, page: 1 };
    const histRemote = await safeRpc('admin_moderation_history', {
      target_kind: 'user', target_id: userId, page: state.users.historyPage || 1, page_size: PAGE_SIZE,
    });
    if (histRemote.ok) history = pageResult(histRemote.data);
    const privateHtml = typeof userPrivatePanels === 'function' ? await userPrivatePanels(userId) : panelMessage('Internal notes require admin intelligence RPCs.');
    return `<div class="crm-section">
      ${privateHtml || panelMessage('No internal notes/tags available for this role or environment.')}
      <h3>Moderation history</h3>
      ${history.rows.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Administrator</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>
        ${history.rows.map((row) => `<tr>
          <td>${escapeHtml(formatVilnius(row.created_at))}</td>
          <td>${escapeHtml(row.action)}</td>
          <td>${linkButton('open-user', row.admin_id, row.admin_id)}</td>
          <td>${escapeHtml(row.previous_status || '—')}</td>
          <td>${escapeHtml(row.new_status || '—')}</td>
          <td>${escapeHtml(row.reason)}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No moderation history.</p>'}
      ${pager(history.page, history.total, 'user-history')}
    </div>`;
  }

  async function renderTabBody(tab, card, userId) {
    switch (tab) {
      case 'overview': return renderOverview(card, userId);
      case 'personal': return renderPersonal(card);
      case 'activity': return renderActivity(userId);
      case 'listings': return renderListingsTab(userId);
      case 'deals': return renderDealsTab(userId);
      case 'messages': return renderMessagesTab(userId);
      case 'payments': return renderPaymentsTab(userId);
      case 'connections': return renderConnectionsTab(userId);
      case 'security': return renderSecurityTab(userId);
      case 'reports': return renderReportsTab(userId);
      case 'notes': return renderNotesTab(userId);
      default: return panelMessage('Unknown tab.');
    }
  }

  window.renderCrmProfile = async function renderCrmProfile(root, userId) {
    ensureCrmState();
    root.innerHTML = `<div class="crm-shell"><p class="loading">Loading customer CRM…</p></div>`;
    try {
      const { card, source } = await loadCard(userId);
      const tab = state.users.crmTab || 'overview';
      const body = await renderTabBody(tab, card, userId);
      root.innerHTML = `<div class="crm-shell">
        <nav class="crm-breadcrumb muted">Admin / Users / <strong>${escapeHtml(displayName(card) || userId)}</strong></nav>
        ${profileHeader(card, source)}
        ${tabBar(tab)}
        <div class="crm-body">${body}</div>
      </div>`;
    } catch (error) {
      root.innerHTML = `${panelMessage(error.message || 'Customer CRM could not be loaded.', 'form-error')}
        <button class="ghost" data-action="crm-back">Back to users</button>`;
    }
  };

  window.renderCrmDirectory = async function renderCrmDirectory(root) {
    ensureCrmState();
    const filter = typeof ensureFilter === 'function' ? ensureFilter('users') : { city: 'all', sort: 'newest', accountStatus: '', accountType: '', signIn: false };
    const range = typeof sharedRange === 'function' ? sharedRange('users') : { created_from: null, created_to: null };
    let result;
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

    const active = result.rows.filter((row) => row.is_active !== false).length;
    const inactive = result.rows.length - active;

    root.innerHTML = `
      <div class="crm-directory">
        ${filter.identityNotice ? panelMessage(filter.identityNotice) : ''}
        <div class="stats">
          <div class="stat"><span>Matching users</span><b>${escapeHtml(result.total)}</b></div>
          <div class="stat"><span>Active on this page</span><b>${escapeHtml(active)}</b></div>
          <div class="stat"><span>Inactive on this page</span><b>${escapeHtml(inactive)}</b></div>
        </div>
        ${typeof filterBar === 'function' ? filterBar('users', {
          cityLabel: 'Profile city',
          sorts: [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['most_active', 'Most active'], ['most_deals', 'Most completed deals'], ['most_reports', 'Most reports received']],
          note: 'Click a row to open the full-screen customer CRM. Profile city is the city stored on the account.',
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
        ${result.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Type</th><th>Role</th><th>Status</th><th>Profile city</th><th>Registered</th><th></th></tr></thead><tbody>
          ${result.rows.map((profile) => `<tr data-action="open-crm-user" data-id="${escapeHtml(profile.id)}">
            <td>
              <div class="person">
                ${profile.avatar_url ? `<img class="avatar" src="${escapeHtml(profile.avatar_url)}" alt="">` : `<span class="avatar-fallback">${escapeHtml((displayName(profile) || '?').charAt(0).toUpperCase())}</span>`}
                <div>
                  <strong>${escapeHtml(displayName(profile))}</strong>
                  <div class="muted">${escapeHtml(profile.id)}</div>
                </div>
              </div>
            </td>
            <td>${escapeHtml(profile.account_type || '—')}</td>
            <td>${escapeHtml(profile.role || '—')}</td>
            <td>${badge(profile.is_active !== false)}</td>
            <td>${escapeHtml(profile.profile_city || profile.city || '—')}</td>
            <td>${escapeHtml(formatWhen(profile.created_at))}</td>
            <td><button class="ghost" data-action="open-crm-user" data-id="${escapeHtml(profile.id)}">Open CRM</button></td>
          </tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">No matching users.</p>'}
        ${pager(result.page, result.total, 'users-page')}
      </div>`;

    const search = $('user-search');
    if (search) {
      search.addEventListener('change', (event) => {
        state.users.query = event.target.value.trim();
        state.users.page = 1;
        renderSection();
      });
    }
    if (typeof bindFilterBar === 'function') bindFilterBar('users');
  };

  window.handleCrmClick = async function handleCrmClick(action, button) {
    if (action === 'open-crm-user' || action === 'select-user') {
      if (!button.dataset.id) return true;
      openCrmUser(button.dataset.id);
      return true;
    }
    if (action === 'crm-back') {
      closeCrmUser();
      return true;
    }
    if (action === 'crm-tab') {
      state.users.crmTab = button.dataset.tab || 'overview';
      renderSection();
      return true;
    }
    if (action === 'crm-load-messages') {
      state.users.messageDealId = button.dataset.id;
      state.users.messagesPage = 1;
      state.users.crmTab = 'messages';
      renderSection();
      return true;
    }
    if (action === 'crm-select-listing') {
      state.listings.selected = button.dataset.id;
      state.users.crmTab = 'listings';
      renderSection();
      return true;
    }
    if (action === 'crm-listings-page') {
      const page = Number(button.dataset.page);
      if (page < 1) return true;
      state.users.listingsPage = page;
      renderSection();
      return true;
    }
    if (action === 'crm-deals-page') {
      const page = Number(button.dataset.page);
      if (page < 1) return true;
      state.users.dealsPage = page;
      renderSection();
      return true;
    }
    if (action === 'crm-messages-page') {
      const page = Number(button.dataset.page);
      if (page < 1) return true;
      state.users.messagesPage = page;
      renderSection();
      return true;
    }
    if (action === 'crm-reports-page') {
      const page = Number(button.dataset.page);
      if (page < 1) return true;
      state.users.reportsPage = page;
      renderSection();
      return true;
    }
    return false;
  };
}());
