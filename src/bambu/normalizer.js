const STATE_MAP = {
  FINISH: "finish",
  FAILED: "failed",
  IDLE: "idle",
  INIT: "idle",
  OFFLINE: "offline",
  PAUSE: "pause",
  PAUSED: "pause",
  PREPARE: "running",
  RUNNING: "running",
  SLICING: "running",
  PRINTING: "running"
};

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableInteger(value) {
  const number = nullableNumber(value);
  return number === null ? null : Math.round(number);
}

function nullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeState(value) {
  const text = nullableString(value);
  if (!text) {
    return "unknown";
  }
  return STATE_MAP[text.toUpperCase()] || text.toLowerCase() || "unknown";
}

function normalizeModel(value) {
  return nullableString(value)?.toUpperCase() || "UNKNOWN";
}

function hasActivePrintSignal({ progressPercent, remainingMinutes, currentLayer, currentFile, subtaskName, nozzleTemp, nozzleTargetTemp, bedTemp, bedTargetTemp }) {
  const hasProgress = progressPercent > 0 && progressPercent < 100;
  const hasTime = remainingMinutes > 0;
  const hasFile = Boolean(currentFile || subtaskName);
  const hasHotTemperatures = nozzleTemp > 100 ||
    nozzleTargetTemp > 100 ||
    bedTemp > 40 ||
    bedTargetTemp > 40;

  return hasProgress ||
    hasTime ||
    hasFile ||
    hasHotTemperatures ||
    (currentLayer > 0 && (hasTime || hasFile || hasHotTemperatures));
}

function normalizeModelSpecificState(state, printer, signals) {
  if (state !== "unknown") {
    return state;
  }
  if (hasActivePrintSignal(signals)) {
    return "running";
  }
  if (normalizeModel(printer.model) === "P1S") {
    return "idle";
  }
  return state;
}

function jsonOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function normalizeColorHex(value) {
  const text = nullableString(value);
  if (!text) {
    return null;
  }
  const hex = text.replace(/^#/, "").trim();
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return `#${hex.slice(0, 6).toUpperCase()}`;
  }
  return null;
}

function normalizeTrayMaterial(tray, source) {
  const data = objectOrNull(tray);
  if (!data) {
    return null;
  }

  const materialType = nullableString(data.tray_type ?? data.type ?? data.filament_type);
  const brand = nullableString(data.tray_sub_brands ?? data.sub_brand ?? data.brand ?? data.vendor);
  const name = nullableString(data.tray_id_name ?? data.name ?? data.material);
  const colorHex = normalizeColorHex(data.tray_color ?? data.color ?? data.color_hex);
  const trayId = nullableString(data.id ?? data.tray_id ?? data.tray_index);

  if (!materialType && !brand && !name && !colorHex) {
    return null;
  }

  return {
    source,
    trayId,
    type: materialType,
    brand,
    name,
    colorHex
  };
}

function activeTrayIds(ams) {
  const ids = [
    ams?.tray_now,
    ams?.tray_tar,
    ams?.tray_pre
  ]
    .map((value) => nullableString(value))
    .filter((value) => value && value !== "254" && value !== "255");

  return [...new Set(ids)];
}

function amsTrayMaterials(ams) {
  const units = Array.isArray(ams?.ams) ? ams.ams : [];
  return units.flatMap((unit) => {
    const unitId = nullableString(unit?.id);
    const trays = Array.isArray(unit?.tray) ? unit.tray : [];
    return trays
      .map((tray) => normalizeTrayMaterial(tray, "ams"))
      .filter(Boolean)
      .map((material) => ({
        ...material,
        amsId: unitId
      }));
  });
}

function currentMaterialFromPrint(print) {
  const virtualTray = normalizeTrayMaterial(print.vt_tray, "vt_tray");
  if (virtualTray) {
    return virtualTray;
  }

  const ams = objectOrNull(print.ams);
  const materials = amsTrayMaterials(ams);
  if (!materials.length) {
    return null;
  }

  const activeIds = activeTrayIds(ams);
  return materials.find((material) => activeIds.includes(material.trayId)) || materials[0] || null;
}

