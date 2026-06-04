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
    },
    language: window.localStorage.getItem("pfa_language") || "de"
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
  inventoryValue: document.querySelector("#inventory-value"),
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
  printerMonitoringForm: document.querySelector("#printer-monitoring-form"),
  languageSummary: document.querySelector("#language-summary"),
  languageForm: document.querySelector("#language-form")
};

const I18N = {
  de: {
    "login.title": "Anmeldung",
    "login.username": "User-Name",
    "login.password": "Passwort",
    "login.submit": "Anmelden",
    "nav.overview": "Übersicht",
    "nav.materials": "Materialverwaltung",
    "nav.maintenance": "Wartung",
    "nav.settings": "Einstellungen",
    "nav.logout": "Abmelden",
    "overview.printerStatus": "Druckerstatus",
    "overview.materialStock": "Material im Lager",
    "settings.permission": "User können alle Module sehen und bearbeiten, außer die Einstellungen.",
    "settings.users": "Benutzer",
    "settings.printers": "3D-Drucker",
    "settings.storage": "Lagerplätze",
    "settings.materialTraffic": "Material-Ampel",
    "settings.monitoring": "Drucker-Monitoring",
    "settings.maintenance": "Wartungsarten",
    "settings.language": "Sprache",
    "settings.languageSave": "Sprache speichern",
    "settings.languageGerman": "Deutsch",
    "settings.languageEnglish": "English",
    "table.material": "Material",
    "table.manufacturer": "Hersteller",
    "table.color": "Farbe",
    "table.traffic": "Ampel",
    "table.quantity": "Menge",
    "table.priceKgNet": "Preis/kg netto",
    "table.storage": "Lagerplatz",
    "table.action": "Aktion",
    "table.name": "Name",
    "table.email": "E-Mail",
    "table.rights": "Rechte",
    "table.room": "Raum",
    "table.shelf": "Regal",
    "table.box": "Box",
    "table.note": "Notiz",
    "table.interval": "Intervall",
    "table.status": "Status",
    "action.addMaterial": "Material anlegen",
    "action.addUser": "User anlegen",
    "action.addPrinter": "Drucker anlegen",
    "action.addStorage": "Lagerplatz anlegen",
    "action.saveMaterial": "Material speichern",
    "action.saveChanges": "Änderungen speichern",
    "action.saveStorage": "Lagerplatz speichern",
    "action.savePrinter": "Drucker speichern",
    "action.saveUser": "User speichern",
    "action.cancel": "Abbrechen",
    "action.close": "Schließen",
    "action.confirm": "Bestätigen",
    "action.edit": "Bearbeiten",
    "action.delete": "Löschen",
    "action.remove": "Entfernen",
    "action.test": "Testen",
    "action.increaseStock": "Bestand erhöhen",
    "action.decreaseStock": "Bestand reduzieren",
    "action.saveTraffic": "Ampel speichern",
    "action.saveMonitoring": "Monitoring speichern",
    "action.saveMaintenance": "Wartung speichern",
    "modal.materialCreate": "Material anlegen",
    "modal.materialEdit": "Material bearbeiten",
    "modal.quantityEdit": "Bestand ändern",
    "modal.maintenanceEntry": "Wartung eintragen",
    "modal.storageCreate": "Lagerplatz anlegen",
    "modal.storageEdit": "Lagerplatz bearbeiten",
    "modal.printerCreate": "Drucker anlegen",
    "modal.printerEdit": "Drucker bearbeiten",
    "modal.userCreate": "User anlegen",
    "modal.userEdit": "User bearbeiten",
    "field.type": "Typ",
    "field.color": "Farbe",
    "field.manufacturer": "Hersteller",
    "field.colorValue": "Farbwert",
    "field.quantityGrams": "Menge in Gramm",
    "field.pricePerKgNet": "Preis pro Kilogramm netto",
    "field.storage": "Lagerplatz",
    "field.grams": "Gramm",
    "field.maintenanceType": "Wartungsart",
    "field.date": "Datum",
    "field.operatingHours": "Betriebsstunden",
    "field.note": "Notiz",
    "field.model": "Modell",
    "field.ip": "IP-Adresse",
    "field.serial": "Seriennummer",
    "field.accessCode": "Access Code",
    "field.newAccessCode": "Neuer Access Code",
    "field.location": "Standort",
    "field.hasAms": "AMS vorhanden",
    "field.fileCache": "Projektname über Datei-Cache ermitteln",
    "field.active": "Aktiv",
    "field.roleGroup": "Rechtegruppe",
    "field.newPassword": "Neues Passwort",
    "field.password": "Passwort",
    "field.dueAfterHours": "Fällig nach Stunden",
    "field.redUntilKg": "Rot bis kg",
    "field.orangeGreenKg": "Orange/Grün ab kg",
    "field.refreshMs": "Aktualisierung in ms",
    "placeholder.materialSearch": "Material, Hersteller, Farbe oder Lagerplatz",
    "placeholder.password": "Passwort",
    "placeholder.optional": "Optional",
    "placeholder.keepEmpty": "Leer lassen = unverändert",
    "empty.noCriticalMaterials": "Keine knappen Materialien.",
    "empty.noMaterials": "Keine Materialien gefunden.",
    "empty.noPrinters": "Keine Drucker angelegt.",
    "empty.noActivePrinters": "Keine aktiven Drucker",
    "empty.noPrintersShort": "Keine Drucker",
    "empty.noPreview": "Keine Vorschau",
    "empty.noMaintenanceTypes": "Keine Wartungsarten definiert",
    "empty.noMaintenanceTypesDot": "Keine Wartungsarten definiert.",
    "empty.noMaintenanceRecords": "Noch keine Wartung dokumentiert.",
    "empty.noStorage": "Kein Lagerplatz",
    "state.printing": "Druckt",
    "state.idle": "Bereit",
    "state.offline": "Offline",
    "state.maintenance": "Wartung",
    "state.pause": "Pausiert",
    "state.finish": "Fertig",
    "state.failed": "Fehler",
    "state.unknown": "Unbekannt",
    "option.unknown": "Unbekannt",
    "summary.positions": "Positionen",
    "summary.inventoryValue": "Lagerwert",
    "summary.materialTypes": "Materialtyp(en)",
    "summary.storagePlaces": "Lagerplatz/Lagerplätze",
    "summary.maintenanceKinds": "Wartungsart(en)",
    "summary.entries": "Eintrag/Einträge",
    "summary.active": "aktiv",
    "misc.net": "netto",
    "misc.noDefault": "Keine Vorgabe",
    "misc.note": "Notiz",
    "misc.due": "fällig",
    "misc.overdue": "überfällig",
    "misc.in": "in",
    "misc.currentProjectMissing": "Kein Projektname verfügbar",
    "misc.noIp": "Keine IP",
    "misc.history": "Historie",
    "misc.details": "Details öffnen",
    "misc.fileCache": "Datei-Cache",
    "misc.nozzle": "Nozzle",
    "misc.hours": "Stunden",
    "misc.progress": "Fortschritt",
    "misc.remaining": "Restzeit",
    "misc.chamber": "Kammer",
    "misc.bed": "Bett",
    "misc.layer": "Layer",
    "misc.update": "Update",
    "message.notFoundMaterial": "Material wurde nicht gefunden.",
    "message.notFoundPrinter": "Drucker wurde nicht gefunden.",
    "message.notFoundStorage": "Lagerplatz wurde nicht gefunden.",
    "message.notFoundUser": "User wurde nicht gefunden.",
    "message.notFoundMaintenance": "Wartungsart wurde nicht gefunden.",
    "message.savedGenericError": "Speichern fehlgeschlagen.",
    "message.savedMaterial": "Material wurde gespeichert.",
    "message.updatedMaterial": "Material wurde aktualisiert.",
    "message.deletedMaterial": "Material wurde gelöscht.",
    "message.updatedPrinter": "Drucker wurde aktualisiert.",
    "message.deletedPrinter": "Drucker wurde gelöscht.",
    "message.updatedStorage": "Lagerplatz wurde aktualisiert.",
    "message.deletedStorage": "Lagerplatz wurde gelöscht.",
    "message.updatedUser": "User wurde aktualisiert.",
    "message.deletedUser": "User wurde gelöscht.",
    "message.loginNeeded": "Bitte erneut anmelden.",
    "message.loginOk": "Angemeldet.",
    "message.logoutOk": "Abgemeldet.",
    "message.logoutConfirm": "Wirklich abmelden?",
    "message.deleteConfirm": "wirklich löschen?",
    "message.deleteFinalPrinter": "Diese Aktion löscht den Drucker inklusive Statushistorie. Fortfahren?",
    "message.deleteFinalUser": "Diese Aktion kann nicht rückgängig gemacht werden. User endgültig löschen?",
    "message.maintenanceSaved": "Wartung wurde dokumentiert.",
    "message.maintenanceTypeSaved": "Wartungsart wurde gespeichert.",
    "message.maintenanceTypeUpdated": "Wartungsart wurde aktualisiert.",
    "message.maintenanceTypeRemoved": "Wartungsart wurde entfernt.",
    "message.stockUpdated": "Bestand wurde aktualisiert.",
    "message.trafficSaved": "Ampel-Einstellungen wurden gespeichert.",
    "message.monitoringSaved": "Monitoring-Einstellungen wurden gespeichert.",
    "message.languageSaved": "Sprache wurde gespeichert.",
    "prompt.maintenanceEdit": "Wartungsart bearbeiten",
    "prompt.noteEdit": "Notiz bearbeiten",
    "prompt.dueHours": "Fällig nach Betriebsstunden"
  },
  en: {
    "login.title": "Login",
    "login.username": "User name",
    "login.password": "Password",
    "login.submit": "Log in",
    "nav.overview": "Overview",
    "nav.materials": "Materials",
    "nav.maintenance": "Maintenance",
    "nav.settings": "Settings",
    "nav.logout": "Log out",
    "overview.printerStatus": "Printer Status",
    "overview.materialStock": "Material Inventory",
    "settings.permission": "Users can view and edit all modules except settings.",
    "settings.users": "Users",
    "settings.printers": "3D Printers",
    "settings.storage": "Storage Locations",
    "settings.materialTraffic": "Material Traffic Light",
    "settings.monitoring": "Printer Monitoring",
    "settings.maintenance": "Maintenance Types",
    "settings.language": "Language",
    "settings.languageSave": "Save language",
    "settings.languageGerman": "Deutsch",
    "settings.languageEnglish": "English",
    "table.material": "Material",
    "table.manufacturer": "Manufacturer",
    "table.color": "Color",
    "table.traffic": "Traffic",
    "table.quantity": "Quantity",
    "table.priceKgNet": "Price/kg net",
    "table.storage": "Storage",
    "table.action": "Action",
    "table.name": "Name",
    "table.email": "Email",
    "table.rights": "Rights",
    "table.room": "Room",
    "table.shelf": "Shelf",
    "table.box": "Box",
    "table.note": "Note",
    "table.interval": "Interval",
    "table.status": "Status",
    "action.addMaterial": "Add Material",
    "action.addUser": "Add User",
    "action.addPrinter": "Add Printer",
    "action.addStorage": "Add Storage Location",
    "action.saveMaterial": "Save Material",
    "action.saveChanges": "Save Changes",
    "action.saveStorage": "Save Storage Location",
    "action.savePrinter": "Save Printer",
    "action.saveUser": "Save User",
    "action.cancel": "Cancel",
    "action.close": "Close",
    "action.confirm": "Confirm",
    "action.edit": "Edit",
    "action.delete": "Delete",
    "action.remove": "Remove",
    "action.test": "Test",
    "action.increaseStock": "Increase Stock",
    "action.decreaseStock": "Decrease Stock",
    "action.saveTraffic": "Save Traffic Light",
    "action.saveMonitoring": "Save Monitoring",
    "action.saveMaintenance": "Save Maintenance",
    "modal.materialCreate": "Add Material",
    "modal.materialEdit": "Edit Material",
    "modal.quantityEdit": "Change Stock",
    "modal.maintenanceEntry": "Record Maintenance",
    "modal.storageCreate": "Add Storage Location",
    "modal.storageEdit": "Edit Storage Location",
    "modal.printerCreate": "Add Printer",
    "modal.printerEdit": "Edit Printer",
    "modal.userCreate": "Add User",
    "modal.userEdit": "Edit User",
    "field.type": "Type",
    "field.color": "Color",
    "field.manufacturer": "Manufacturer",
    "field.colorValue": "Color Value",
    "field.quantityGrams": "Quantity in Grams",
    "field.pricePerKgNet": "Price per kilogram net",
    "field.storage": "Storage Location",
    "field.grams": "Grams",
    "field.maintenanceType": "Maintenance Type",
    "field.date": "Date",
    "field.operatingHours": "Operating Hours",
    "field.note": "Note",
    "field.model": "Model",
    "field.ip": "IP Address",
    "field.serial": "Serial Number",
    "field.accessCode": "Access Code",
    "field.newAccessCode": "New Access Code",
    "field.location": "Location",
    "field.hasAms": "AMS available",
    "field.fileCache": "Resolve project name via file cache",
    "field.active": "Active",
    "field.roleGroup": "Role Group",
    "field.newPassword": "New Password",
    "field.password": "Password",
    "field.dueAfterHours": "Due after hours",
    "field.redUntilKg": "Red up to kg",
    "field.orangeGreenKg": "Orange/Green from kg",
    "field.refreshMs": "Refresh in ms",
    "placeholder.materialSearch": "Material, manufacturer, color, or storage",
    "placeholder.password": "Password",
    "placeholder.optional": "Optional",
    "placeholder.keepEmpty": "Leave empty = unchanged",
    "empty.noCriticalMaterials": "No low-stock materials.",
    "empty.noMaterials": "No materials found.",
    "empty.noPrinters": "No printers created.",
    "empty.noActivePrinters": "No active printers",
    "empty.noPrintersShort": "No printers",
    "empty.noPreview": "No preview",
    "empty.noMaintenanceTypes": "No maintenance types defined",
    "empty.noMaintenanceTypesDot": "No maintenance types defined.",
    "empty.noMaintenanceRecords": "No maintenance documented yet.",
    "empty.noStorage": "No Storage Location",
    "state.printing": "Printing",
    "state.idle": "Ready",
    "state.offline": "Offline",
    "state.maintenance": "Maintenance",
    "state.pause": "Paused",
    "state.finish": "Finished",
    "state.failed": "Error",
    "state.unknown": "Unknown",
    "option.unknown": "Unknown",
    "summary.positions": "Positions",
    "summary.inventoryValue": "Inventory Value",
    "summary.materialTypes": "material type(s)",
    "summary.storagePlaces": "storage location(s)",
    "summary.maintenanceKinds": "maintenance type(s)",
    "summary.entries": "entry/entries",
    "summary.active": "active",
    "misc.net": "net",
    "misc.noDefault": "No Default",
    "misc.note": "Note",
    "misc.due": "due",
    "misc.overdue": "overdue",
    "misc.in": "in",
    "misc.currentProjectMissing": "No project name available",
    "misc.noIp": "No IP",
    "misc.history": "History",
    "misc.details": "Open details",
    "misc.fileCache": "File Cache",
    "misc.nozzle": "Nozzle",
    "misc.hours": "Hours",
    "misc.progress": "Progress",
    "misc.remaining": "Remaining",
    "misc.chamber": "Chamber",
    "misc.bed": "Bed",
    "misc.layer": "Layer",
    "misc.update": "Update",
    "message.notFoundMaterial": "Material was not found.",
    "message.notFoundPrinter": "Printer was not found.",
    "message.notFoundStorage": "Storage location was not found.",
    "message.notFoundUser": "User was not found.",
    "message.notFoundMaintenance": "Maintenance type was not found.",
    "message.savedGenericError": "Saving failed.",
    "message.savedMaterial": "Material was saved.",
    "message.updatedMaterial": "Material was updated.",
    "message.deletedMaterial": "Material was deleted.",
    "message.updatedPrinter": "Printer was updated.",
    "message.deletedPrinter": "Printer was deleted.",
    "message.updatedStorage": "Storage location was updated.",
    "message.deletedStorage": "Storage location was deleted.",
    "message.updatedUser": "User was updated.",
    "message.deletedUser": "User was deleted.",
    "message.loginNeeded": "Please log in again.",
    "message.loginOk": "Logged in.",
    "message.logoutOk": "Logged out.",
    "message.logoutConfirm": "Log out now?",
    "message.deleteConfirm": "delete permanently?",
    "message.deleteFinalPrinter": "This will delete the printer including status history. Continue?",
    "message.deleteFinalUser": "This action cannot be undone. Delete user permanently?",
    "message.maintenanceSaved": "Maintenance was documented.",
    "message.maintenanceTypeSaved": "Maintenance type was saved.",
    "message.maintenanceTypeUpdated": "Maintenance type was updated.",
    "message.maintenanceTypeRemoved": "Maintenance type was removed.",
    "message.stockUpdated": "Stock was updated.",
    "message.trafficSaved": "Traffic-light settings were saved.",
    "message.monitoringSaved": "Monitoring settings were saved.",
    "message.languageSaved": "Language settings saved.",
    "prompt.maintenanceEdit": "Edit maintenance type",
    "prompt.noteEdit": "Edit note",
    "prompt.dueHours": "Due after operating hours"
  }
};

