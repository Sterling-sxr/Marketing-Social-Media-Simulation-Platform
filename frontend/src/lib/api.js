function parseResponseBody(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildApiError(response, data, text, fallbackLabel = "Request failed") {
  const contentType = response.headers.get("content-type") || "";
  const messageFromJson = data && typeof data === "object" ? data.error : "";
  let message = messageFromJson || `${fallbackLabel} (${response.status})`;
  if (!messageFromJson && contentType.includes("text/html")) {
    message = `Server returned an HTML error page (${response.status}). Please retry and check backend/gateway logs.`;
  } else if (!messageFromJson && data === null && text) {
    message = `${fallbackLabel} (${response.status}): ${text.slice(0, 160)}`;
  }
  const error = new Error(message);
  error.status = response.status;
  throw error;
}

const inflightGetRequests = new Map();

export async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload ?? {}),
  });

  const text = await response.text();
  const data = parseResponseBody(text);
  if (!response.ok) {
    buildApiError(response, data, text, "Request failed");
  }
  if (data === null) {
    buildApiError(response, data, text, "Invalid response");
  }
  return data;
}

export async function getJson(url) {
  if (inflightGetRequests.has(url)) {
    return inflightGetRequests.get(url);
  }

  const request = (async () => {
    const response = await fetch(url, { credentials: "include" });
    const text = await response.text();
    const data = parseResponseBody(text);
    if (!response.ok) {
      buildApiError(response, data, text, "Request failed");
    }
    if (data === null) {
      buildApiError(response, data, text, "Invalid response");
    }
    return data;
  })();

  inflightGetRequests.set(url, request);
  try {
    return await request;
  } finally {
    inflightGetRequests.delete(url);
  }
}

export async function patchJson(url, payload) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload ?? {}),
  });
  const text = await response.text();
  const data = parseResponseBody(text);
  if (!response.ok) {
    buildApiError(response, data, text, "Request failed");
  }
  if (data === null) {
    buildApiError(response, data, text, "Invalid response");
  }
  return data;
}

export async function deleteJson(url) {
  const response = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  });
  const text = await response.text();
  const data = parseResponseBody(text);
  if (!response.ok) {
    buildApiError(response, data, text, "Request failed");
  }
  if (data === null) {
    buildApiError(response, data, text, "Invalid response");
  }
  return data;
}

export async function uploadFile(url, file, fieldName = "file") {
  const formData = new FormData();
  formData.append(fieldName, file);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const text = await response.text();
  const data = parseResponseBody(text);
  if (!response.ok) {
    buildApiError(response, data, text, "Upload failed");
  }
  if (data === null) {
    buildApiError(response, data, text, "Invalid upload response");
  }
  return data;
}
