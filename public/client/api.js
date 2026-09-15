export async function getJson(url, { timeoutMs = 60_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Yahoo took too long to respond. Refresh the page to retry loading your leagues.");
    }
    if (error instanceof TypeError) {
      throw new Error("The app could not reach the local server. Check that it is running and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