export function normalizeBambuStatus(rawPayload, printer = {}) {
  const payload = objectOrNull(rawPayload) || {};
  const print = objectOrNull(payload.print) || {};
  const printInfo = objectOrNull(print.info) || {};
  const chamberControl = objectOrNull(print.ctc) || {};
  const chamberControlInfo = objectOrNull(chamberControl.info) || {};
  let state = normalizeState(print.gcode_state || print.print_status || print.state);
  const progressPercent = nullableInteger(print.mc_percent ?? print.progress_percent ?? print.percent);
  const remainingMinutes = nullableInteger(print.mc_remaining_time ?? print.remaining_minutes);
  const currentLayer = nullableInteger(print.layer_num ?? print.current_layer);
  const currentFile = nullableString(print.gcode_file ?? print.file);
  const subtaskName = nullableString(print.subtask_name);
  const nozzleTemp = nullableNumber(print.nozzle_temper ?? print.nozzle_temp);
  const nozzleTargetTemp = nullableNumber(print.nozzle_target_temper ?? print.nozzle_target_temp);
  const bedTemp = nullableNumber(print.bed_temper ?? print.bed_temp);
  const bedTargetTemp = nullableNumber(print.bed_target_temper ?? print.bed_target_temp);

  state = normalizeModelSpecificState(state, printer, {
    progressPercent,
    remainingMinutes,
    currentLayer,
    currentFile,
    subtaskName,
    nozzleTemp,
    nozzleTargetTemp,
    bedTemp,
    bedTargetTemp
  });

  return {
    printerId: printer.id ?? null,
    online: true,
    state,
    progressPercent,
    remainingMinutes,
    nozzleTemp,
    nozzleTargetTemp,
    bedTemp,
    bedTargetTemp,
    chamberTemp: nullableNumber(print.chamber_temper ?? print.chamber_temp ?? printInfo.temp ?? chamberControlInfo.temp),
    currentLayer,
    totalLayers: nullableInteger(print.total_layer_num ?? print.total_layers),
    currentFile,
    subtaskName,
    currentMaterialJson: jsonOrNull(currentMaterialFromPrint(print)),
    amsStatusJson: jsonOrNull(print.ams),
    hmsErrorsJson: jsonOrNull(print.hms),
    rawJson: jsonOrNull(payload)
  };
}

export function mergeBambuStatus(previousStatus, nextStatus) {
  if (!previousStatus) {
    return nextStatus;
  }
  if (previousStatus.online === false && nextStatus.online === true) {
    return nextStatus;
  }

  const merged = { ...nextStatus };
  for (const key of [
    "progressPercent",
    "remainingMinutes",
    "nozzleTemp",
    "nozzleTargetTemp",
    "bedTemp",
    "bedTargetTemp",
    "chamberTemp",
    "currentLayer",
    "totalLayers",
    "currentFile",
    "subtaskName",
    "currentMaterialJson",
    "amsStatusJson",
    "hmsErrorsJson"
  ]) {
    if (merged[key] === null || merged[key] === undefined || merged[key] === "") {
      merged[key] = previousStatus[key] ?? null;
    }
  }

  if (merged.state === "unknown" && previousStatus.state && previousStatus.state !== "unknown") {
    merged.state = previousStatus.state;
  }
  if ((merged.state === "unknown" || merged.state === "idle") && hasActivePrintSignal(merged)) {
    merged.state = "running";
  }

  return merged;
}

export function createOfflineStatus(printer, state = "offline") {
  return {
    printerId: printer.id,
    online: false,
    state,
    progressPercent: null,
    remainingMinutes: null,
    nozzleTemp: null,
    nozzleTargetTemp: null,
    bedTemp: null,
    bedTargetTemp: null,
    chamberTemp: null,
    currentLayer: null,
    totalLayers: null,
    currentFile: null,
    subtaskName: null,
    currentMaterialJson: null,
    amsStatusJson: null,
    hmsErrorsJson: null,
    rawJson: null
  };
}

export function createConnectedStatus(printer, state = "unknown") {
  return {
    printerId: printer.id,
    online: true,
    state,
    progressPercent: null,
    remainingMinutes: null,
    nozzleTemp: null,
    nozzleTargetTemp: null,
    bedTemp: null,
    bedTargetTemp: null,
    chamberTemp: null,
    currentLayer: null,
    totalLayers: null,
    currentFile: null,
    subtaskName: null,
    currentMaterialJson: null,
    amsStatusJson: null,
    hmsErrorsJson: null,
    rawJson: null
  };
}
