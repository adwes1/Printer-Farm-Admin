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

function hasActivePrintSignal({ progressPercent, remainingMinutes, currentLayer, currentFile, subtaskName }) {
  return (progressPercent > 0 && progressPercent < 100) ||
    remainingMinutes > 0 ||
    currentLayer > 0 ||
    Boolean(currentFile || subtaskName);
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

  state = normalizeModelSpecificState(state, printer, {
    progressPercent,
    remainingMinutes,
    currentLayer,
    currentFile,
    subtaskName
  });

  return {
    printerId: printer.id ?? null,
    online: true,
    state,
    progressPercent,
    remainingMinutes,
    nozzleTemp: nullableNumber(print.nozzle_temper ?? print.nozzle_temp),
    nozzleTargetTemp: nullableNumber(print.nozzle_target_temper ?? print.nozzle_target_temp),
    bedTemp: nullableNumber(print.bed_temper ?? print.bed_temp),
    bedTargetTemp: nullableNumber(print.bed_target_temper ?? print.bed_target_temp),
    chamberTemp: nullableNumber(print.chamber_temper ?? print.chamber_temp ?? printInfo.temp ?? chamberControlInfo.temp),
    currentLayer,
    totalLayers: nullableInteger(print.total_layer_num ?? print.total_layers),
    currentFile,
    subtaskName,
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
    amsStatusJson: null,
    hmsErrorsJson: null,
    rawJson: null
  };
}
