// @ts-nocheck
export async function api(path: string, body?: any, init: RequestInit = {}) {
  try {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");

    const hasBody = body !== undefined && body !== null;
    let requestInit: RequestInit = {
      ...init,
      headers,
      cache: init.cache || "no-store",
      credentials: init.credentials || "same-origin",
    };

    if (hasBody) {
      headers.set("Content-Type", headers.get("Content-Type") || "application/json");
      requestInit = {
        ...requestInit,
        method: init.method || "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      };
    }

    const res = await fetch(path, requestInit);
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok && data && typeof data === "object") data.status = res.status;
    return data;
  } catch (_e) {
    return { ok: false, msg: "network", reasonCode: "NETWORK" };
  }
}
