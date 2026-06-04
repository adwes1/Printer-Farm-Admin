const state = {
  data: {
    version: "0.0.25a",
    materials: [],
    storageLocations: [],
    printers: [],
    users: [],
    maintenanceTasks: [],
    maintenanceRecords: [],
    trafficLight: {
      redLimitGrams: 0,
      thresholdGrams: 3000
    },
    printerMonitoring: {
      statusFlushIntervalMs: 5000
    }
  },
  view: "overview",
  settingsTab: "users",
  role: "user",
  currentUser: null
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
  printerSummary: document.querySelector("#printer-summary"),
  printerCards: document.querySelector("#printer-cards"),
  materialLocation: document.querySelector("#material-location"),
  materialEditLocation: document.querySelector("#material-edit-location"),
  materialSearch: document.querySelector("#material-search"),
  materialCount: document.querySelector("#material-count"),
  materialCards: document.querySelector("#material-cards"),
  quantityTitle: document.querySelector("#quantity-title"),
  quantityGrams: document.querySelector("#quantity-grams"),
  storageSummary: document.querySelector("#storage-summary"),
  storageCards: document.querySelector("#storage-cards"),
  maintenanceSummary: document.querySelector("#maintenance-summary"),
  maintenancePrinterList: document.querySelector("#maintenance-printer-list"),
  maintenanceTaskSummary: document.querySelector("#maintenance-task-summary"),
  maintenanceTaskList: document.querySelector("#maintenance-task-list"),
  maintenanceTaskForm: document.querySelector("#maintenance-task-form"),
  maintenanceTaskSelect: document.querySelector("#maintenance-task-select"),
  maintenanceHistoryList: document.querySelector("#maintenance-history-list"),
  maintenanceModalTitle: document.querySelector("#maintenance-modal-title"),
  userSummary: document.querySelector("#user-summary"),
  userList: document.querySelector("#user-list"),
  trafficLightSummary: document.querySelector("#traffic-light-summary"),
  trafficLightForm: document.querySelector("#traffic-light-form"),
  printerMonitoringSummary: document.querySelector("#printer-monitoring-summary"),
  printerMonitoringForm: document.querySelector("#printer-monitoring-form")
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
    running: "Druckt",
    idle: "Bereit",
    offline: "Offline",
    maintenance: "Wartung",
    pause: "Pausiert",
    finish: "Fertig",
    failed: "Fehler",
    unknown: "Unbekannt"
  }[status] || status;
}

function printerState(printer) {
  return printer.status?.state || printer.status || "unknown";
}

function printerOnline(printer) {
  return Boolean(printer.status?.online);
}

function printerDisplayState(printer) {
  return printerOnline(printer) ? printerState(printer) : "offline";
}

function printerTrafficTone(printer) {
  const state = printerDisplayState(printer);
  if (state === "offline" || state === "failed") {
    return "offline";
  }
  if (state === "running" || state === "printing" || state === "pause") {
    return "printing";
  }
  return "idle";
}

function displayValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "–";
  }
  return `${escapeHtml(value)}${suffix}`;
}

function displayTemperature(value) {
  if (value === null || value === undefined || value === "") {
    return "–";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "–";
  }
  return `${Math.round(number)} °C`;
}

function formatDateTime(value) {
  if (!value) {
    return "–";
  }
  return new Date(value.replace(" ", "T")).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "medium"
  });
}

function formatDate(value) {
  if (!value) {
    return "–";
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString("de-DE", {
    dateStyle: "medium"
  });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function oneDecimal(value) {
  const number = Number(value || 0);
  return Math.max(0, Number.isFinite(number) ? number : 0).toFixed(1);
}

function formatHours(value) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours) || hours <= 0) {
    return "Keine Vorgabe";
  }
  return `${hours.toLocaleString("de-DE")} h`;
}

function formatOperatingHours(value) {
  return `${Number(oneDecimal(value)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} h`;
}

