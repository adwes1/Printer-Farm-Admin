import tls from "node:tls";
import { EventEmitter } from "node:events";

function encodeString(value) {
  const buffer = Buffer.from(String(value), "utf8");
  return Buffer.concat([
    Buffer.from([buffer.length >> 8, buffer.length & 0xff]),
    buffer
  ]);
}

function encodeRemainingLength(length) {
  const bytes = [];
  let value = length;
  do {
    let digit = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) {
      digit |= 0x80;
    }
    bytes.push(digit);
  } while (value > 0);
  return Buffer.from(bytes);
}

function packet(typeAndFlags, payload) {
  return Buffer.concat([
    Buffer.from([typeAndFlags]),
    encodeRemainingLength(payload.length),
    payload
  ]);
}

function connectPacket({ clientId, username, password }) {
  const variableHeader = Buffer.concat([
    encodeString("MQTT"),
    Buffer.from([4, 0xc2, 0, 30])
  ]);
  const payload = Buffer.concat([
    encodeString(clientId),
    encodeString(username),
    encodeString(password)
  ]);
  return packet(0x10, Buffer.concat([variableHeader, payload]));
}

function subscribePacket(packetId, topic) {
  const variableHeader = Buffer.from([packetId >> 8, packetId & 0xff]);
  const payload = Buffer.concat([encodeString(topic), Buffer.from([0])]);
  return packet(0x82, Buffer.concat([variableHeader, payload]));
}

function parseRemainingLength(buffer, offset) {
  let multiplier = 1;
  let value = 0;
  let index = offset;
  let digit = 0;
  do {
    if (index >= buffer.length) {
      return null;
    }
    digit = buffer[index++];
    value += (digit & 127) * multiplier;
    multiplier *= 128;
  } while ((digit & 128) !== 0);
  return { value, bytes: index - offset };
}

function extractPackets(buffer) {
  const packets = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const length = parseRemainingLength(buffer, offset + 1);
    if (!length) {
      break;
    }
    const headerLength = 1 + length.bytes;
    const end = offset + headerLength + length.value;
    if (end > buffer.length) {
      break;
    }
    packets.push({
      type: buffer[offset] >> 4,
      flags: buffer[offset] & 0x0f,
      payload: buffer.subarray(offset + headerLength, end)
    });
    offset = end;
  }
  return { packets, rest: buffer.subarray(offset) };
}

function publishTopicAndMessage(payload, flags) {
  if (payload.length < 2) {
    return null;
  }
  const topicLength = payload.readUInt16BE(0);
  const topicStart = 2;
  const topicEnd = topicStart + topicLength;
  if (payload.length < topicEnd) {
    return null;
  }
  const qos = (flags >> 1) & 0x03;
  const packetIdStart = topicEnd;
  const messageStart = qos > 0 ? packetIdStart + 2 : topicEnd;
  if (payload.length < messageStart) {
    return null;
  }
  return {
    topic: payload.subarray(topicStart, topicEnd).toString("utf8"),
    packetId: qos > 0 ? payload.readUInt16BE(packetIdStart) : null,
    qos,
    message: payload.subarray(messageStart).toString("utf8")
  };
}

export class BambuMqttSubscriber extends EventEmitter {
  constructor({ host, serialNumber, accessCode, timeoutMs = 10000 }) {
    super();
    this.host = host;
    this.serialNumber = serialNumber;
    this.accessCode = accessCode;
    this.timeoutMs = timeoutMs;
    this.topic = `device/${serialNumber}/report`;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.packetId = 1;
    this.pingTimer = null;
  }

  connect() {
    this.socket = tls.connect({
      host: this.host,
      port: 8883,
      rejectUnauthorized: false,
      timeout: this.timeoutMs
    });

    this.socket.on("secureConnect", () => {
      this.socket.write(connectPacket({
        clientId: `pfa-${this.serialNumber}-${Date.now()}`,
        username: "bblp",
        password: this.accessCode
      }));
    });
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("timeout", () => this.emit("error", new Error("MQTT Verbindungstimeout")));
    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("close", () => {
      this.stopPing();
      this.emit("close");
    });
  }

  close() {
    this.stopPing();
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const result = extractPackets(this.buffer);
    this.buffer = result.rest;
    for (const item of result.packets) {
      this.handlePacket(item);
    }
  }

  handlePacket(item) {
    if (item.type === 2) {
      const returnCode = item.payload[1];
      if (returnCode !== 0) {
        this.emit("error", new Error(`MQTT Auth/Connect fehlgeschlagen (${returnCode})`));
        return;
      }
      this.emit("connect");
      this.socket.write(subscribePacket(this.packetId++, this.topic));
      this.startPing();
      return;
    }

    if (item.type === 3) {
      const publish = publishTopicAndMessage(item.payload, item.flags);
      if (publish) {
        if (publish.qos === 1 && publish.packetId !== null) {
          this.socket.write(Buffer.from([0x40, 0x02, publish.packetId >> 8, publish.packetId & 0xff]));
        }
        this.emit("message", publish.topic, publish.message);
      }
      return;
    }

    if (item.type === 9) {
      this.emit("subscribed");
    }
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.socket && !this.socket.destroyed) {
        this.socket.write(Buffer.from([0xc0, 0x00]));
      }
    }, 25000);
  }

  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
