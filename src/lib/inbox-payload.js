export function encodeInboxLocation({ latitude, longitude, name, address } = {}) {
  return JSON.stringify({
    type: "location",
    latitude: Number(latitude),
    longitude: Number(longitude),
    name: name ? String(name).trim() : null,
    address: address ? String(address).trim() : null,
  });
}

export function parseInboxLocation(message) {
  if (!message) return null;
  const mime = String(message.mediaType || "").toLowerCase();
  const raw = String(message.body || "").trim();
  let data = null;
  if (raw.startsWith("{")) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const isLocation = mime === "location" || data?.type === "location";
  if (!isLocation) return null;
  const latitude = Number(data?.latitude);
  const longitude = Number(data?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return mime === "location" ? { latitude: null, longitude: null, name: data?.name || null, address: data?.address || null } : null;
  }
  return {
    latitude,
    longitude,
    name: data?.name ? String(data.name) : null,
    address: data?.address ? String(data.address) : null,
  };
}

export function mapsUrl(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

export function isVoiceAudioMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  return mime.includes("ogg") || mime.includes("opus");
}
