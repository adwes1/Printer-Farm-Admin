import tls from "node:tls";
import net from "node:net";
import { inflateRawSync } from "node:zlib";

const FTP_PORT = 990;
const FTP_TIMEOUT_MS = 12000;
const CACHE_SCAN_LIMIT = 80;
const MATCH_SCAN_LIMIT = 70;

function parseCode(line) {
  const match = String(line).match(/^(\d{3})(?:\s|-)(.*)$/);
  return match ? { code: Number(match[1]), text: match[2] || "" } : null;
}

function parsePassive(text) {
  const match = String(text).match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!match) {
    throw new Error("Passive FTPS Antwort konnte nicht gelesen werden.");
  }
  return {
    host: `${match[1]}.${match[2]}.${match[3]}.${match[4]}`,
    port: Number(match[5]) * 256 + Number(match[6])
  };
}

function readUntil(socket, predicate) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => cleanup(() => reject(new Error("FTPS Timeout"))), FTP_TIMEOUT_MS);

    function cleanup(done) {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      done();
    }

    function onError(error) {
      cleanup(() => reject(error));
    }

    function onData(chunk) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (predicate(lines)) {
        cleanup(() => resolve(lines.at(-1)));
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function readFtpResponse(socket, expectedCodes = []) {
  const line = await readUntil(socket, (lines) => {
    const parsed = parseCode(lines.at(-1));
    return parsed && (expectedCodes.includes(parsed.code) || parsed.code >= 400);
  });
  const parsed = parseCode(line);
  if (!parsed || !expectedCodes.includes(parsed.code)) {
    throw new Error(`FTPS Antwort: ${line}`);
  }
  return line;
}

export class BambuFtpsClient {
  constructor({ host, accessCode }) {
    this.host = host;
    this.accessCode = accessCode;
    this.socket = null;
    this.dataProtected = false;
  }

  async connect() {
    this.socket = tls.connect({
      host: this.host,
      port: FTP_PORT,
      rejectUnauthorized: false,
      timeout: FTP_TIMEOUT_MS
    });
    this.socket.setEncoding("utf8");
    await new Promise((resolve, reject) => {
      this.socket.once("secureConnect", resolve);
      this.socket.once("error", reject);
      this.socket.once("timeout", () => reject(new Error("FTPS Verbindungstimeout")));
    });
    await readFtpResponse(this.socket, [220]);
    await this.command("USER bblp", [331, 230]);
    await this.command(`PASS ${this.accessCode}`, [230]);
    await this.command("PBSZ 0", [200]).catch(() => {});
    await this.command("PROT P", [200])
      .then(() => {
        this.dataProtected = true;
      })
      .catch(() => {
        this.dataProtected = false;
      });
    await this.command("TYPE I", [200]);
  }

  close() {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
  }

  async command(command, expectedCodes) {
    this.socket.write(`${command}\r\n`);
    return readFtpResponse(this.socket, expectedCodes);
  }

  async retrieve(filePath) {
    return this.readDataCommand(`RETR ${sanitizeFtpPath(filePath)}`);
  }

  async list(directory = "") {
    const path = sanitizeFtpPath(directory);
    const data = await this.readDataCommand(path ? `NLST ${path}` : "NLST");
    return data
      .toString("utf8")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  async readDataCommand(command) {
    const passiveLine = await this.command("PASV", [227]);
    const passive = parsePassive(passiveLine);
    const passiveSocket = await this.openPlainDataSocket(passive);
    const chunks = [];
    this.socket.write(`${command}\r\n`);
    await readFtpResponse(this.socket, [125, 150]);
    const dataSocket = this.dataProtected
      ? await this.secureExistingDataSocket(passiveSocket)
      : passiveSocket;
    dataSocket.on("data", (chunk) => chunks.push(chunk));
    await new Promise((resolve, reject) => {
      dataSocket.once("end", resolve);
      dataSocket.once("close", resolve);
      dataSocket.once("error", reject);
    });
    await readFtpResponse(this.socket, [226]);
    return Buffer.concat(chunks);
  }

  async secureExistingDataSocket(socket) {
    const dataSocket = tls.connect({
      socket,
      session: this.socket.getSession?.(),
      rejectUnauthorized: false,
      timeout: FTP_TIMEOUT_MS
    });
    await new Promise((resolve, reject) => {
      dataSocket.once("secureConnect", resolve);
      dataSocket.once("error", reject);
      dataSocket.once("timeout", () => reject(new Error("FTPS Datenverbindungstimeout")));
    });
    return dataSocket;
  }

  async openPlainDataSocket(passive) {
    const dataSocket = net.connect({
      host: this.host,
      port: passive.port,
      timeout: FTP_TIMEOUT_MS
    });
    await new Promise((resolve, reject) => {
      dataSocket.once("connect", resolve);
      dataSocket.once("error", reject);
      dataSocket.once("timeout", () => reject(new Error("FTP Datenverbindungstimeout")));
    });
    return dataSocket;
  }
}

function extractGcodeThumbnail(buffer) {
  const source = buffer.toString("utf8");
  const match = source.match(/thumbnail begin[^\n]*\n([\s\S]*?)thumbnail end/i);
  if (!match) {
    return null;
  }
  const base64 = match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*;\s?/, "").trim())
    .filter(Boolean)
    .join("");
  const image = Buffer.from(base64, "base64");
  return image.subarray(1, 4).toString("ascii") === "PNG" ? image : null;
}