function language() {
  return ["de", "en"].includes(state.data.language) ? state.data.language : "de";
}

function locale() {
  return language() === "en" ? "en-US" : "de-DE";
}

function t(key) {
  return I18N[language()]?.[key] || I18N.de[key] || key;
}

function setTextPreserveChildren(element, text) {
  if (!element) {
    return;
  }
  const textNode = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) {
    textNode.textContent = text;
    return;
  }
  element.prepend(document.createTextNode(text));
}

const STATIC_TEXTS = [
  ["#login-form h1", "login.title"],
  ["#login-form label:nth-of-type(1)", "login.username"],
  ["#login-form label:nth-of-type(2)", "login.password"],
  ["#login-form button[type='submit']", "login.submit"],
  ["[data-view='overview']", "nav.overview"],
  ["[data-view='materials']", "nav.materials"],
  ["[data-view='maintenance']", "nav.maintenance"],
  ["[data-view='settings']", "nav.settings"],
  ["#logout-button", "nav.logout"],
  ["#overview-view .details:nth-of-type(1) h2", "overview.printerStatus"],
  ["#overview-view .details:nth-of-type(2) h2", "overview.materialStock"],
  ["#permission-banner", "settings.permission"],
  ["[data-settings-tab='users']", "settings.users"],
  ["[data-settings-tab='printers']", "settings.printers"],
  ["[data-settings-tab='storage']", "settings.storage"],
  ["[data-settings-tab='materials']", "settings.materialTraffic"],
  ["[data-settings-tab='monitoring']", "settings.monitoring"],
  ["[data-settings-tab='maintenance']", "settings.maintenance"],
  ["[data-settings-tab='language']", "settings.language"],
  ["[data-settings-panel='users'] h2", "settings.users"],
  ["[data-settings-panel='users'] [data-modal-open='user-modal']", "action.addUser"],
  ["[data-settings-panel='printers'] h2", "settings.printers"],
  ["[data-settings-panel='printers'] [data-modal-open='printer-modal']", "action.addPrinter"],
  ["[data-settings-panel='storage'] h2", "settings.storage"],
  ["[data-settings-panel='storage'] [data-modal-open='storage-modal']", "action.addStorage"],
  ["[data-settings-panel='materials'] h2", "settings.materialTraffic"],
  ["[data-settings-panel='materials'] button[type='submit']", "action.saveTraffic"],
  ["[data-settings-panel='monitoring'] h2", "settings.monitoring"],
  ["[data-settings-panel='monitoring'] button[type='submit']", "action.saveMonitoring"],
  ["[data-settings-panel='maintenance'] h2", "settings.maintenance"],
  ["#maintenance-task-form button[type='submit']", "action.saveMaintenance"],
  ["[data-settings-panel='language'] h2", "settings.language"],
  ["#language-form button[type='submit']", "settings.languageSave"],
  ["#language-form label", "settings.language"],
  ["#language-form option[value='de']", "settings.languageGerman"],
  ["#language-form option[value='en']", "settings.languageEnglish"],
  ["#printer-form option[value='unknown'], #printer-edit-form option[value='unknown']", "option.unknown"]
];

