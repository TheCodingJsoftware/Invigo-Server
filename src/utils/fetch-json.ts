export async function fetchResponse(url: string): Promise<Response> {
    const res = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    if (!res.ok) throw new Error(await res.text());
    return res;
}

export async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetchResponse(url);
    return res.json() as Promise<T>;
}