function readUInt16(buffer, offset) {
  return offset + 2 <= buffer.length ? buffer.readUInt16LE(offset) : null;
}

function readUInt32(buffer, offset) {
  return offset + 4 <= buffer.length ? buffer.readUInt32LE(offset) : null;
}

function extract3mfThumbnail(buffer) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (readUInt32(buffer, offset) === eocdSignature) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    return null;
  }
  const entries = readUInt16(buffer, eocd + 10) || 0;
  let offset = readUInt32(buffer, eocd + 16) || 0;
  const candidates = [];

  for (let index = 0; index < entries; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) break;
    const method = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = readUInt16(buffer, offset + 28) || 0;
    const extraLength = readUInt16(buffer, offset + 30) || 0;
    const commentLength = readUInt16(buffer, offset + 32) || 0;
    const localOffset = readUInt32(buffer, offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (/\.png$/i.test(name) && /thumbnail|Metadata|preview|plate/i.test(name)) {
      candidates.push({ name, method, compressedSize, localOffset });
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  candidates.sort((a, b) => Number(/thumbnail/i.test(b.name)) - Number(/thumbnail/i.test(a.name)));
  for (const entry of candidates) {
    const local = entry.localOffset;
    if (readUInt32(buffer, local) !== 0x04034b50) continue;
    const fileNameLength = readUInt16(buffer, local + 26) || 0;
    const extraLength = readUInt16(buffer, local + 28) || 0;
    const dataStart = local + 30 + fileNameLength + extraLength;
    const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
    const image = entry.method === 8 ? inflateRawSync(data) : data;
    if (image.subarray(1, 4).toString("ascii") === "PNG") {
      return image;
    }
  }
  return null;
}

function readZipEntry(buffer, entry) {
  const local = entry.localOffset;
  if (readUInt32(buffer, local) !== 0x04034b50) {
    return null;
  }
  const fileNameLength = readUInt16(buffer, local + 26) || 0;
  const extraLength = readUInt16(buffer, local + 28) || 0;
  const dataStart = local + 30 + fileNameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  return entry.method === 8 ? inflateRawSync(data) : data;
}

function readZipCentralDirectory(buffer) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (readUInt32(buffer, offset) === eocdSignature) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    return [];
  }
  const entries = readUInt16(buffer, eocd + 10) || 0;
  let offset = readUInt32(buffer, eocd + 16) || 0;
  const result = [];

  for (let index = 0; index < entries; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) break;
    const method = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = readUInt16(buffer, offset + 28) || 0;
    const extraLength = readUInt16(buffer, offset + 30) || 0;
    const commentLength = readUInt16(buffer, offset + 32) || 0;
    const localOffset = readUInt32(buffer, offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    result.push({ name, method, compressedSize, localOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return result;
}

function layerCountFromGcode(source) {
  const explicit = [...source.matchAll(/;\s*(?:total layer number|total_layer_num|total layers?|LAYER_COUNT)\s*[:=]\s*(\d+)/ig)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite)
    .at(-1);
  if (explicit) {
    return explicit;
  }
  const layerMarkers = source.match(/^;LAYER:/gim);
  return layerMarkers ? layerMarkers.length : null;
}

function read3mfPlateInfo(buffer, plateBasename) {
  const gcodeEntry = readZipCentralDirectory(buffer).find((entry) => {
    const name = baseNameOf(entry.name);
    return /\.gcode$/i.test(name) && (!plateBasename || name === plateBasename);
  });
  if (!gcodeEntry) {
    return null;
  }
  const gcode = readZipEntry(buffer, gcodeEntry);
  if (!gcode) {
    return null;
  }
  const source = gcode.toString("utf8");
  return {
    entryName: gcodeEntry.name,
    totalLayers: layerCountFromGcode(source)
  };
}

export function extractPreviewImage(buffer, filePath = "") {
  if (/\.3mf$/i.test(filePath)) {
    return extract3mfThumbnail(buffer);
  }
  return extractGcodeThumbnail(buffer) || extract3mfThumbnail(buffer);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeFtpPath(value) {
  return String(value || "").replace(/[\r\n]/g, "").trim();
}

function filePathCandidates(filePath) {
  const normalized = String(filePath || "").replaceAll("\\", "/");
  const withoutData = normalized.replace(/^\/?data\//i, "");
  const basename = normalized.split("/").filter(Boolean).at(-1);
  return unique([
    normalized,
    normalized.replace(/^\/+/, ""),
    withoutData,
    withoutData.replace(/^\/+/, ""),
    basename,
    basename ? `Metadata/${basename}` : "",
    basename ? `/Metadata/${basename}` : "",
    basename ? `cache/${basename}` : "",
    basename ? `/cache/${basename}` : "",
    basename ? `cache/Metadata/${basename}` : "",
    basename ? `/cache/Metadata/${basename}` : "",
    basename ? `timelapse/${basename}` : "",
    basename ? `/timelapse/${basename}` : ""
  ]);
}

function isGenericBambuMetadataFile(filePath) {
  const normalized = String(filePath || "").replaceAll("\\", "/");
  return /^\/?data\/Metadata\/plate_\d+\.gcode$/i.test(normalized);
}

function baseNameOf(value) {
  return String(value || "").replaceAll("\\", "/").split("/").filter(Boolean).at(-1) || "";
}

function parentDirectoryOf(value) {
  const parts = String(value || "").replaceAll("\\", "/").split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function joinRemotePath(directory, entry) {
  const cleanEntry = String(entry || "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!directory) {
    return cleanEntry;
  }
  return `${String(directory).replace(/\/+$/, "")}/${cleanEntry}`;
}

async function discoverFileCandidates(client, filePath) {
  const basename = baseNameOf(filePath);
  if (!basename) {
    return [];
  }
  const stem = basename.replace(/(\.gcode|\.g)$/i, "");
  const normalized = String(filePath || "").replaceAll("\\", "/").replace(/^\/?data\//i, "");
  const requestedParent = parentDirectoryOf(normalized);
  const directories = unique([
    "cache",
    "/cache",
    "cache/Metadata",
    "/cache/Metadata",
    requestedParent,
    "Metadata",
    "/Metadata",
    "",
    "/",
    "timelapse",
    "/timelapse"
  ]);
  const discovered = [];

  for (const directory of directories) {
    if (discovered.length >= CACHE_SCAN_LIMIT) {
      break;
    }
    let entries = [];
    try {
      entries = await client.list(directory);
    } catch {
      continue;
    }
    for (const entry of entries.slice(0, CACHE_SCAN_LIMIT)) {
      const entryBasename = baseNameOf(entry);
      const candidate = entry.includes("/") ? entry : joinRemotePath(directory, entry);
      if (
        entryBasename === basename ||
        entryBasename.includes(basename) ||
        (stem && entryBasename.includes(stem))
      ) {
        discovered.push(candidate);
      }
    }
  }

  return unique(discovered);
}

async function discoverMatching3mfPreview(client, filePath, status = {}) {
  const expectedLayers = Number(status.totalLayers || 0);
  if (!expectedLayers) {
    return null;
  }
  const plateBasename = baseNameOf(filePath);
  const directories = ["cache", "", "/cache", "/"];
  const candidates = [];

  for (const directory of directories) {
    let entries = [];
    try {
      entries = await client.list(directory);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const candidate = entry.includes("/") ? entry : joinRemotePath(directory, entry);
      if (/\.3mf$/i.test(candidate)) {
        candidates.push(candidate);
      }
    }
  }

  const uniqueCandidates = unique(candidates).slice(0, MATCH_SCAN_LIMIT);
  for (const candidate of uniqueCandidates) {
    try {
      const file = await client.retrieve(candidate);
      const plateInfo = read3mfPlateInfo(file, plateBasename);
      if (plateInfo?.totalLayers !== expectedLayers) {
        continue;
      }
      const preview = extractPreviewImage(file, candidate);
      if (!preview) {
        continue;
      }
      return preview;
    } catch {
      continue;
    }
  }

  return null;
}

export async function readBambuPreview({ printer, filePath, status = {} }) {
  if (!filePath || !printer?.enableFileCacheLookup) {
    return null;
  }
  const client = new BambuFtpsClient({
    host: printer.ipAddress,
    accessCode: printer.accessCode
  });
  try {
    await client.connect();
    if (isGenericBambuMetadataFile(filePath)) {
      return await discoverMatching3mfPreview(client, filePath, status);
    }
    let lastError = null;
    const candidates = filePathCandidates(filePath);
    for (const candidate of candidates) {
      try {
        const file = await client.retrieve(candidate);
        const preview = extractPreviewImage(file, candidate);
        if (preview) {
          return preview;
        }
      } catch (error) {
        lastError = error;
      }
    }
    for (const candidate of await discoverFileCandidates(client, filePath)) {
      if (candidates.includes(candidate)) {
        continue;
      }
      try {
        const file = await client.retrieve(candidate);
        const preview = extractPreviewImage(file, candidate);
        if (preview) {
          return preview;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError && !String(lastError.message || "").includes("550 Failed to open file")) {
      throw lastError;
    }
    return null;
  } finally {
    client.close();
  }
}
