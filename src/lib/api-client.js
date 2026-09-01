export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body,
    credentials: "include",
  });

  if (options.blob) {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Não foi possível concluir a operação. Tente novamente.");
    }
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a operação. Tente novamente.");
  }
  return data;
}

export function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Falha no upload."));
    };
    xhr.onerror = () => reject(new Error("Falha no upload."));
    xhr.send(formData);
  });
}
