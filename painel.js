const SUPABASE_URL = "https://fbwlprwhczxjdsciotsi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
const TOKEN_KEY = "perfumes-panel-session";

const $ = (selector) => document.querySelector(selector);
const els = {
  loginView: $("#loginView"),
  panelView: $("#panelView"),
  loginForm: $("#loginForm"),
  loginEmail: $("#loginEmail"),
  loginPassword: $("#loginPassword"),
  loginMessage: $("#loginMessage"),
  actorRole: $("#actorRole"),
  logoutBtn: $("#logoutBtn"),
  statusDot: $("#statusDot"),
  statusText: $("#statusText"),
  statusDetail: $("#statusDetail"),
  outageKind: $("#outageKind"),
  outageReason: $("#outageReason"),
  publicMessage: $("#publicMessage"),
  restoreReason: $("#restoreReason"),
  disableSiteBtn: $("#disableSiteBtn"),
  enableSiteBtn: $("#enableSiteBtn"),
  permissionsCard: $("#permissionsCard"),
  sellerPermissions: $("#sellerPermissions"),
  refreshSellersBtn: $("#refreshSellersBtn"),
  confirmModal: $("#confirmModal"),
  confirmTitle: $("#confirmTitle"),
  confirmText: $("#confirmText"),
  confirmWordLabel: $("#confirmWordLabel"),
  confirmWordInput: $("#confirmWordInput"),
  cancelConfirmBtn: $("#cancelConfirmBtn"),
  confirmActionBtn: $("#confirmActionBtn"),
  toast: $("#toast")
};

let session = loadSession();
let actorRole = null;
let pendingAction = null;
let confirmWord = "CONFIRMAR";

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null"); }
  catch { return null; }
}
function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(TOKEN_KEY);
}
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2800);
}
function authHeaders() {
  if (!session?.access_token) throw new Error("Sessão ausente.");
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json"
  };
}
async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error_description || data?.msg || "Falha no login.");
  saveSession(data);
}
async function emergencyApi(payload) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/site-emergency`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) logout();
    throw new Error(data?.error || "Falha na operação.");
  }
  return data;
}
async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}
function showPanel() {
  els.loginView.hidden = true;
  els.panelView.hidden = false;
}
function showLogin() {
  els.panelView.hidden = true;
  els.loginView.hidden = false;
}
function logout() {
  saveSession(null);
  actorRole = null;
  showLogin();
}
function statusLabel(kind) {
  const labels = {
    stock_issue: "Problema de estoque",
    inventory_count: "Contagem de estoque",
    maintenance: "Manutenção / erro",
    no_seller: "Sem vendedor",
    operational_pause: "Pausa operacional",
    permanent_closure: "Encerramento definitivo"
  };
  return labels[kind] || "Indisponibilidade";
}
async function loadStatus() {
  const result = await emergencyApi({ action: "get_status" });
  actorRole = result.actor_role;
  els.actorRole.textContent = actorRole === "admin" ? "Administrador" : "Vendedor autorizado";
  els.permissionsCard.hidden = actorRole !== "admin";
  const status = result.data;

  els.statusDot.className = `status-dot ${status.is_online ? "online" : "offline"}`;
  els.statusText.textContent = status.is_online ? "Loja online" : "Loja fora do ar";
  els.statusDetail.textContent = status.is_online
    ? "A vitrine pública está disponível."
    : `${statusLabel(status.outage_kind)} · ${status.outage_reason || "Sem justificativa"}`;

  if (actorRole !== "admin") {
    const permanent = [...els.outageKind.options].find(o => o.value === "permanent_closure");
    if (permanent) permanent.disabled = true;
    if (els.outageKind.value === "permanent_closure") els.outageKind.value = "stock_issue";
  }
}
async function loadSellerPermissions() {
  if (actorRole !== "admin") return;
  const sellers = await rest("sellers?select=id,name,is_active,can_toggle_site_emergency&order=name.asc");
  if (!sellers.length) {
    els.sellerPermissions.innerHTML = '<p class="muted">Nenhum vendedor cadastrado.</p>';
    return;
  }
  els.sellerPermissions.innerHTML = sellers.map(seller => `
    <div class="seller-row">
      <div class="seller-meta">
        <strong>${escapeHtml(seller.name)}</strong>
        <span>${seller.is_active ? "Ativo" : "Inativo"}</span>
      </div>
      <label class="toggle">
        <input type="checkbox" data-seller-permission="${seller.id}" ${seller.can_toggle_site_emergency ? "checked" : ""}>
        Emergência
      </label>
    </div>
  `).join("");

  document.querySelectorAll("[data-seller-permission]").forEach(input => {
    input.addEventListener("change", async () => {
      input.disabled = true;
      try {
        await rest(`sellers?id=eq.${encodeURIComponent(input.dataset.sellerPermission)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ can_toggle_site_emergency: input.checked })
        });
        toast("Permissão atualizada.");
      } catch (error) {
        input.checked = !input.checked;
        toast("Não foi possível atualizar a permissão.");
      } finally {
        input.disabled = false;
      }
    });
  });
}
function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function askConfirmation({ title, text, word = "CONFIRMAR", action }) {
  pendingAction = action;
  confirmWord = word;
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmWordLabel.textContent = word;
  els.confirmWordInput.value = "";
  els.confirmActionBtn.disabled = true;
  els.confirmModal.hidden = false;
  setTimeout(() => els.confirmWordInput.focus(), 30);
}
function closeConfirmation() {
  els.confirmModal.hidden = true;
  pendingAction = null;
}
els.confirmWordInput.addEventListener("input", () => {
  els.confirmActionBtn.disabled = els.confirmWordInput.value.trim().toUpperCase() !== confirmWord;
});
els.cancelConfirmBtn.addEventListener("click", closeConfirmation);
els.confirmActionBtn.addEventListener("click", async () => {
  if (!pendingAction) return;
  els.confirmActionBtn.disabled = true;
  try {
    await pendingAction();
    closeConfirmation();
    await loadStatus();
    toast("Status da loja atualizado.");
  } catch (error) {
    toast(error.message || "Falha ao atualizar status.");
    els.confirmActionBtn.disabled = false;
  }
});

