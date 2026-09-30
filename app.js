const SUPABASE_URL = "https://fbwlprwhczxjdsciotsi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";

const PRODUCT_IMAGES = {
  "nero-absolu": "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=84",
  "eclat-rose": "https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=1200&q=84",
  "fleur-dambre": "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1200&q=84",
  "solaris-elixir": "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?auto=format&fit=crop&w=1200&q=84",
  "velora-noir": "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=84",
  "vertige": "https://images.unsplash.com/photo-1619994403073-2cec844b8e63?auto=format&fit=crop&w=1200&q=84"
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=84";

const state = {
  products: [],
  reviews: [],
  sellers: [],
  selectedSellerId: null,
  filter: "todos",
  search: "",
  bag: loadBag(),
  selectedProduct: null,
  payment: "pix"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  productGrid: $("#productGrid"),
  catalogStatus: $("#catalogStatus"),
  catalogSearch: $("#catalogSearch"),
  catalogSearch: $("#catalogSearch"),
  productOverlay: $("#productOverlay"),
  productModalContent: $("#productModalContent"),
  bagBtn: $("#bagBtn"),
  bagCount: $("#bagCount"),
  bagDrawer: $("#bagDrawer"),
  closeBag: $("#closeBag"),
  drawerMask: $("#drawerMask"),
  bagItems: $("#bagItems"),
  bagTotal: $("#bagTotal"),
  checkoutBtn: $("#checkoutBtn"),
  checkoutOverlay: $("#checkoutOverlay"),
  checkoutSummary: $("#checkoutSummary"),
  checkoutForm: $("#checkoutForm"),
  paymentDemoBox: $("#paymentDemoBox"),
  sellerPicker: $("#sellerPicker"),
  toast: $("#toast"),
  siteUnavailable: $("#siteUnavailable"),
  siteUnavailableTitle: $("#siteUnavailableTitle"),
  siteUnavailableMessage: $("#siteUnavailableMessage")
};

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function brl(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(cents || 0) / 100);
}

function imageFor(product) {
  return PRODUCT_IMAGES[product.slug] || FALLBACK_IMAGE;
}