const STATIC_ATTRS = [
  ["#material-search", "placeholder", "placeholder.materialSearch"],
  ["#material-search", "aria-label", "placeholder.materialSearch"],
  ["#login-form input[name='password']", "placeholder", "placeholder.password"],
  ["#maintenance-task-form input[name='description'], #maintenance-form textarea[name='note']", "placeholder", "placeholder.optional"],
  ["#printer-edit-form input[name='accessCode'], #user-edit-form input[name='password']", "placeholder", "placeholder.keepEmpty"],
  ["[data-modal-close]", "aria-label", "action.close"]
];

function translateTableHeaders() {
  const headerGroups = [
    ["#overview-view thead th", ["table.material", "table.manufacturer", "table.color", "table.traffic", "table.quantity", "table.storage"]],
    ["#materials-view thead th", ["table.material", "table.manufacturer", "table.color", "table.traffic", "table.quantity", "table.priceKgNet", "table.storage", "table.action"]],
    ["[data-settings-panel='users'] thead th", ["table.name", "table.email", "table.rights", "table.action"]],
    ["[data-settings-panel='storage'] thead th", ["table.room", "table.shelf", "table.box", "table.note", "table.material", "table.action"]],
    ["[data-settings-panel='maintenance'] thead th", ["settings.maintenance", "table.interval", "table.note", "table.status", "table.action"]]
  ];

  headerGroups.forEach(([selector, keys]) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      if (keys[index]) {
        element.textContent = t(keys[index]);
      }
    });
  });
}

