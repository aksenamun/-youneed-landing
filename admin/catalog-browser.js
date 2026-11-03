const CATALOG_LANGUAGES = [
  { id: "en", label: "English" },
  { id: "lt", label: "Lietuvių" },
  { id: "ru", label: "Русский" },
];

const catalogView = {
  language: "en",
  query: "",
  selectedId: null,
};

function catalogEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function catalogText(entry, language) {
  const labels = entry && entry.labels;
  return (labels && labels[language]) || (entry && entry.name) || "";
}

function catalogHaystack(entry) {
  return [entry.name].concat(CATALOG_LANGUAGES.map((language) => catalogText(entry, language.id))).join(" ").toLowerCase();
}

function catalogMatches(category, query) {
  if (!query) return { category: true, subcategories: category.subcategories };
  const categoryHit = catalogHaystack(category).includes(query);
  const subcategories = category.subcategories.filter((subcategory) => catalogHaystack(subcategory).includes(query));
  return {
    category: categoryHit || subcategories.length > 0,
    subcategories: categoryHit ? category.subcategories : subcategories,
  };
}

async function renderCategories(root) {
  const catalog = window.YOUNEED_CATALOG;
  const categories = catalog && Array.isArray(catalog.categories) ? catalog.categories : [];
  const subcategoryCount = categories.reduce((sum, category) => sum + category.subcategories.length, 0);
  const complete = categories.length === 24 && subcategoryCount === 255 && catalog && catalog.imageCount === 279;
  const query = catalogView.query.trim().toLowerCase();
  const visible = categories
    .map((category) => ({ category, match: catalogMatches(category, query) }))
    .filter((item) => item.match.category);
  const selected = categories.find((category) => category.id === catalogView.selectedId) || null;

  root.innerHTML = `
    <section class="notice">
      <p>This is the YouNeed app catalog: 24 categories and 255 subcategories, in the app’s order, with the existing ids. Labels and images come from the app source. This screen cannot add, delete, rename, or reorder them.</p>
    </section>
    ${complete ? "" : `<section class="notice"><p class="form-error">The published catalog is incomplete. Expected 24 categories, 255 subcategories, and 279 images.</p></section>`}
    <div class="catalog-stats">
      <div class="stat"><span>Categories</span><b>${categories.length}</b></div>
      <div class="stat"><span>Subcategories</span><b>${subcategoryCount}</b></div>
      <div class="stat"><span>Images</span><b>${catalogEscape(catalog && catalog.imageCount)}</b></div>
    </div>
    <div class="catalog-toolbar">
      <div>
        <label for="catalog-search">Search</label>
        <input id="catalog-search" type="search" value="${catalogEscape(catalogView.query)}" placeholder="Search categories and subcategories" autocomplete="off">
      </div>
      <div>
        <label for="catalog-language">Language</label>
        <select id="catalog-language">
          ${CATALOG_LANGUAGES.map((language) => `<option value="${language.id}" ${language.id === catalogView.language ? "selected" : ""}>${catalogEscape(language.label)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="catalog-list">
      ${visible.length ? visible.map(({ category, match }) => catalogCategory(category, match.subcategories, query)).join("") : `<p class="empty">No matching categories or subcategories.</p>`}
    </div>
    ${selected ? catalogDetail(selected) : ""}
  `;

  const search = document.getElementById("catalog-search");
  const language = document.getElementById("catalog-language");
  if (search) {
    search.addEventListener("input", () => {
      catalogView.query = search.value;
      const position = search.selectionStart;
      renderCategories(root);
      const next = document.getElementById("catalog-search");
      if (next) {
        next.focus();
        if (position != null) next.setSelectionRange(position, position);
      }
    });
  }
  if (language) {
    language.addEventListener("change", () => {
      catalogView.language = language.value;
      renderCategories(root);
    });
  }
  root.querySelectorAll("[data-catalog-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      catalogView.selectedId = Number(button.getAttribute("data-catalog-id"));
      renderCategories(root);
    });
  });
}

function catalogCategory(category, subcategories, query) {
  const language = catalogView.language;
  const open = query || category.id === catalogView.selectedId ? " open" : "";
  return `
    <details class="catalog-category"${open}>
      <summary>
        <img class="catalog-thumb" src="${catalogEscape(category.image)}" alt="" style="background:${catalogEscape(category.mark.background)}">
        <span class="catalog-copy">
          <strong>${catalogEscape(catalogText(category, language))}</strong>
          <span>Id ${catalogEscape(category.id)} · Order ${catalogEscape(category.order)} · ${category.subcategories.length} subcategories · Icon ${catalogEscape(category.mark.mark)}</span>
        </span>
        <button class="ghost" type="button" data-catalog-id="${catalogEscape(category.id)}">Details</button>
      </summary>
      <div class="catalog-subs">
        ${subcategories.map((subcategory) => `
          <div class="catalog-sub">
            <img src="${catalogEscape(subcategory.image)}" alt="" style="background:${catalogEscape(subcategory.mark.background)}">
            <span>
              <strong>${catalogEscape(catalogText(subcategory, language))}</strong>
              <span>Category ${catalogEscape(category.id)} · Order ${catalogEscape(subcategory.order)} · Icon ${catalogEscape(subcategory.mark.mark)}</span>
            </span>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function catalogDetail(category) {
  const rows = CATALOG_LANGUAGES.map((language) => `<div class="fact"><span>${catalogEscape(language.label)}</span><b>${catalogEscape(catalogText(category, language.id))}</b></div>`).join("");
  const subtitles = category.subcategories.map((subcategory) => `
    <tr>
      <td>${catalogEscape(subcategory.order)}</td>
      <td>${CATALOG_LANGUAGES.map((language) => catalogEscape(catalogText(subcategory, language.id))).join("<br>")}</td>
      <td>${catalogEscape(subcategory.mark.mark)}</td>
    </tr>
  `).join("");
  return `
    <section class="catalog-detail">
      <h2>${catalogEscape(catalogText(category, catalogView.language))}</h2>
      <img class="catalog-hero" src="${catalogEscape(category.image)}" alt="">
      <div class="facts">${rows}<div class="fact"><span>Id</span><b>${catalogEscape(category.id)}</b></div><div class="fact"><span>Order</span><b>${catalogEscape(category.order)}</b></div><div class="fact"><span>Icon</span><b>${catalogEscape(category.mark.mark)}</b></div></div>
      <div class="catalog-languages"></div>
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>English, Lithuanian, Russian</th><th>Icon</th></tr></thead><tbody>${subtitles}</tbody></table></div>
    </section>
  `;
}
