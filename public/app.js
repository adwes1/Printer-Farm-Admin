const state = {
  data: {
    version: "0.0.17a",
    materials: [],
    storageLocations: [],
    printers: [],
    users: []
  },
  view: "overview",
  role: "user",
  currentUser: null
};

const viewTitles = {
  overview: "Übersicht",
  materials: "Materialverwaltung",
  storage: "Lagerplätze",
  settings: "Einstellungen"
};

const elements = {
  loginScreen: document.querySelector("#login-screen"),
  appShell: document.querySelector("#app-shell"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  appVersion: document.querySelector("#app-version"),
  toast: document.querySelector("#toast"),
  permissionBanner: document.querySelector("#permission-banner"),
  materialTypes: document.querySelector("#material-types"),
  printerStatusSummary: document.querySelector("#printer-status-summary"),
  overviewMaterials: document.querySelector("#overview-materials"),
  printerList: document.querySelector("#printer-list"),
  materialLocation: document.querySelector("#material-location"),
  materialEditLocation: document.querySelector("#material-edit-location"),
  materialCount: document.querySelector("#material-count"),
  materialCards: document.querySelector("#material-cards"),
  quantityTitle: document.querySelector("#quantity-title"),
  quantityGrams: document.querySelector("#quantity-grams"),
  storageSummary: document.querySelector("#storage-summary"),
  storageCards: document.querySelector("#storage-cards"),
  userSummary: document.querySelector("#user-summary"),
  userList: document.querySelector("#user-list")
};

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (modal) {
    modal.showModal();
  }
}

function closeModalFromElement(element) {
  const modal = element.closest("dialog");
  if (modal) {
    modal.close();
  }
}