function translateFormLabels() {
  const formLabels = [
    ["#material-form label:nth-of-type(1)", "field.type"],
    ["#material-form label:nth-of-type(2)", "field.color"],
    ["#material-form label:nth-of-type(3)", "field.manufacturer"],
    ["#material-form label:nth-of-type(4)", "field.colorValue"],
    ["#material-form label:nth-of-type(5)", "field.quantityGrams"],
    ["#material-form label:nth-of-type(6)", "field.pricePerKgNet"],
    ["#material-form label:nth-of-type(7)", "field.storage"],
    ["#material-edit-form label:nth-of-type(1)", "field.type"],
    ["#material-edit-form label:nth-of-type(2)", "field.color"],
    ["#material-edit-form label:nth-of-type(3)", "field.manufacturer"],
    ["#material-edit-form label:nth-of-type(4)", "field.colorValue"],
    ["#material-edit-form label:nth-of-type(5)", "field.quantityGrams"],
    ["#material-edit-form label:nth-of-type(6)", "field.pricePerKgNet"],
    ["#material-edit-form label:nth-of-type(7)", "field.storage"],
    ["#quantity-form label", "field.grams"],
    ["#maintenance-form label:nth-of-type(1)", "field.maintenanceType"],
    ["#maintenance-form label:nth-of-type(2)", "field.date"],
    ["#maintenance-form label:nth-of-type(3)", "field.operatingHours"],
    ["#maintenance-form label:nth-of-type(4)", "field.note"],
    ["#storage-form label:nth-of-type(1), #storage-edit-form label:nth-of-type(1)", "table.room"],
    ["#storage-form label:nth-of-type(2), #storage-edit-form label:nth-of-type(2)", "table.shelf"],
    ["#storage-form label:nth-of-type(3), #storage-edit-form label:nth-of-type(3)", "table.box"],
    ["#storage-form label:nth-of-type(4), #storage-edit-form label:nth-of-type(4)", "field.note"],
    ["#printer-form label:nth-of-type(1), #printer-edit-form label:nth-of-type(1)", "table.name"],
    ["#printer-form label:nth-of-type(2), #printer-edit-form label:nth-of-type(2)", "field.model"],
    ["#printer-form label:nth-of-type(3), #printer-edit-form label:nth-of-type(3)", "field.ip"],
    ["#printer-form label:nth-of-type(4), #printer-edit-form label:nth-of-type(4)", "field.serial"],
    ["#printer-form label:nth-of-type(5)", "field.accessCode"],
    ["#printer-edit-form label:nth-of-type(5)", "field.newAccessCode"],
    ["#printer-form label:nth-of-type(6), #printer-edit-form label:nth-of-type(6)", "field.location"],
    ["#printer-form label:nth-of-type(7), #printer-edit-form label:nth-of-type(7)", "field.operatingHours"],
    ["#printer-form label:nth-of-type(8), #printer-edit-form label:nth-of-type(8)", "field.hasAms"],
    ["#printer-form label:nth-of-type(9), #printer-edit-form label:nth-of-type(9)", "field.fileCache"],
    ["#printer-edit-form label:nth-of-type(10)", "field.active"],
    ["#user-form label:nth-of-type(1), #user-edit-form label:nth-of-type(1)", "table.name"],
    ["#user-form label:nth-of-type(2), #user-edit-form label:nth-of-type(2)", "table.email"],
    ["#user-form label:nth-of-type(3), #user-edit-form label:nth-of-type(3)", "field.roleGroup"],
    ["#user-form label:nth-of-type(4)", "field.password"],
    ["#user-edit-form label:nth-of-type(4)", "field.newPassword"],
    ["#maintenance-task-form label:nth-of-type(1)", "settings.maintenance"],
    ["#maintenance-task-form label:nth-of-type(2)", "field.dueAfterHours"],
    ["#maintenance-task-form label:nth-of-type(3)", "field.note"],
    ["#traffic-light-form label:nth-of-type(1)", "field.redUntilKg"],
    ["#traffic-light-form label:nth-of-type(2)", "field.orangeGreenKg"],
    ["#printer-monitoring-form label", "field.refreshMs"]
  ];

  formLabels.forEach(([selector, key]) => {
    document.querySelectorAll(selector).forEach((element) => setTextPreserveChildren(element, t(key)));
  });
}

