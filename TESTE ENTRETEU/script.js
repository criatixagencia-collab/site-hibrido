const body = document.body;
const menuButton = document.querySelector(".menu-button");
const searchButton = document.querySelector(".search-button");
const searchPanel = document.querySelector(".search-panel");
const searchForm = document.querySelector(".search-form");
const searchInput = document.querySelector("#site-search");
const filterButtons = document.querySelectorAll("[data-filter]");
const newsItems = document.querySelectorAll(".news-item");
const emptyState = document.querySelector(".empty-state");
const loadMoreButton = document.querySelector(".load-more");
const newsletterForm = document.querySelector(".newsletter form");

function closePanels() {
  body.classList.remove("menu-open", "search-open");
  menuButton.setAttribute("aria-expanded", "false");
  searchPanel.hidden = true;
}

menuButton.addEventListener("click", () => {
  const opening = !body.classList.contains("menu-open");
  closePanels();
  if (opening) {
    body.classList.add("menu-open");
    menuButton.setAttribute("aria-expanded", "true");
  }
});

searchButton.addEventListener("click", () => {
  const opening = searchPanel.hidden;
  closePanels();
  if (opening) {
    body.classList.add("search-open");
    searchPanel.hidden = false;
    searchInput.focus();
  }
});

function applyFilter(filter, query = "") {
  let visibleCount = 0;
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  newsItems.forEach((item) => {
    const matchesCategory = filter === "todos" || item.dataset.category === filter;
    const matchesQuery = !normalizedQuery || item.textContent.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    const shouldShow = matchesCategory && matchesQuery;
    item.hidden = !shouldShow;
    if (shouldShow) visibleCount += 1;
  });

  emptyState.hidden = visibleCount > 0;
  loadMoreButton.hidden = filter !== "todos" || Boolean(normalizedQuery);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    const filter = button.dataset.filter;
    document.querySelectorAll(".filter-tabs button").forEach((item) => {
      item.classList.toggle("selected", item.dataset.filter === filter);
    });
    document.querySelectorAll(".nav-inner a").forEach((item) => {
      item.classList.toggle("active", item.dataset.filter === filter);
    });
    applyFilter(filter);
    closePanels();

    if (event.currentTarget.closest(".nav-inner") && filter !== "todos") {
      document.querySelector("#noticias").scrollIntoView({ behavior: "smooth" });
    }
  });
});

loadMoreButton.addEventListener("click", () => {
  document.querySelectorAll(".extra-story").forEach((item) => {
    item.hidden = false;
  });
  loadMoreButton.hidden = true;
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelectorAll(".filter-tabs button").forEach((item) => {
    item.classList.toggle("selected", item.dataset.filter === "todos");
  });
  applyFilter("todos", searchInput.value);
  closePanels();
  document.querySelector("#noticias").scrollIntoView({ behavior: "smooth" });
});

newsletterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = newsletterForm.querySelector("button");
  button.textContent = "Cadastro realizado";
  button.disabled = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanels();
});