function formatGrams(value) {
  const grams = Number(value || 0);
  if (grams >= 1000) {
    return `${(grams / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} kg`;
  }
  return `${grams.toLocaleString("de-DE")} g`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function storageLabel(item) {
  if (!item) {
    return "Kein Lagerplatz";
  }
  return `${item.room} / ${item.shelf} / ${item.box}`;
}

function statusLabel(status) {
  return {
    printing: "Druckt",
    idle: "Bereit",
    offline: "Offline",
    maintenance: "Wartung"
  }[status] || status;
}

function materialManufacturer(material) {
  return material.manufacturer || material.name;
}

function materialLabel(material) {
  return material.type;
}

function materialById(id) {
  return state.data.materials.find((material) => String(material.id) === String(id));
}

function storageOptions(selectedId = "") {
  return [
    `<option value=""${selectedId ? "" : " selected"}>Ohne Lagerplatz</option>`,
    ...state.data.storageLocations.map((location) => {
      const selected = String(location.id) === String(selectedId) ? " selected" : "";
      return `<option value="${location.id}"${selected}>${escapeHtml(storageLabel(location))}</option>`;
    })
  ].join("");
}

function showToast(message, tone = "ok") {
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add("visible");
  window.setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function showLogin() {
  state.currentUser = null;
  state.role = "user";
  elements.appShell.hidden = true;
  elements.loginScreen.hidden = false;
  elements.loginForm.reset();
}

function showApp(user) {
  state.currentUser = user;
  state.role = user?.role || "user";
  elements.loginScreen.hidden = true;
  elements.appShell.hidden = false;
}

function setView(view) {
  if (view === "settings" && state.role !== "admin") {
    showToast("Einstellungen sind nur für Admins freigegeben.", "warn");
    view = "overview";
  }

  state.view = view;
  document.querySelectorAll(".nav-tab[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}-view`);
  });
}

function applyPermissions() {
  const isAdmin = state.role === "admin";
  document.body.classList.toggle("is-user", !isAdmin);
  elements.permissionBanner.hidden = isAdmin;

  document.querySelector('[data-view="settings"]').disabled = !isAdmin;
  if (!isAdmin && state.view === "settings") {
    setView("overview");
  }
}

function renderOverview() {
  const materialTypes = new Set(state.data.materials.map((material) => material.type));

  elements.materialTypes.textContent = `${materialTypes.size} Materialtyp(en)`;

  elements.overviewMaterials.innerHTML = state.data.materials
    .map((material) => `
      <tr>
        <td>
          <strong>${escapeHtml(materialLabel(material))}</strong>
        </td>
        <td>
          ${escapeHtml(materialManufacturer(material))}
        </td>
        <td>
          <span class="color-chip" style="--chip-color: ${escapeHtml(material.colorHex)}"></span>
          ${escapeHtml(material.colorName)}
        </td>
        <td>${formatGrams(material.quantityGrams)}</td>
        <td>${escapeHtml(storageLabel(material))}</td>
      </tr>
    `)
    .join("");

  const summary = state.data.printers.reduce((counts, printer) => {
    counts[printer.status] = (counts[printer.status] || 0) + 1;
    return counts;
  }, {});
  elements.printerStatusSummary.textContent = Object.entries(summary)
    .map(([status, count]) => `${count} ${statusLabel(status)}`)
    .join(" · ");

  elements.printerList.innerHTML = state.data.printers
    .map((printer) => `
      <article class="printer-row">
        <span class="status-dot ${printer.status}"></span>
        <div>
          <strong>${escapeHtml(printer.name)}</strong>
          <small>${escapeHtml(printer.location || "Ohne Standort")}</small>
        </div>
        <span>${escapeHtml(statusLabel(printer.status))}</span>
      </article>
    `)
    .join("");
}

function renderMaterials() {
  elements.materialLocation.innerHTML = storageOptions();
  elements.materialEditLocation.innerHTML = storageOptions();

  elements.materialCount.textContent = `${state.data.materials.length} Eintrag/Einträge`;
  elements.materialCards.innerHTML = state.data.materials
    .map((material) => `
      <tr>
        <td>
          <strong>${escapeHtml(materialLabel(material))}</strong>
        </td>
        <td>${escapeHtml(materialManufacturer(material))}</td>
        <td>
          <span class="color-chip" style="--chip-color: ${escapeHtml(material.colorHex)}"></span>
          ${escapeHtml(material.colorName)}
        </td>
        <td>
          <div class="quantity-control">
            <button class="compact-button quantity-button" type="button" data-quantity-mode="minus" data-quantity-material="${material.id}" aria-label="Bestand verringern">-</button>
            <strong>${formatGrams(material.quantityGrams)}</strong>
            <button class="compact-button quantity-button" type="button" data-quantity-mode="plus" data-quantity-material="${material.id}" aria-label="Bestand erhöhen">+</button>
          </div>
        </td>
        <td>${escapeHtml(storageLabel(material))}</td>
        <td>
          <div class="row-actions">
            <button class="secondary-button compact-button" type="button" data-material-edit="${material.id}">Bearbeiten</button>
            <button class="danger-button compact-button" type="button" data-material-delete="${material.id}">Löschen</button>
          </div>
        </td>
      </tr>
    `)
    .join("");
}

function openEditMaterialModal(id) {
  const material = materialById(id);
  if (!material) {
    showToast("Material wurde nicht gefunden.", "error");
    return;
  }

  const form = document.querySelector("#material-edit-form");
  form.elements.id.value = material.id;
  form.elements.type.value = material.type;
  form.elements.colorName.value = material.colorName;
  form.elements.manufacturer.value = materialManufacturer(material);
  form.elements.colorHex.value = material.colorHex;
  form.elements.quantityGrams.value = material.quantityGrams;
  elements.materialEditLocation.innerHTML = storageOptions(material.storageLocationId || "");
  openModal("material-edit-modal");
}

function openQuantityModal(id, mode) {
  const material = materialById(id);
  if (!material) {
    showToast("Material wurde nicht gefunden.", "error");
    return;
  }

  const form = document.querySelector("#quantity-form");
  form.elements.id.value = material.id;
  form.elements.mode.value = mode;
  form.elements.grams.value = "";
  elements.quantityTitle.textContent = mode === "plus" ? "Bestand erhöhen" : "Bestand verringern";
  openModal("quantity-modal");
  window.setTimeout(() => elements.quantityGrams.focus(), 0);
}

async function deleteMaterial(id) {
  const material = state.data.materials.find((item) => String(item.id) === String(id));
  const label = material ? materialLabel(material) : "dieses Material";

  if (!window.confirm(`${label} wirklich löschen?`)) {
    return;
  }

  const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Material konnte nicht gelöscht werden.");
  }

  state.data = body;
  render();
  showToast("Material wurde gelöscht.");
}

async function updateMaterial(form) {
  const payload = Object.fromEntries(new FormData(form));
  const id = payload.id;
  delete payload.id;

  const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Material konnte nicht gespeichert werden.");
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast("Material wurde aktualisiert.");
}