function translateModals() {
  const modalTexts = [
    ["#material-modal .eyebrow, #material-edit-modal .eyebrow", "nav.materials"],
    ["#material-modal h2", "modal.materialCreate"],
    ["#material-edit-modal h2", "modal.materialEdit"],
    ["#quantity-modal .eyebrow", "modal.quantityEdit"],
    ["#quantity-title", "modal.quantityEdit"],
    ["#maintenance-modal .eyebrow", "nav.maintenance"],
    ["#maintenance-modal-title", "modal.maintenanceEntry"],
    [".maintenance-history h3", "misc.history"],
    ["#storage-modal .eyebrow, #storage-edit-modal .eyebrow", "settings.storage"],
    ["#storage-modal h2", "modal.storageCreate"],
    ["#storage-edit-modal h2", "modal.storageEdit"],
    ["#printer-modal .eyebrow, #printer-edit-modal .eyebrow", "settings.printers"],
    ["#printer-modal h2", "modal.printerCreate"],
    ["#printer-edit-modal h2", "modal.printerEdit"],
    ["#user-modal .eyebrow, #user-edit-modal .eyebrow", "nav.settings"],
    ["#user-modal h2", "modal.userCreate"],
    ["#user-edit-modal h2", "modal.userEdit"]
  ];

  modalTexts.forEach(([selector, key]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = t(key);
    });
  });

  document.querySelectorAll(".modal-actions .secondary-button").forEach((button) => {
    button.textContent = t("action.cancel");
  });
  document.querySelector("#material-form button[type='submit']").textContent = t("action.saveMaterial");
  document.querySelector("#material-edit-form button[type='submit']").textContent = t("action.saveChanges");
  document.querySelector("#quantity-form button[type='submit']").textContent = t("action.confirm");
  document.querySelector("#maintenance-form button[type='submit']").textContent = t("action.saveMaintenance");
  document.querySelector("#storage-form button[type='submit']").textContent = t("action.saveStorage");
  document.querySelector("#storage-edit-form button[type='submit']").textContent = t("action.saveChanges");
  document.querySelector("#printer-form button[type='submit']").textContent = t("action.savePrinter");
  document.querySelector("#printer-edit-form button[type='submit']").textContent = t("action.saveChanges");
  document.querySelector("#user-form button[type='submit']").textContent = t("action.saveUser");
  document.querySelector("#user-edit-form button[type='submit']").textContent = t("action.saveChanges");
}

function applyTranslations() {
  document.documentElement.lang = language();
  STATIC_TEXTS.forEach(([selector, key]) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element.matches("label")) {
        setTextPreserveChildren(element, t(key));
        return;
      }
      element.textContent = t(key);
    });
  });
  STATIC_ATTRS.forEach(([selector, attr, key]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.setAttribute(attr, t(key));
    });
  });
  translateTableHeaders();
  translateFormLabels();
  translateModals();
}

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
    return `${(grams / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} kg`;
  }
  return `${grams.toLocaleString(locale())} g`;
}

