/**
 * Boot Admin after admin.js + admin-crm.js + admin-intel.js are loaded.
 */
(function () {
  function syncRoute() {
    if (typeof parseAdminRoute !== 'function' || typeof renderSection !== 'function') return;
    if (!state || !state.user) return;
    const route = parseAdminRoute();
    if (!roleAllows(route.section)) {
      setSection('dashboard');
      return;
    }
    if (route.section === 'users' && route.crmId && typeof openCrmUser === 'function') {
      if (state.users.selected !== route.crmId || state.section !== 'users') {
        openCrmUser(route.crmId);
      } else {
        renderSection();
      }
      return;
    }
    // Directory hash (#users) while a CRM selection is open → return to directory.
    // Do not re-enter setSection solely because selected is set on other sections
    // (that caused a hashchange loop when leaving CRM with selected still set).
    if (state.section !== route.section) {
      setSection(route.section);
      return;
    }
    if (route.section === 'users' && state.users.selected && !route.crmId) {
      setSection('users');
    }
  }

  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('popstate', syncRoute);

  if (typeof startAdmin === 'function') {
    startAdmin();
  }
}());
