// @ts-nocheck
export async function api(path: string, body?: any) {
  try {
    const res = body
      ? await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(path);
    return await res.json();
  } catch (_e) {
    return { ok: false, msg: "network" };
  }
}