function formatEuroNet(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ${t("misc.net")}`;
}

function materialInventoryValue(material) {
  return (Number(material.quantityGrams || 0) / 1000) * Number(material.pricePerKgNet || 0);
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
  if (!item || ("storageLocationId" in item && !item.storageLocationId) || !item.room || !item.shelf || !item.box) {
    return t("empty.noStorage");
  }
  return `${item.room} / ${item.shelf} / ${item.box}`;
}

function statusLabel(status) {
  return {
    printing: t("state.printing"),
    running: t("state.printing"),
    idle: t("state.idle"),
    offline: t("state.offline"),
    maintenance: t("state.maintenance"),
    pause: t("state.pause"),
    finish: t("state.finish"),
    failed: t("state.failed"),
    unknown: t("state.unknown")
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
  return new Date(value.replace(" ", "T")).toLocaleString(locale(), {
    dateStyle: "short",
    timeStyle: "medium"
  });
}

function formatDate(value) {
  if (!value) {
    return "–";
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale(), {
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
    return t("misc.noDefault");
  }
  return `${hours.toLocaleString(locale())} h`;
}

function formatOperatingHours(value) {
  return `${Number(oneDecimal(value)).toLocaleString(locale(), { maximumFractionDigits: 1 })} h`;
}

function maintenanceDueLabel(task, record, printer) {
  const dueAfterHours = Number(task.dueAfterHours || 0);
  if (dueAfterHours <= 0) {
    return t("misc.note");
  }
  if (!record) {
    return t("misc.due");
  }

  const currentHours = Number(printer.operatingHours || 0);
  const performedAtHours = Number(record.performedAtHours || 0);
  const usedHours = Math.max(0, currentHours - performedAtHours);
  const remainingHours = dueAfterHours - usedHours;

  if (remainingHours <= 0) {
    return `${Math.ceil(Math.abs(remainingHours)).toLocaleString(locale())} h ${t("misc.overdue")}`;
  }
  return `${t("misc.in")} ${Math.ceil(remainingHours).toLocaleString(locale())} h`;
}

function printProjectName(status) {
  return status.currentFile || status.subtaskName || t("misc.currentProjectMissing");
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
    formatGrams(material.quantityGrams),
    formatEuroNet(material.pricePerKgNet)
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
    return { tone: "red", label: language() === "en" ? "Red" : "Rot" };
  }

  if (quantity < threshold) {
    return { tone: "orange", label: "Orange" };
  }

  return { tone: "green", label: language() === "en" ? "Green" : "Grün" };
}

function storageOptions(selectedId = "") {
  return [
    `<option value=""${selectedId ? "" : " selected"}>${t("empty.noStorage")}</option>`,
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
  applyTranslations();
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
  const targetTab = ["users", "printers", "storage", "materials", "monitoring", "maintenance", "language"].includes(tab) ? tab : "users";
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

  elements.materialTypes.textContent = `${materialTypes.size} ${t("summary.materialTypes")}`;

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
        <td colspan="6">${t("empty.noCriticalMaterials")}</td>
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
    .join(" · ") || t("empty.noActivePrinters");

  elements.printerList.innerHTML = visiblePrinters
    .map((printer) => {
      const status = printer.status || {};
      const stateName = printerDisplayState(printer);
      const progressWidth = Math.max(0, Math.min(100, Number(status.progressPercent || 0)));
      const preview = printer.previewImageUrl
        ? `<img class="overview-printer-preview-image" src="${escapeHtml(printer.previewImageUrl)}" alt="${escapeHtml(printProjectName(status))}">`
        : `<div class="overview-printer-preview-placeholder">${t("empty.noPreview")}</div>`;
      return `
        <article class="overview-printer-card" data-overview-printer="${printer.id}" tabindex="0" role="button" aria-label="${escapeHtml(`${printer.name} ${t("misc.details")}`)}">
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
            <span>${t("misc.progress")} ${displayValue(status.progressPercent, " %")}</span>
            <span>${t("misc.remaining")} ${displayValue(status.remainingMinutes, " min")}</span>
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
        : `<div class="print-preview-placeholder">${t("empty.noPreview")}</div>`;

  return `
    <article class="printer-monitor-card ${hasErrors ? "has-errors" : ""}">
      <div class="printer-card-header">
        <div class="printer-title-line">
          <strong>${escapeHtml(printer.name)}</strong>
          <span>${escapeHtml(printer.model || "unknown")}</span>
          <span>${escapeHtml(printer.ipAddress || t("misc.noIp"))}</span>
        </div>
        <div class="printer-state-line">
          <span class="status-dot ${printerTrafficTone(printer)}" title="${escapeHtml(statusLabel(stateName))}"></span>
          <strong>${escapeHtml(statusLabel(stateName))}</strong>
        </div>
      </div>
      <div class="printer-card-main">
        <div class="printer-metrics">
          <span>${t("misc.nozzle")}: <strong>${displayTemperature(status.nozzleTemp)} / ${displayTemperature(status.nozzleTargetTemp)}</strong></span>
          <span>${t("misc.bed")}: <strong>${displayTemperature(status.bedTemp)} / ${displayTemperature(status.bedTargetTemp)}</strong></span>
          <span>${t("misc.layer")}: <strong>${displayValue(status.currentLayer)} / ${displayValue(status.totalLayers)}</strong></span>
          <span>${t("misc.chamber")}: <strong>${displayTemperature(status.chamberTemp)}</strong></span>
          <span>${t("misc.hours")}: <strong>${formatOperatingHours(printer.operatingHours)}</strong></span>
        </div>
        <div class="print-preview-frame">
          ${preview}
        </div>
        <div class="printer-flags">
          ${printer.hasAms ? "<span>AMS</span>" : ""}
          ${printer.enableFileCacheLookup ? `<span>${t("misc.fileCache")}</span>` : ""}
          ${hasErrors ? "<span class=\"error-pill\">HMS</span>" : ""}
        </div>
      </div>
      <div class="printer-progress-meta">
        <span>${t("misc.progress")} ${displayValue(status.progressPercent, " %")}</span>
        <span>${t("misc.remaining")} ${displayValue(status.remainingMinutes, " min")}</span>
      </div>
      <div class="progress-line">
        <span style="width: ${progressWidth}%"></span>
      </div>
      ${actions ? `
        <div class="row-actions">
          <button class="secondary-button compact-button" type="button" data-printer-test="${printer.id}">${t("action.test")}</button>
          <button class="secondary-button compact-button" type="button" data-printer-edit="${printer.id}">${t("action.edit")}</button>
          <button class="danger-button compact-button" type="button" data-printer-delete="${printer.id}">${t("action.delete")}</button>
        </div>
      ` : ""}
      <div class="printer-file-row">
        <span>${t("misc.update")} ${formatDateTime(status.receivedAt)}</span>
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
    .join(" · ") || t("empty.noPrintersShort");

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
    ? `${visibleMaterials.length} ${language() === "en" ? "of" : "von"} ${state.data.materials.length} ${t("summary.positions")}`
    : `${state.data.materials.length} ${t("summary.positions")}`;
  elements.inventoryValue.textContent = `${t("summary.inventoryValue")} ${formatEuroNet(
    visibleMaterials.reduce((sum, material) => sum + materialInventoryValue(material), 0)
  )}`;
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
              <button class="compact-button quantity-button" type="button" data-quantity-mode="minus" data-quantity-material="${material.id}" aria-label="${t("action.decreaseStock")}">-</button>
              <strong>${formatGrams(material.quantityGrams)}</strong>
              <button class="compact-button quantity-button" type="button" data-quantity-mode="plus" data-quantity-material="${material.id}" aria-label="${t("action.increaseStock")}">+</button>
            </div>
          </td>
          <td>${formatEuroNet(material.pricePerKgNet)}</td>
          <td>${escapeHtml(storageLabel(material))}</td>
          <td>
            <div class="row-actions">
              <button class="secondary-button compact-button" type="button" data-material-edit="${material.id}">${t("action.edit")}</button>
              <button class="danger-button compact-button" type="button" data-material-delete="${material.id}">${t("action.delete")}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("") || `
      <tr>
        <td colspan="8" class="empty-row">${t("empty.noMaterials")}</td>
      </tr>
    `;
}

function openEditMaterialModal(id) {
  const material = materialById(id);
  if (!material) {
    showToast(t("message.notFoundMaterial"), "error");
    return;
  }

  const form = document.querySelector("#material-edit-form");
  form.elements.id.value = material.id;
  form.elements.type.value = material.type;
  form.elements.colorName.value = material.colorName;
  form.elements.manufacturer.value = materialManufacturer(material);
  form.elements.colorHex.value = material.colorHex;
  form.elements.quantityGrams.value = material.quantityGrams;
  form.elements.pricePerKgNet.value = Number(material.pricePerKgNet || 0).toLocaleString(locale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  elements.materialEditLocation.innerHTML = storageOptions(material.storageLocationId || "");
  openModal("material-edit-modal");
}

function openQuantityModal(id, mode) {
  const material = materialById(id);
  if (!material) {
    showToast(t("message.notFoundMaterial"), "error");
    return;
  }

  const form = document.querySelector("#quantity-form");
  form.elements.id.value = material.id;
  form.elements.mode.value = mode;
  form.elements.grams.value = "";
  elements.quantityTitle.textContent = mode === "plus"
    ? (language() === "en" ? "Increase Stock" : "Bestand erhöhen")
    : (language() === "en" ? "Decrease Stock" : "Bestand verringern");
  openModal("quantity-modal");
  window.setTimeout(() => elements.quantityGrams.focus(), 0);
}

async function deleteMaterial(id) {
  const material = state.data.materials.find((item) => String(item.id) === String(id));
  const label = material ? materialLabel(material) : t("table.material");

  if (!window.confirm(`${label} ${t("message.deleteConfirm")}`)) {
    return;
  }

  const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || t("message.deletedMaterial"));
  }

  state.data = body;
  render();
  showToast(t("message.deletedMaterial"));
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast(t("message.updatedMaterial"));
}

async function adjustQuantity(form) {
  const payload = Object.fromEntries(new FormData(form));
  const grams = Number.parseInt(payload.grams, 10);

  if (!Number.isInteger(grams) || grams < 1) {
    throw new Error(language() === "en" ? "Please enter a gram value greater than 0." : "Bitte einen Grammwert größer 0 eingeben.");
  }

  const deltaGrams = payload.mode === "minus" ? -grams : grams;
  const response = await fetch(`/api/materials/${encodeURIComponent(payload.id)}/quantity`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deltaGrams })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast(t("message.stockUpdated"));
}

function renderStorage() {
  elements.storageSummary.textContent = `${state.data.storageLocations.length} ${t("summary.storagePlaces")}`;
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
              <button class="secondary-button compact-button" type="button" data-storage-edit="${location.id}">${t("action.edit")}</button>
              <button class="danger-button compact-button" type="button" data-storage-delete="${location.id}">${t("action.delete")}</button>
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
  elements.maintenanceSummary.textContent = `${printers.length} ${t("settings.printers")} · ${activeTasks.length} ${t("summary.maintenanceKinds")}`;

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
            <span>${escapeHtml(printer.model || "unknown")} · ${escapeHtml(printer.ipAddress || t("misc.noIp"))} · ${formatOperatingHours(printer.operatingHours)}</span>
          </span>
          <ul>
            ${latestRows || `<li><span>${t("empty.noMaintenanceTypes")}</span><strong>–</strong></li>`}
          </ul>
          <span class="maintenance-printer-foot">${records.length} ${t("summary.entries")}</span>
        </button>
      `;
    })
    .join("") || `<p class="empty-state">${t("empty.noPrinters")}</p>`;
}

