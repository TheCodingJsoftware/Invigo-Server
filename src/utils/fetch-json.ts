export async function fetchJSON<T>(url: string): Promise<T> {
    const res = await window.fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<T>;
}