async function adjustQuantity(form) {
  const payload = Object.fromEntries(new FormData(form));
  const grams = Number.parseInt(payload.grams, 10);

  if (!Number.isInteger(grams) || grams < 1) {
    throw new Error("Bitte einen Grammwert größer 0 eingeben.");
  }

  const deltaGrams = payload.mode === "minus" ? -grams : grams;
  const response = await fetch(`/api/materials/${encodeURIComponent(payload.id)}/quantity`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deltaGrams })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Bestand konnte nicht geändert werden.");
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast("Bestand wurde aktualisiert.");
}

function renderStorage() {
  elements.storageSummary.textContent = `${state.data.storageLocations.length} Lagerplatz/Lagerplätze`;
  elements.storageCards.innerHTML = state.data.storageLocations
    .map((location) => {
      const count = state.data.materials.filter((material) => material.storageLocationId === location.id).length;
      return `
        <tr>
          <td><strong>${escapeHtml(location.room)}</strong></td>
          <td>${escapeHtml(location.shelf)}</td>
          <td>${escapeHtml(location.box)}</td>
          <td>${escapeHtml(location.note || "-")}</td>
          <td>${count}</td>
          <td>
            <div class="row-actions">
              <button class="secondary-button compact-button" type="button" data-storage-edit="${location.id}">Bearbeiten</button>
              <button class="danger-button compact-button" type="button" data-storage-delete="${location.id}">Löschen</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function storageById(id) {
  return state.data.storageLocations.find((location) => String(location.id) === String(id));
}

function openEditStorageModal(id) {
  const location = storageById(id);
  if (!location) {
    showToast("Lagerplatz wurde nicht gefunden.", "error");
    return;
  }

  const form = document.querySelector("#storage-edit-form");
  form.elements.id.value = location.id;
  form.elements.room.value = location.room;
  form.elements.shelf.value = location.shelf;
  form.elements.box.value = location.box;
  form.elements.note.value = location.note || "";
  openModal("storage-edit-modal");
}

async function updateStorageLocation(form) {
  const payload = Object.fromEntries(new FormData(form));
  const id = payload.id;
  delete payload.id;

  const response = await fetch(`/api/storage-locations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Lagerplatz konnte nicht gespeichert werden.");
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast("Lagerplatz wurde aktualisiert.");
}

async function deleteStorageLocation(id) {
  const location = state.data.storageLocations.find((item) => String(item.id) === String(id));
  const label = location ? storageLabel(location) : "diesen Lagerplatz";
  const materialCount = state.data.materials.filter((material) => String(material.storageLocationId) === String(id)).length;
  const note = materialCount > 0
    ? ` ${materialCount} Materialeintrag/Materialeinträge werden danach ohne Lagerplatz geführt.`
    : "";

  if (!window.confirm(`${label} wirklich löschen?${note}`)) {
    return;
  }

  const response = await fetch(`/api/storage-locations/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Lagerplatz konnte nicht gelöscht werden.");
  }

  state.data = body;
  render();
  showToast("Lagerplatz wurde gelöscht.");
}

function renderUsers() {
  elements.userSummary.textContent = `${state.data.users.length} User`;
  elements.userList.innerHTML = state.data.users
    .map((user) => `
      <tr>
        <td><strong>${escapeHtml(user.name)}</strong></td>
        <td>${escapeHtml(user.email)}</td>
        <td><span class="role-pill ${user.role}">${user.role === "admin" ? "Admin" : "User"}</span></td>
        <td>
          <div class="row-actions">
            <button class="secondary-button compact-button" type="button" data-user-edit="${user.id}">Bearbeiten</button>
            <button class="danger-button compact-button" type="button" data-user-delete="${user.id}">Löschen</button>
          </div>
        </td>
      </tr>
    `)
    .join("");
}

function userById(id) {
  return state.data.users.find((user) => String(user.id) === String(id));
}

function openEditUserModal(id) {
  const user = userById(id);
  if (!user) {
    showToast("User wurde nicht gefunden.", "error");
    return;
  }

  const form = document.querySelector("#user-edit-form");
  form.elements.id.value = user.id;
  form.elements.name.value = user.name;
  form.elements.email.value = user.email;
  form.elements.role.value = user.role;
  form.elements.password.value = "";
  openModal("user-edit-modal");
}

async function updateUser(form) {
  const payload = Object.fromEntries(new FormData(form));
  const id = payload.id;
  delete payload.id;

  const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "User konnte nicht gespeichert werden.");
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast("User wurde aktualisiert.");
}

async function deleteUser(id) {
  const user = userById(id);
  const label = user ? `${user.name} (${user.email})` : "diesen User";

  if (!window.confirm(`${label} wirklich löschen?`)) {
    return;
  }

  if (!window.confirm("Diese Aktion kann nicht rückgängig gemacht werden. User endgültig löschen?")) {
    return;
  }

  const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "User konnte nicht gelöscht werden.");
  }

  state.data = body;
  render();
  showToast("User wurde gelöscht.");
}

function render() {
  elements.appVersion.textContent = `v${state.data.version}`;
  renderOverview();
  renderMaterials();
  renderStorage();
  renderUsers();
  applyPermissions();
}

async function loadData() {
  try {
    const response = await fetch("/api/app-data");
    if (response.status === 401) {
      showLogin();
      showToast("Bitte erneut anmelden.", "warn");
      return;
    }
    if (!response.ok) {
      throw new Error("App-Daten konnten nicht geladen werden.");
    }
    state.data = await response.json();
    if (state.data.currentUser) {
      showApp(state.data.currentUser);
    }
    render();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function checkSession() {
  try {
    const response = await fetch("/api/session");
    const body = await response.json();
    if (!response.ok || !body.user) {
      showLogin();
      return;
    }

    showApp(body.user);
    await loadData();
  } catch (error) {
    showLogin();
    showToast("Sitzung konnte nicht geprüft werden.", "error");
  }
}

async function loginUser(form) {
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Anmeldung fehlgeschlagen.");
  }

  showApp(body.user);
  setView("overview");
  await loadData();
  showToast("Angemeldet.");
}

async function logoutUser() {
  if (!window.confirm("Wirklich abmelden?")) {
    return;
  }

  const response = await fetch("/api/logout", {
    method: "POST"
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "Abmelden fehlgeschlagen.");
  }

  showLogin();
  showToast("Abgemeldet.");
}

async function submitForm(form, endpoint, successMessage) {
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Speichern fehlgeschlagen.");
  }

  state.data = body;
  form.reset();
  closeModalFromElement(form);
  render();
  showToast(successMessage);
}

document.querySelectorAll(".nav-tab[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-modal-open]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.modalOpen));
});

document.querySelectorAll("[data-modal-close]").forEach((button) => {
  button.addEventListener("click", () => closeModalFromElement(button));
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loginUser(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await logoutUser();
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-material-edit]");
  if (editButton) {
    openEditMaterialModal(editButton.dataset.materialEdit);
    return;
  }

  const quantityButton = event.target.closest("[data-quantity-material]");
  if (quantityButton) {
    openQuantityModal(quantityButton.dataset.quantityMaterial, quantityButton.dataset.quantityMode);
    return;
  }

  const deleteButton = event.target.closest("[data-material-delete]");
  if (!deleteButton) {
    return;
  }

  try {
    await deleteMaterial(deleteButton.dataset.materialDelete);
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-storage-edit]");
  if (editButton) {
    openEditStorageModal(editButton.dataset.storageEdit);
    return;
  }

  const deleteButton = event.target.closest("[data-storage-delete]");
  if (!deleteButton) {
    return;
  }

  try {
    await deleteStorageLocation(deleteButton.dataset.storageDelete);
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-user-edit]");
  if (editButton) {
    openEditUserModal(editButton.dataset.userEdit);
    return;
  }

  const deleteButton = event.target.closest("[data-user-delete]");
  if (!deleteButton) {
    return;
  }

  try {
    await deleteUser(deleteButton.dataset.userDelete);
  } catch (error) {
    showToast(error.message, "error");
  }
});

if (elements.roleSelect) {
  elements.roleSelect.addEventListener("change", () => {
    state.role = elements.roleSelect.value;
    applyPermissions();
  });
}

document.querySelector("#material-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitForm(event.currentTarget, "/api/materials", "Material wurde gespeichert.");
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#material-edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await updateMaterial(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#quantity-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await adjustQuantity(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#storage-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitForm(event.currentTarget, "/api/storage-locations", "Lagerplatz wurde gespeichert.");
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#storage-edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await updateStorageLocation(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitForm(event.currentTarget, "/api/users", "User wurde gespeichert.");
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#user-edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await updateUser(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

checkSession();