function renderMaintenanceTaskSettings() {
  const tasks = state.data.maintenanceTasks;
  const activeCount = tasks.filter((task) => task.isActive).length;
  elements.maintenanceTaskSummary.textContent = `${activeCount} ${t("summary.active")}`;
  elements.maintenanceTaskList.innerHTML = tasks
    .map((task) => `
      <tr class="${task.isActive ? "" : "muted-row"}">
        <td><strong>${escapeHtml(task.name)}</strong></td>
        <td>${formatHours(task.dueAfterHours)}</td>
        <td>${escapeHtml(task.description || "-")}</td>
        <td>${task.isActive ? t("summary.active") : (language() === "en" ? "Archived" : "Archiviert")}</td>
        <td>
          <div class="row-actions">
            <button class="secondary-button compact-button" type="button" data-maintenance-task-edit="${task.id}">${t("action.edit")}</button>
            <button class="danger-button compact-button" type="button" data-maintenance-task-delete="${task.id}">${t("action.remove")}</button>
          </div>
        </td>
      </tr>
    `)
    .join("") || `
      <tr>
        <td colspan="5">${t("empty.noMaintenanceTypesDot")}</td>
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
    .join("") || `<option value="">${t("empty.noMaintenanceTypes")}</option>`;
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
    .join("") || `<p class="empty-state">${t("empty.noMaintenanceRecords")}</p>`;
}

function openMaintenanceModal(id) {
  const printer = printerById(id);
  if (!printer) {
    showToast(t("message.notFoundPrinter"), "error");
    return;
  }

  const form = document.querySelector("#maintenance-form");
  form.reset();
  form.elements.printerId.value = printer.id;
  form.elements.performedAt.value = todayInputValue();
  form.elements.performedAtHours.value = oneDecimal(printer.operatingHours);
  elements.maintenanceModalTitle.textContent = `${t("nav.maintenance")}: ${printer.name}`;
  elements.maintenanceTaskSelect.innerHTML = maintenanceTaskOptions();
  renderMaintenanceHistory(printer.id);
  openModal("maintenance-modal");
}

function openPrinterDetailModal(id) {
  const printer = printerById(id);
  if (!printer) {
    showToast(t("message.notFoundPrinter"), "error");
    return;
  }

  const detail = document.querySelector("#printer-detail-content");
  detail.innerHTML = renderPrinterDetailCard(printer, { actions: false });
  openModal("printer-detail-modal");
}

function openEditPrinterModal(id) {
  const printer = printerById(id);
  if (!printer) {
    showToast(t("message.notFoundPrinter"), "error");
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast(t("message.updatedPrinter"));
}

async function deletePrinter(id) {
  const printer = printerById(id);
  const label = printer ? printer.name : t("settings.printers");

  if (!window.confirm(`${label} ${t("message.deleteConfirm")}`)) {
    return;
  }

  if (!window.confirm(t("message.deleteFinalPrinter"))) {
    return;
  }

  const response = await fetch(`/api/printers/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  render();
  showToast(t("message.deletedPrinter"));
}

async function testPrinter(id) {
  showToast(language() === "en" ? "Connection test running..." : "Verbindungstest läuft…", "warn");
  const response = await fetch(`/api/printers/${encodeURIComponent(id)}/test-connection`, {
    method: "POST"
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || body.error || (language() === "en" ? "Connection test failed." : "Verbindungstest fehlgeschlagen."));
  }
  showToast(body.message || (language() === "en" ? "MQTT connection successful." : "MQTT-Verbindung erfolgreich."));
}