function loadBag() {
  try {
    const raw = localStorage.getItem("perfumes-demo-bag");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBag() {
  localStorage.setItem("perfumes-demo-bag", JSON.stringify(state.bag));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

async function supabaseGet(table, query = "") {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body}`);
  }

  return response.json();
}


async function loadSiteStatus() {
  try {
    const rows = await supabaseGet(
      "site_status",
      "select=is_online,outage_kind,public_message,changed_at&id=eq.true&limit=1"
    );
    const status = rows[0];
    if (!status || status.is_online) {
      if (els.siteUnavailable) els.siteUnavailable.hidden = true;
      return;
    }

    const permanent = status.outage_kind === "permanent_closure";
    if (els.siteUnavailableTitle) {
      els.siteUnavailableTitle.textContent = permanent
        ? "Loja encerrada"
        : "Site temporariamente indisponível";
    }
    if (els.siteUnavailableMessage) {
      els.siteUnavailableMessage.textContent =
        status.public_message ||
        (status.outage_kind === "inventory_count"
          ? "Estamos realizando uma conferência de estoque. Voltamos em breve."
          : "Estamos realizando um ajuste operacional. Voltamos em breve.");
    }
    if (els.siteUnavailable) els.siteUnavailable.hidden = false;
  } catch (error) {
    console.error("Falha ao consultar o status da loja", error);
  }
}

async function loadSellers() {
  try {
    state.sellers = await supabaseGet(
      "seller_checkout_options",
      "select=seller_id,display_name,avatar_url&is_active=eq.true&order=display_name.asc"
    );
    renderSellerPicker();
  } catch (error) {
    console.error(error);
    if (els.sellerPicker) {
      els.sellerPicker.innerHTML = '<p class="seller-picker-empty">Não foi possível carregar os vendedores agora.</p>';
    }
  }
}

function renderSellerPicker() {
  if (!els.sellerPicker) return;

  if (!state.sellers.length) {
    els.sellerPicker.innerHTML = '<p class="seller-picker-empty">Nenhum vendedor ativo cadastrado no momento.</p>';
    return;
  }

  els.sellerPicker.innerHTML = state.sellers.map(seller => {
    const initial = esc((seller.display_name || "?").trim().charAt(0).toUpperCase());
    const avatar = seller.avatar_url
      ? '<img src="' + esc(seller.avatar_url) + '" alt="">'
      : initial;

    return `
      <button class="seller-card ${state.selectedSellerId === seller.seller_id ? "is-active" : ""}" type="button" data-seller-id="${esc(seller.seller_id)}">
        <span class="seller-avatar">${avatar}</span>
        <span class="seller-card-copy">
          <strong>${esc(seller.display_name)}</strong>
          <span>Selecionar vendedor</span>
        </span>
      </button>
    `;
  }).join("");

  $("[data-seller-id]", els.sellerPicker).forEach(button => {
    button.addEventListener("click", () => {
      state.selectedSellerId = button.dataset.sellerId;
      renderSellerPicker();
    });
  });
}

async function loadCatalog() {
  els.catalogStatus.textContent = "Carregando catálogo...";

  try {
    const [products, reviews] = await Promise.all([
      supabaseGet(
        "products",
        "select=*&is_active=eq.true&order=is_featured.desc,created_at.asc"
      ),
      supabaseGet(
        "reviews",
        "select=id,product_id,customer_name,rating,comment,is_verified_purchase,is_approved,created_at&is_approved=eq.true&order=created_at.asc"
      )
    ]);

    state.products = products;
    state.reviews = reviews;
    els.catalogStatus.textContent = products.length
      ? `${products.length} fragrâncias na curadoria`
      : "Nenhuma fragrância disponível.";
    renderProducts();
    renderBag();
  } catch (error) {
    console.error(error);
    els.catalogStatus.textContent = "Não foi possível carregar o catálogo agora.";
    els.productGrid.innerHTML = `
      <div class="empty-bag">
        O catálogo ficou temporariamente indisponível. Atualize a página em alguns instantes.
      </div>
    `;
  }
}

function renderProducts() {
  const byCategory = state.filter === "todos" ? state.products : state.products.filter(product => product.category === state.filter);
  const query = state.search.trim().toLowerCase();
  const products = query ? byCategory.filter(product => [product.name, product.brand, product.category, String(product.volume_ml)].filter(Boolean).join(" ").toLowerCase().includes(query)) : byCategory;

  els.productGrid.innerHTML = products.map(product => {
    const current = product.sale_price_cents ?? product.price_cents;
    const badge = product.is_best_seller
      ? "Mais vendido"
      : product.is_featured
        ? "Destaque"
        : product.category;

    return `
      <article class="product-card" data-product-id="${esc(product.id)}" tabindex="0" role="button" aria-label="Ver ${esc(product.name)}">
        <div class="product-media">
          <span class="product-badge">${esc(badge)}</span>
          <img src="${esc(imageFor(product))}" alt="Apresentação visual de ${esc(product.name)}" loading="lazy">
        </div>
        <div class="product-info">
          <div class="product-meta">
            <span>${esc(product.category)}</span>
            <span>${esc(product.volume_ml)} mL</span>
          </div>
          <h3>${esc(product.name)}</h3>
          <div class="product-bottom">
            <span class="price">
              ${product.sale_price_cents ? `<del>${brl(product.price_cents)}</del>` : ""}
              ${brl(current)}
            </span>
            <span class="view-link">Descobrir →</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  $$(".product-card", els.productGrid).forEach(card => {
    const open = () => openProduct(card.dataset.productId);
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function setFilter(filter) {
  state.filter = filter;
  $(".filter").forEach(button => {
    button.classList.toggle("is-active", button.dataset.filter === filter);
  });
  renderProducts();
}

function reviewsFor(productId) {
  return state.reviews.filter(review => review.product_id === productId);
}

function openProduct(productId) {
  const product = state.products.find(item => item.id === productId);
  if (!product) return;

  state.selectedProduct = product;
  const reviews = reviewsFor(product.id);
  const price = product.sale_price_cents ?? product.price_cents;

  const notes = [
    ["Notas de topo", product.top_notes],
    ["Notas de coração", product.heart_notes],
    ["Notas de fundo", product.base_notes]
  ];

  els.productModalContent.innerHTML = `
    <div class="product-detail">
      <div class="detail-media">
        <img src="${esc(imageFor(product))}" alt="Apresentação de ${esc(product.name)}">
      </div>
      <div class="detail-copy">
        <p class="eyebrow">${esc(product.brand || "[NOME DA MARCA]")} · ${esc(product.category)}</p>
        <h2 id="modalTitle">${esc(product.name)}</h2>
        <p class="detail-price">${brl(price)} · ${esc(product.volume_ml)} mL</p>
        <p class="detail-desc">${esc(product.description || product.short_description || "")}</p>
        <p class="detail-stock">${product.stock > 0 ? `${esc(product.stock)} unidade(s) disponíveis` : "Indisponível no momento"}</p>

        <div class="notes">
          ${notes.map(([title, values]) => `
            <div class="note">
              <strong>${title}</strong>
              <span>${esc((values || []).join(" · ") || "—")}</span>
            </div>
          `).join("")}
        </div>

        <div class="composition">
          <strong>Composição</strong>
          <p>${esc(product.composition || "Informação técnica a cadastrar.")}</p>
        </div>

        <div class="review-block">
          <h3>Avaliações demonstrativas</h3>
          ${reviews.length
            ? reviews.map(review => `
              <div class="review">
                <div class="review-head">
                  <strong>${esc(review.customer_name)}</strong>
                  <span class="stars">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</span>
                </div>
                ${review.is_verified_purchase ? '<span class="verified">Compra demonstrativa verificada</span>' : ""}
                <p>${esc(review.comment)}</p>
              </div>
            `).join("")
            : '<p class="detail-desc">Ainda não há avaliações para esta fragrância.</p>'
          }
        </div>

        <div class="detail-actions">
          <button class="btn btn-gold" type="button" id="addSelectedToBag" ${product.stock < 1 ? "disabled" : ""}>
            Adicionar à sacola
          </button>
          <button class="btn btn-ghost" type="button" id="buySelectedNow" ${product.stock < 1 ? "disabled" : ""}>
            Comprar agora
          </button>
        </div>
      </div>
    </div>
  `;

  els.productOverlay.hidden = false;
  syncScrollLock();

  $("#addSelectedToBag")?.addEventListener("click", () => {
    addToBag(product);
    closeProduct();
  });

  $("#buySelectedNow")?.addEventListener("click", () => {
    addToBag(product);
    closeProduct();
    openBag();
  });
}

function closeProduct() {
  els.productOverlay.hidden = true;
  state.selectedProduct = null;
  syncScrollLock();
}

function addToBag(product) {
  const existing = state.bag.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.bag.push({
      id: product.id,
      name: product.name,
      slug: product.slug,
      volume_ml: product.volume_ml,
      unit_price_cents: product.sale_price_cents ?? product.price_cents,
      quantity: 1
    });
  }

  saveBag();
  renderBag();
  toast(`${product.name} adicionado à sacola`);
}

function removeFromBag(productId) {
  state.bag = state.bag.filter(item => item.id !== productId);
  saveBag();
  renderBag();
}

function bagTotal() {
  return state.bag.reduce(
    (sum, item) => sum + Number(item.unit_price_cents) * Number(item.quantity),
    0
  );
}

function renderBag() {
  const totalQuantity = state.bag.reduce((sum, item) => sum + Number(item.quantity), 0);
  els.bagCount.textContent = totalQuantity;
  els.bagTotal.textContent = brl(bagTotal());

  if (!state.bag.length) {
    els.bagItems.innerHTML = '<p class="empty-bag">Sua sacola ainda está vazia. Escolha uma fragrância para começar.</p>';
    els.checkoutBtn.disabled = true;
    return;
  }

  els.checkoutBtn.disabled = false;
  els.bagItems.innerHTML = state.bag.map(item => `
    <div class="bag-item">
      <img src="${esc(PRODUCT_IMAGES[item.slug] || FALLBACK_IMAGE)}" alt="">
      <div>
        <h4>${esc(item.name)}</h4>
        <p>${esc(item.volume_ml)} mL · qtd. ${esc(item.quantity)} · ${brl(item.unit_price_cents * item.quantity)}</p>
      </div>
      <button type="button" data-remove="${esc(item.id)}" aria-label="Remover ${esc(item.name)}">×</button>
    </div>
  `).join("");

  $$("[data-remove]", els.bagItems).forEach(button => {
    button.addEventListener("click", () => removeFromBag(button.dataset.remove));
  });
}

function openBag() {
  els.bagDrawer.classList.add("is-open");
  els.bagDrawer.setAttribute("aria-hidden", "false");
  els.drawerMask.hidden = false;
  syncScrollLock();
}

function closeBag() {
  els.bagDrawer.classList.remove("is-open");
  els.bagDrawer.setAttribute("aria-hidden", "true");
  els.drawerMask.hidden = true;
  syncScrollLock();
}

function openCheckout() {
  if (!state.bag.length) {
    toast("Sua sacola está vazia.");
    return;
  }

  closeBag();
  els.checkoutSummary.innerHTML = `
    ${state.bag.map(item => `
      <div>${esc(item.quantity)}× ${esc(item.name)} — ${brl(item.unit_price_cents * item.quantity)}</div>
    `).join("")}
    <strong>Total: ${brl(bagTotal())}</strong>
  `;

  renderSellerPicker();
  els.checkoutOverlay.hidden = false;
  syncScrollLock();
}

function closeCheckout() {
  els.checkoutOverlay.hidden = true;
  syncScrollLock();
}

function syncScrollLock() {
  const locked =
    !els.productOverlay.hidden ||
    !els.checkoutOverlay.hidden ||
    els.bagDrawer.classList.contains("is-open");
  document.body.classList.toggle("no-scroll", locked);
}

function setPayment(method) {
  state.payment = method;
  $$(".payment-tab").forEach(button => {
    button.classList.toggle("is-active", button.dataset.payment === method);
  });

  els.paymentDemoBox.innerHTML = method === "pix"
    ? "<strong>PIX demonstrativo</strong><p>Nenhuma cobrança real será feita nesta versão.</p>"
    : "<strong>Cartão demonstrativo</strong><p>Nenhum dado de cartão é solicitado ou processado neste protótipo.</p>";
}

els.catalogSearch?.addEventListener("input", event => { state.search = event.target.value; renderProducts(); });

$(".filter").forEach(button => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

$$("[data-jump-filter]").forEach(button => {
  button.addEventListener("click", () => {
    setFilter(button.dataset.jumpFilter);
    $("#catalogo").scrollIntoView({ behavior: "smooth" });
  });
});

$("[data-close-product]")?.addEventListener("click", closeProduct);
els.productOverlay.addEventListener("click", event => {
  if (event.target === els.productOverlay) closeProduct();
});

els.bagBtn.addEventListener("click", openBag);
els.closeBag.addEventListener("click", closeBag);
els.drawerMask.addEventListener("click", closeBag);
els.checkoutBtn.addEventListener("click", openCheckout);

$("[data-close-checkout]")?.addEventListener("click", closeCheckout);
els.checkoutOverlay.addEventListener("click", event => {
  if (event.target === els.checkoutOverlay) closeCheckout();
});

$$(".payment-tab").forEach(button => {
  button.addEventListener("click", () => setPayment(button.dataset.payment));
});

els.checkoutForm.addEventListener("submit", event => {
  event.preventDefault();

  const data = new FormData(event.currentTarget);
  const customer = String(data.get("name") || "").trim();

  if (!state.selectedSellerId) {
    toast("Selecione o vendedor que te atendeu.");
    return;
  }

  const selectedSeller = state.sellers.find(seller => seller.seller_id === state.selectedSellerId);
  toast(`Pedido demonstrativo criado para ${customer || "cliente"} · vendedor: ${selectedSeller?.display_name || "selecionado"}`);
  state.bag = [];
  saveBag();
  renderBag();
  closeCheckout();
  event.currentTarget.reset();
  state.selectedSellerId = null;
  renderSellerPicker();
  setPayment("pix");
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!els.checkoutOverlay.hidden) closeCheckout();
  else if (!els.productOverlay.hidden) closeProduct();
  else if (els.bagDrawer.classList.contains("is-open")) closeBag();
});

loadSiteStatus();
loadCatalog();
loadSellers();