function maintenanceDueLabel(task, record, printer) {
  const dueAfterHours = Number(task.dueAfterHours || 0);
  if (dueAfterHours <= 0) {
    return "Notiz";
  }
  if (!record) {
    return "fällig";
  }

  const currentHours = Number(printer.operatingHours || 0);
  const performedAtHours = Number(record.performedAtHours || 0);
  const usedHours = Math.max(0, currentHours - performedAtHours);
  const remainingHours = dueAfterHours - usedHours;

  if (remainingHours <= 0) {
    return `${Math.ceil(Math.abs(remainingHours)).toLocaleString("de-DE")} h überfällig`;
  }
  return `in ${Math.ceil(remainingHours).toLocaleString("de-DE")} h`;
}

function printProjectName(status) {
  return status.currentFile || status.subtaskName || "Kein Projektname verfügbar";
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

function uniqueMaterialSuggestions(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
}

function materialSuggestionValues(field) {
  const suggestionSources = {
    type: state.data.materials.map((material) => material.type),
    color: state.data.materials.map((material) => material.colorName),
    manufacturer: state.data.materials.map((material) => materialManufacturer(material))
  };

  return uniqueMaterialSuggestions(suggestionSources[field] || []);
}

function closeMaterialSuggestMenus() {
  document.querySelectorAll("[data-material-suggest-menu]").forEach((menu) => {
    menu.classList.remove("active");
    menu.innerHTML = "";
  });
}

function renderMaterialSuggestMenu(input) {
  const field = input.dataset.materialSuggestInput;
  const menu = input.parentElement?.querySelector(`[data-material-suggest-menu="${field}"]`);
  if (!menu) {
    return;
  }

  const query = input.value.trim().toLocaleLowerCase("de-DE");
  const suggestions = materialSuggestionValues(field)
    .filter((value) => !query || value.toLocaleLowerCase("de-DE").includes(query))
    .slice(0, 8);

  if (!suggestions.length) {
    menu.classList.remove("active");
    menu.innerHTML = "";
    return;
  }

  menu.innerHTML = suggestions
    .map((value) => `<button type="button" data-material-suggest-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
    .join("");
  menu.classList.add("active");
}

function materialMatchesSearch(material, query) {
  if (!query) {
    return true;
  }

  const searchableText = [
    materialLabel(material),
    materialManufacturer(material),
    material.colorName,
    storageLabel(material),
    formatGrams(material.quantityGrams)
  ].join(" ").toLocaleLowerCase("de-DE");

  return searchableText.includes(query.toLocaleLowerCase("de-DE"));
}

function maintenanceRecordsForPrinter(printerId) {
  return state.data.maintenanceRecords.filter((record) => String(record.printerId) === String(printerId));
}

function activeMaintenanceTasks() {
  return state.data.maintenanceTasks.filter((task) => task.isActive);
}

function dueMaintenanceTasks() {
  return activeMaintenanceTasks().filter((task) => Number(task.dueAfterHours || 0) > 0);
}

function latestMaintenanceByTask(printerId) {
  const latest = new Map();
  for (const record of maintenanceRecordsForPrinter(printerId)) {
    const key = String(record.taskId || record.taskName);
    if (!latest.has(key)) {
      latest.set(key, record);
    }
  }
  return latest;
}

function materialTrafficLight(material) {
  const quantity = Number(material.quantityGrams || 0);
  const redLimit = Number(state.data.trafficLight?.redLimitGrams ?? 0);
  const threshold = Number(state.data.trafficLight?.thresholdGrams ?? 3000);

  if (quantity <= redLimit) {
    return { tone: "red", label: "Rot" };
  }

  if (quantity < threshold) {
    return { tone: "orange", label: "Orange" };
  }

  return { tone: "green", label: "Grün" };
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

  if (view === "settings") {
    setSettingsTab(state.settingsTab);
  }
}

function setSettingsTab(tab) {
  const targetTab = ["users", "printers", "storage", "materials", "monitoring", "maintenance"].includes(tab) ? tab : "users";
  state.settingsTab = targetTab;

  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === targetTab);
  });

  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.settingsPanel === targetTab);
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

  const overviewMaterials = state.data.materials.filter((material) => {
    const trafficLight = materialTrafficLight(material);
    return trafficLight.tone === "red" || trafficLight.tone === "orange";
  });

  elements.overviewMaterials.innerHTML = overviewMaterials
    .map((material) => {
      const trafficLight = materialTrafficLight(material);
      return `
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
          <td>
            <span class="traffic-light ${trafficLight.tone}" title="${trafficLight.label}" aria-label="${trafficLight.label}"></span>
          </td>
          <td>${formatGrams(material.quantityGrams)}</td>
          <td>${escapeHtml(storageLabel(material))}</td>
        </tr>
      `;
    })
    .join("") || `
      <tr>
        <td colspan="6">Keine knappen Materialien.</td>
      </tr>
    `;

  const visiblePrinters = state.data.printers.filter((printer) => {
    const state = printerDisplayState(printer);
    return printerOnline(printer) && ["running", "printing", "pause", "idle", "finish"].includes(state);
  });
  const summary = visiblePrinters.reduce((counts, printer) => {
    const status = printerDisplayState(printer);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  elements.printerStatusSummary.textContent = Object.entries(summary)
    .map(([status, count]) => `${count} ${statusLabel(status)}`)
    .join(" · ") || "Keine aktiven Drucker";

  elements.printerList.innerHTML = visiblePrinters
    .map((printer) => {
      const status = printer.status || {};
      const stateName = printerDisplayState(printer);
      const progressWidth = Math.max(0, Math.min(100, Number(status.progressPercent || 0)));
      const preview = printer.previewImageUrl
        ? `<img class="overview-printer-preview-image" src="${escapeHtml(printer.previewImageUrl)}" alt="${escapeHtml(printProjectName(status))}">`
        : "<div class=\"overview-printer-preview-placeholder\">Keine Vorschau</div>";
      return `
        <article class="overview-printer-card" data-overview-printer="${printer.id}" tabindex="0" role="button" aria-label="${escapeHtml(printer.name)} Details öffnen">
          <div class="overview-printer-header">
            <strong>${escapeHtml(printer.name)}</strong>
            <span>
              ${escapeHtml(statusLabel(stateName))}
              <span class="status-dot ${printerTrafficTone(printer)}" title="${escapeHtml(statusLabel(stateName))}"></span>
            </span>
          </div>
          <div class="overview-printer-preview">
            ${preview}
          </div>
          <div class="overview-printer-progress-meta">
            <span>Fortschritt ${displayValue(status.progressPercent, " %")}</span>
            <span>Restzeit ${displayValue(status.remainingMinutes, " min")}</span>
          </div>
          <div class="overview-progress-line">
            <span style="width: ${progressWidth}%"></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPrinterDetailCard(printer, { actions = true } = {}) {
  const rawStatus = printer.status || {};
  const status = printerOnline(printer) ? rawStatus : {};
  const stateName = printerDisplayState(printer);
  const hasErrors = Boolean(status.hmsErrorsJson && status.hmsErrorsJson !== "{}" && status.hmsErrorsJson !== "[]");
  const progressWidth = printerOnline(printer) ? Math.max(0, Math.min(100, Number(status.progressPercent || 0))) : 0;
  const preview = printer.previewImageUrl && printerOnline(printer)
    ? `<img class="print-preview-image" src="${escapeHtml(printer.previewImageUrl)}" alt="${escapeHtml(printProjectName(status))}">`
    : "<div class=\"print-preview-placeholder\">Keine Vorschau</div>";

  return `
    <article class="printer-monitor-card ${hasErrors ? "has-errors" : ""}">
      <div class="printer-card-header">
        <div class="printer-title-line">
          <strong>${escapeHtml(printer.name)}</strong>
          <span>${escapeHtml(printer.model || "unknown")}</span>
          <span>${escapeHtml(printer.ipAddress || "Keine IP")}</span>
        </div>
        <div class="printer-state-line">
          <span class="status-dot ${printerTrafficTone(printer)}" title="${escapeHtml(statusLabel(stateName))}"></span>
          <strong>${escapeHtml(statusLabel(stateName))}</strong>
        </div>
      </div>
      <div class="printer-card-main">
        <div class="printer-metrics">
          <span>Nozzle: <strong>${displayTemperature(status.nozzleTemp)} / ${displayTemperature(status.nozzleTargetTemp)}</strong></span>
          <span>Bett: <strong>${displayTemperature(status.bedTemp)} / ${displayTemperature(status.bedTargetTemp)}</strong></span>
          <span>Layer: <strong>${displayValue(status.currentLayer)} / ${displayValue(status.totalLayers)}</strong></span>
          <span>Kammer: <strong>${displayTemperature(status.chamberTemp)}</strong></span>
          <span>Stunden: <strong>${formatOperatingHours(printer.operatingHours)}</strong></span>
        </div>
        <div class="print-preview-frame">
          ${preview}
        </div>
        <div class="printer-flags">
          ${printer.hasAms ? "<span>AMS</span>" : ""}
          ${printer.enableFileCacheLookup ? "<span>Datei-Cache</span>" : ""}
          ${hasErrors ? "<span class=\"error-pill\">HMS</span>" : ""}
        </div>
      </div>
      <div class="printer-progress-meta">
        <span>Fortschritt ${displayValue(status.progressPercent, " %")}</span>
        <span>Restzeit ${displayValue(status.remainingMinutes, " min")}</span>
      </div>
      <div class="progress-line">
        <span style="width: ${progressWidth}%"></span>
      </div>
      ${actions ? `
        <div class="row-actions">
          <button class="secondary-button compact-button" type="button" data-printer-test="${printer.id}">Testen</button>
          <button class="secondary-button compact-button" type="button" data-printer-edit="${printer.id}">Bearbeiten</button>
          <button class="danger-button compact-button" type="button" data-printer-delete="${printer.id}">Löschen</button>
        </div>
      ` : ""}
      <div class="printer-file-row">
        <span>Update ${formatDateTime(status.receivedAt)}</span>
      </div>
    </article>
  `;
}

function renderPrinters() {
  const summary = state.data.printers.reduce((counts, printer) => {
    const status = printerDisplayState(printer);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  elements.printerSummary.textContent = Object.entries(summary)
    .map(([status, count]) => `${count} ${statusLabel(status)}`)
    .join(" · ") || "Keine Drucker";

  elements.printerCards.innerHTML = state.data.printers
    .map((printer) => renderPrinterDetailCard(printer))
    .join("");
}

function renderMaterials() {
  elements.materialLocation.innerHTML = storageOptions();
  elements.materialEditLocation.innerHTML = storageOptions();

  const searchQuery = elements.materialSearch?.value.trim() || "";
  const visibleMaterials = state.data.materials.filter((material) => materialMatchesSearch(material, searchQuery));

  elements.materialCount.textContent = searchQuery
    ? `${visibleMaterials.length} von ${state.data.materials.length} Eintrag/Einträge`
    : `${state.data.materials.length} Eintrag/Einträge`;
  elements.materialCards.innerHTML = visibleMaterials
    .map((material) => {
      const trafficLight = materialTrafficLight(material);
      return `
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
            <span class="traffic-light ${trafficLight.tone}" title="${trafficLight.label}" aria-label="${trafficLight.label}"></span>
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
      `;
    })
    .join("") || `
      <tr>
        <td colspan="7" class="empty-row">Keine Materialien gefunden.</td>
      </tr>
    `;
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

function renderMaintenance() {
  const printers = state.data.printers;
  const tasks = dueMaintenanceTasks();
  const activeTasks = activeMaintenanceTasks();
  elements.maintenanceSummary.textContent = `${printers.length} Drucker · ${activeTasks.length} Wartungsart(en)`;

  elements.maintenancePrinterList.innerHTML = printers
    .map((printer) => {
      const records = maintenanceRecordsForPrinter(printer.id);
      const latest = latestMaintenanceByTask(printer.id);
      const latestRows = tasks
        .slice(0, 4)
        .map((task) => {
          const record = latest.get(String(task.id));
          return `
            <li>
              <span>${escapeHtml(task.name)}</span>
              <strong>${maintenanceDueLabel(task, record, printer)}</strong>
            </li>
          `;
        })
        .join("");
      return `
        <button class="maintenance-printer-card" type="button" data-maintenance-printer="${printer.id}">
          <span class="maintenance-printer-title">
            <strong>${escapeHtml(printer.name)}</strong>
            <span>${escapeHtml(printer.model || "unknown")} · ${escapeHtml(printer.ipAddress || "Keine IP")} · ${formatOperatingHours(printer.operatingHours)}</span>
          </span>
          <ul>
            ${latestRows || "<li><span>Keine Wartungsarten definiert</span><strong>–</strong></li>"}
          </ul>
          <span class="maintenance-printer-foot">${records.length} Eintrag/Einträge</span>
        </button>
      `;
    })
    .join("") || "<p class=\"empty-state\">Keine Drucker angelegt.</p>";
}

function renderMaintenanceTaskSettings() {
  const tasks = state.data.maintenanceTasks;
  const activeCount = tasks.filter((task) => task.isActive).length;
  elements.maintenanceTaskSummary.textContent = `${activeCount} aktiv`;
  elements.maintenanceTaskList.innerHTML = tasks
    .map((task) => `
      <tr class="${task.isActive ? "" : "muted-row"}">
        <td><strong>${escapeHtml(task.name)}</strong></td>
        <td>${formatHours(task.dueAfterHours)}</td>
        <td>${escapeHtml(task.description || "-")}</td>
        <td>${task.isActive ? "Aktiv" : "Archiviert"}</td>
        <td>
          <div class="row-actions">
            <button class="secondary-button compact-button" type="button" data-maintenance-task-edit="${task.id}">Bearbeiten</button>
            <button class="danger-button compact-button" type="button" data-maintenance-task-delete="${task.id}">Entfernen</button>
          </div>
        </td>
      </tr>
    `)
    .join("") || `
      <tr>
        <td colspan="5">Keine Wartungsarten definiert.</td>
      </tr>
    `;
}

function storageById(id) {
  return state.data.storageLocations.find((location) => String(location.id) === String(id));
}

function printerById(id) {
  return state.data.printers.find((printer) => String(printer.id) === String(id));
}

function maintenanceTaskById(id) {
  return state.data.maintenanceTasks.find((task) => String(task.id) === String(id));
}

function maintenanceTaskOptions(selectedId = "") {
  const tasks = activeMaintenanceTasks();
  return tasks
    .map((task) => {
      const selected = String(task.id) === String(selectedId) ? " selected" : "";
      return `<option value="${task.id}"${selected}>${escapeHtml(task.name)}</option>`;
    })
    .join("") || "<option value=\"\">Keine Wartungsarten definiert</option>";
}

function renderMaintenanceHistory(printerId) {
  const records = maintenanceRecordsForPrinter(printerId);
  elements.maintenanceHistoryList.innerHTML = records
    .map((record) => `
      <article class="maintenance-history-item">
        <span>${escapeHtml(record.taskName)}</span>
        <strong>${formatDate(record.performedAt)} · ${formatOperatingHours(record.performedAtHours)}</strong>
        ${record.note ? `<small>${escapeHtml(record.note)}</small>` : ""}
      </article>
    `)
    .join("") || "<p class=\"empty-state\">Noch keine Wartung dokumentiert.</p>";
}

function openMaintenanceModal(id) {
  const printer = printerById(id);
  if (!printer) {
    showToast("Drucker wurde nicht gefunden.", "error");
    return;
  }

  const form = document.querySelector("#maintenance-form");
  form.reset();
  form.elements.printerId.value = printer.id;
  form.elements.performedAt.value = todayInputValue();
  form.elements.performedAtHours.value = oneDecimal(printer.operatingHours);
  elements.maintenanceModalTitle.textContent = `Wartung: ${printer.name}`;
  elements.maintenanceTaskSelect.innerHTML = maintenanceTaskOptions();
  renderMaintenanceHistory(printer.id);
  openModal("maintenance-modal");
}

function openPrinterDetailModal(id) {
  const printer = printerById(id);
  if (!printer) {
    showToast("Drucker wurde nicht gefunden.", "error");
    return;
  }

  const detail = document.querySelector("#printer-detail-content");
  detail.innerHTML = renderPrinterDetailCard(printer, { actions: false });
  openModal("printer-detail-modal");
}

function openEditPrinterModal(id) {
  const printer = printerById(id);
  if (!printer) {
    showToast("Drucker wurde nicht gefunden.", "error");
    return;
  }

  const form = document.querySelector("#printer-edit-form");
  form.elements.id.value = printer.id;
  form.elements.name.value = printer.name;
  form.elements.model.value = printer.model || "unknown";
  form.elements.ipAddress.value = printer.ipAddress || "";
  form.elements.serialNumber.value = printer.serialNumber || "";
  form.elements.accessCode.value = "";
  form.elements.location.value = printer.location || "";
  form.elements.operatingHours.value = oneDecimal(printer.operatingHours);
  form.elements.hasAms.checked = Boolean(printer.hasAms);
  form.elements.enableFileCacheLookup.checked = Boolean(printer.enableFileCacheLookup);
  form.elements.isActive.checked = Boolean(printer.isActive);
  openModal("printer-edit-modal");
}

async function updatePrinter(form) {
  const payload = Object.fromEntries(new FormData(form));
  payload.hasAms = form.elements.hasAms.checked;
  payload.enableFileCacheLookup = form.elements.enableFileCacheLookup.checked;
  payload.isActive = form.elements.isActive.checked;
  const id = payload.id;
  delete payload.id;

  const endpoint = `/api/printers/${encodeURIComponent(id)}`;
  let response = await fetch(endpoint, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (response.status === 405) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Drucker konnte nicht gespeichert werden.");
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast("Drucker wurde aktualisiert.");
}

async function deletePrinter(id) {
  const printer = printerById(id);
  const label = printer ? printer.name : "diesen Drucker";

  if (!window.confirm(`${label} wirklich löschen?`)) {
    return;
  }

  if (!window.confirm("Diese Aktion löscht den Drucker inklusive Statushistorie. Fortfahren?")) {
    return;
  }

  const response = await fetch(`/api/printers/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Drucker konnte nicht gelöscht werden.");
  }

  state.data = body;
  render();
  showToast("Drucker wurde gelöscht.");
}

async function testPrinter(id) {
  showToast("Verbindungstest läuft…", "warn");
  const response = await fetch(`/api/printers/${encodeURIComponent(id)}/test-connection`, {
    method: "POST"
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || body.error || "Verbindungstest fehlgeschlagen.");
  }
  showToast(body.message || "MQTT-Verbindung erfolgreich.");
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

function renderTrafficLightSettings() {
  const settings = state.data.trafficLight || { redLimitGrams: 0, thresholdGrams: 3000 };
  const redKg = Number(settings.redLimitGrams || 0) / 1000;
  const thresholdKg = Number(settings.thresholdGrams || 3000) / 1000;

  elements.trafficLightSummary.textContent = `Rot ${redKg.toLocaleString("de-DE")} kg · Orange < ${thresholdKg.toLocaleString("de-DE")} kg · Grün > ${thresholdKg.toLocaleString("de-DE")} kg`;
  elements.trafficLightForm.elements.redLimitKg.value = redKg;
  elements.trafficLightForm.elements.thresholdKg.value = thresholdKg;
}

function renderPrinterMonitoringSettings() {
  const settings = state.data.printerMonitoring || { statusFlushIntervalMs: 5000 };
  const intervalMs = Number(settings.statusFlushIntervalMs || 5000);
  const seconds = intervalMs / 1000;

  elements.printerMonitoringSummary.textContent = `${intervalMs.toLocaleString("de-DE")} ms · ${seconds.toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
  elements.printerMonitoringForm.elements.statusFlushIntervalMs.value = intervalMs;
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
  renderMaintenance();
  renderPrinters();
  renderUsers();
  renderTrafficLightSettings();
  renderPrinterMonitoringSettings();
  renderMaintenanceTaskSettings();
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

function connectPrinterEvents() {
  if (!window.EventSource || state.printerEvents) {
    return;
  }

  state.printerEvents = new EventSource("/api/printer-events");
  state.printerEvents.addEventListener("printer-status", () => {
    loadData();
  });
  state.printerEvents.addEventListener("error", () => {
    state.printerEvents?.close();
    state.printerEvents = null;
    window.setTimeout(connectPrinterEvents, 5000);
  });
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
    connectPrinterEvents();
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
  connectPrinterEvents();
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
  state.printerEvents?.close();
  state.printerEvents = null;
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

async function updateTrafficLightSettings(form) {
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/settings/traffic-light", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Ampel konnte nicht gespeichert werden.");
  }

  state.data = body;
  render();
  showToast("Ampel-Einstellungen wurden gespeichert.");
}

async function updatePrinterMonitoringSettings(form) {
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/settings/printer-monitoring", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Monitoring konnte nicht gespeichert werden.");
  }

  state.data = body;
  render();
  showToast("Monitoring-Einstellungen wurden gespeichert.");
}

async function createMaintenanceTask(form) {
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/maintenance-tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Wartungsart konnte nicht gespeichert werden.");
  }

  state.data = body;
  form.reset();
  render();
  showToast("Wartungsart wurde gespeichert.");
}

async function updateMaintenanceTask(id) {
  const task = maintenanceTaskById(id);
  if (!task) {
    showToast("Wartungsart wurde nicht gefunden.", "error");
    return;
  }

  const name = window.prompt("Wartungsart bearbeiten", task.name);
  if (name === null) {
    return;
  }

  const description = window.prompt("Notiz bearbeiten", task.description || "");
  if (description === null) {
    return;
  }

  const dueAfterHours = window.prompt("Fällig nach Betriebsstunden", task.dueAfterHours || 0);
  if (dueAfterHours === null) {
    return;
  }

  const response = await fetch(`/api/maintenance-tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, description, dueAfterHours })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Wartungsart konnte nicht gespeichert werden.");
  }

  state.data = body;
  render();
  showToast("Wartungsart wurde aktualisiert.");
}

async function deleteMaintenanceTask(id) {
  const task = maintenanceTaskById(id);
  const label = task ? task.name : "diese Wartungsart";

  if (!window.confirm(`${label} aus den verfügbaren Wartungen entfernen? Vorhandene Historie bleibt erhalten.`)) {
    return;
  }

  const response = await fetch(`/api/maintenance-tasks/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Wartungsart konnte nicht entfernt werden.");
  }

  state.data = body;
  render();
  showToast("Wartungsart wurde entfernt.");
}

async function createMaintenanceRecord(form) {
  const payload = Object.fromEntries(new FormData(form));
  const printerId = payload.printerId;
  delete payload.printerId;

  const response = await fetch(`/api/printers/${encodeURIComponent(printerId)}/maintenance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Wartung konnte nicht gespeichert werden.");
  }

  state.data = body;
  form.reset();
  form.elements.printerId.value = printerId;
  form.elements.performedAt.value = todayInputValue();
  elements.maintenanceTaskSelect.innerHTML = maintenanceTaskOptions();
  renderMaintenanceHistory(printerId);
  render();
  showToast("Wartung wurde dokumentiert.");
}

document.querySelectorAll(".nav-tab[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab));
});

document.querySelectorAll("[data-modal-open]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.modalOpen));
});

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-modal-close]");
  if (closeButton) {
    closeModalFromElement(closeButton);
  }
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
  const overviewPrinter = event.target.closest("[data-overview-printer]");
  if (overviewPrinter) {
    openPrinterDetailModal(overviewPrinter.dataset.overviewPrinter);
    return;
  }

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

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const overviewPrinter = event.target.closest("[data-overview-printer]");
  if (!overviewPrinter) {
    return;
  }

  event.preventDefault();
  openPrinterDetailModal(overviewPrinter.dataset.overviewPrinter);
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
  const testButton = event.target.closest("[data-printer-test]");
  if (testButton) {
    try {
      await testPrinter(testButton.dataset.printerTest);
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }

  const editButton = event.target.closest("[data-printer-edit]");
  if (editButton) {
    openEditPrinterModal(editButton.dataset.printerEdit);
    return;
  }

  const deleteButton = event.target.closest("[data-printer-delete]");
  if (!deleteButton) {
    return;
  }

  try {
    await deletePrinter(deleteButton.dataset.printerDelete);
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.addEventListener("click", async (event) => {
  const printerButton = event.target.closest("[data-maintenance-printer]");
  if (printerButton) {
    openMaintenanceModal(printerButton.dataset.maintenancePrinter);
    return;
  }

  const editButton = event.target.closest("[data-maintenance-task-edit]");
  if (editButton) {
    try {
      await updateMaintenanceTask(editButton.dataset.maintenanceTaskEdit);
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }

  const deleteButton = event.target.closest("[data-maintenance-task-delete]");
  if (!deleteButton) {
    return;
  }

  try {
    await deleteMaintenanceTask(deleteButton.dataset.maintenanceTaskDelete);
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

elements.materialSearch?.addEventListener("input", () => {
  renderMaterials();
});

document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-material-suggest-input]");
  if (!input) {
    return;
  }

  renderMaterialSuggestMenu(input);
});

document.addEventListener("focusin", (event) => {
  const input = event.target.closest("[data-material-suggest-input]");
  if (!input) {
    return;
  }

  renderMaterialSuggestMenu(input);
});

document.addEventListener("mousedown", (event) => {
  const suggestButton = event.target.closest("[data-material-suggest-value]");
  if (suggestButton) {
    event.preventDefault();
    const field = suggestButton.closest(".suggest-field");
    const input = field?.querySelector("[data-material-suggest-input]");
    if (input) {
      input.value = suggestButton.dataset.materialSuggestValue;
      input.focus();
    }
    closeMaterialSuggestMenus();
    return;
  }

  if (!event.target.closest(".suggest-field")) {
    closeMaterialSuggestMenus();
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

document.querySelector("#maintenance-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createMaintenanceRecord(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#printer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitForm(event.currentTarget, "/api/printers", "Drucker wurde gespeichert.");
    connectPrinterEvents();
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#printer-edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await updatePrinter(event.currentTarget);
    connectPrinterEvents();
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

elements.trafficLightForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await updateTrafficLightSettings(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.printerMonitoringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await updatePrinterMonitoringSettings(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.maintenanceTaskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createMaintenanceTask(event.currentTarget);
  } catch (error) {
    showToast(error.message, "error");
  }
});

checkSession();