function openEditStorageModal(id) {
  const location = storageById(id);
  if (!location) {
    showToast(t("message.notFoundStorage"), "error");
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast(t("message.updatedStorage"));
}

async function deleteStorageLocation(id) {
  const location = state.data.storageLocations.find((item) => String(item.id) === String(id));
  const label = location ? storageLabel(location) : t("settings.storage");
  const materialCount = state.data.materials.filter((material) => String(material.storageLocationId) === String(id)).length;
  const note = materialCount > 0
    ? ` ${materialCount} ${language() === "en" ? "material position(s) will no longer have a storage location." : "Materialeintrag/Materialeinträge werden danach ohne Lagerplatz geführt."}`
    : "";

  if (!window.confirm(`${label} ${t("message.deleteConfirm")}${note}`)) {
    return;
  }

  const response = await fetch(`/api/storage-locations/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  render();
  showToast(t("message.deletedStorage"));
}

function renderUsers() {
  elements.userSummary.textContent = `${state.data.users.length} ${t("settings.users")}`;
  elements.userList.innerHTML = state.data.users
    .map((user) => `
      <tr>
        <td><strong>${escapeHtml(user.name)}</strong></td>
        <td>${escapeHtml(user.email)}</td>
        <td><span class="role-pill ${user.role}">${user.role === "admin" ? "Admin" : "User"}</span></td>
        <td>
          <div class="row-actions">
            <button class="secondary-button compact-button" type="button" data-user-edit="${user.id}">${t("action.edit")}</button>
            <button class="danger-button compact-button" type="button" data-user-delete="${user.id}">${t("action.delete")}</button>
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

  elements.trafficLightSummary.textContent = `${language() === "en" ? "Red" : "Rot"} ${redKg.toLocaleString(locale())} kg · Orange < ${thresholdKg.toLocaleString(locale())} kg · ${language() === "en" ? "Green" : "Grün"} > ${thresholdKg.toLocaleString(locale())} kg`;
  elements.trafficLightForm.elements.redLimitKg.value = redKg;
  elements.trafficLightForm.elements.thresholdKg.value = thresholdKg;
}

function renderPrinterMonitoringSettings() {
  const settings = state.data.printerMonitoring || { statusFlushIntervalMs: 5000 };
  const intervalMs = Number(settings.statusFlushIntervalMs || 5000);
  const seconds = intervalMs / 1000;

  elements.printerMonitoringSummary.textContent = `${intervalMs.toLocaleString(locale())} ms · ${seconds.toLocaleString(locale(), { maximumFractionDigits: 1 })} s`;
  elements.printerMonitoringForm.elements.statusFlushIntervalMs.value = intervalMs;
}

function renderLanguageSettings() {
  if (!elements.languageForm) {
    return;
  }
  elements.languageSummary.textContent = language() === "en" ? "English" : "Deutsch";
  elements.languageForm.elements.language.value = language();
}

function userById(id) {
  return state.data.users.find((user) => String(user.id) === String(id));
}

function openEditUserModal(id) {
  const user = userById(id);
  if (!user) {
    showToast(t("message.notFoundUser"), "error");
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  closeModalFromElement(form);
  render();
  showToast(t("message.updatedUser"));
}

async function deleteUser(id) {
  const user = userById(id);
  const label = user ? `${user.name} (${user.email})` : t("settings.users");

  if (!window.confirm(`${label} ${t("message.deleteConfirm")}`)) {
    return;
  }

  if (!window.confirm(t("message.deleteFinalUser"))) {
    return;
  }

  const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  render();
  showToast(t("message.deletedUser"));
}

function render() {
  elements.appVersion.textContent = `v${state.data.version}`;
  applyTranslations();
  renderOverview();
  renderMaterials();
  renderStorage();
  renderMaintenance();
  renderPrinters();
  renderUsers();
  renderTrafficLightSettings();
  renderPrinterMonitoringSettings();
  renderMaintenanceTaskSettings();
  renderLanguageSettings();
  applyPermissions();
}

async function loadData() {
  try {
    const response = await fetch("/api/app-data");
    if (response.status === 401) {
      showLogin();
      showToast(t("message.loginNeeded"), "warn");
      return;
    }
    if (!response.ok) {
      throw new Error(language() === "en" ? "App data could not be loaded." : "App-Daten konnten nicht geladen werden.");
    }
    state.data = await response.json();
    window.localStorage.setItem("pfa_language", language());
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
    showToast(language() === "en" ? "Session could not be checked." : "Sitzung konnte nicht geprüft werden.", "error");
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
    throw new Error(body.error || (language() === "en" ? "Login failed." : "Anmeldung fehlgeschlagen."));
  }

  showApp(body.user);
  setView("overview");
  connectPrinterEvents();
  await loadData();
  showToast(t("message.loginOk"));
}

async function logoutUser() {
  if (!window.confirm(t("message.logoutConfirm"))) {
    return;
  }

  const response = await fetch("/api/logout", {
    method: "POST"
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || (language() === "en" ? "Logout failed." : "Abmelden fehlgeschlagen."));
  }

  showLogin();
  state.printerEvents?.close();
  state.printerEvents = null;
  showToast(t("message.logoutOk"));
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
    throw new Error(body.error || t("message.savedGenericError"));
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  render();
  showToast(t("message.trafficSaved"));
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  render();
  showToast(t("message.monitoringSaved"));
}

async function updateLanguageSettings(form) {
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/settings/language", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  window.localStorage.setItem("pfa_language", language());
  render();
  showToast(t("message.languageSaved"));
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  form.reset();
  render();
  showToast(t("message.maintenanceTypeSaved"));
}

async function updateMaintenanceTask(id) {
  const task = maintenanceTaskById(id);
  if (!task) {
    showToast(t("message.notFoundMaintenance"), "error");
    return;
  }

  const name = window.prompt(t("prompt.maintenanceEdit"), task.name);
  if (name === null) {
    return;
  }

  const description = window.prompt(t("prompt.noteEdit"), task.description || "");
  if (description === null) {
    return;
  }

  const dueAfterHours = window.prompt(t("prompt.dueHours"), task.dueAfterHours || 0);
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  render();
  showToast(t("message.maintenanceTypeUpdated"));
}

async function deleteMaintenanceTask(id) {
  const task = maintenanceTaskById(id);
  const label = task ? task.name : t("settings.maintenance");

  if (!window.confirm(language() === "en"
    ? `Remove ${label} from the available maintenance types? Existing history remains available.`
    : `${label} aus den verfügbaren Wartungen entfernen? Vorhandene Historie bleibt erhalten.`)) {
    return;
  }

  const response = await fetch(`/api/maintenance-tasks/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  render();
  showToast(t("message.maintenanceTypeRemoved"));
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
    throw new Error(body.error || t("message.savedGenericError"));
  }

  state.data = body;
  form.reset();
  form.elements.printerId.value = printerId;
  form.elements.performedAt.value = todayInputValue();
  elements.maintenanceTaskSelect.innerHTML = maintenanceTaskOptions();
  renderMaintenanceHistory(printerId);
  render();
  showToast(t("message.maintenanceSaved"));
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
    await submitForm(event.currentTarget, "/api/materials", t("message.savedMaterial"));
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
    await submitForm(event.currentTarget, "/api/storage-locations", language() === "en" ? "Storage location was saved." : "Lagerplatz wurde gespeichert.");
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
    await submitForm(event.currentTarget, "/api/printers", language() === "en" ? "Printer was saved." : "Drucker wurde gespeichert.");
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
    await submitForm(event.currentTarget, "/api/users", language() === "en" ? "User was saved." : "User wurde gespeichert.");
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

elements.languageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await updateLanguageSettings(event.currentTarget);
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