els.disableSiteBtn.addEventListener("click", () => {
  const kind = els.outageKind.value;
  const reason = els.outageReason.value.trim();
  if (reason.length < 3) {
    toast("Informe a justificativa da indisponibilidade.");
    return;
  }
  const permanent = kind === "permanent_closure";
  askConfirmation({
    title: permanent ? "Confirmar encerramento definitivo" : "Confirmar modo de emergência",
    text: permanent
      ? "Esta opção marca a loja como encerrada. Apenas administrador pode executar esta ação."
      : "A vitrine pública ficará indisponível imediatamente até ser reativada.",
    word: permanent ? "ENCERRAR" : "DESATIVAR",
    action: () => emergencyApi({
      action: "set_status",
      is_online: false,
      outage_kind: kind,
      outage_reason: reason,
      public_message: els.publicMessage.value.trim()
    })
  });
});

els.enableSiteBtn.addEventListener("click", () => {
  askConfirmation({
    title: "Reativar a loja",
    text: "A vitrine pública voltará a ficar disponível imediatamente.",
    word: "REATIVAR",
    action: () => emergencyApi({
      action: "set_status",
      is_online: true,
      outage_reason: els.restoreReason.value.trim()
    })
  });
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.loginMessage.textContent = "";
  try {
    await signIn(els.loginEmail.value.trim(), els.loginPassword.value);
    showPanel();
    await loadStatus();
    if (actorRole === "admin") await loadSellerPermissions();
  } catch (error) {
    els.loginMessage.textContent = error.message || "Não foi possível entrar.";
    saveSession(null);
  }
});
els.logoutBtn.addEventListener("click", logout);
els.refreshSellersBtn.addEventListener("click", () => loadSellerPermissions().catch(() => toast("Falha ao atualizar vendedores.")));

(async function boot() {
  if (!session?.access_token) {
    showLogin();
    return;
  }
  try {
    showPanel();
    await loadStatus();
    if (actorRole === "admin") await loadSellerPermissions();
  } catch {
    logout();
  }
})();