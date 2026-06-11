import { afterEach, describe, expect, it, vi } from "vitest";
import { checkUsername, startEmailLogin, OFFLINE_ERROR_MESSAGE } from "../lib/api";

function okJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function networkError(): TypeError {
  // undici/fetch surfaces connection failures as TypeError("fetch failed")
  return new TypeError("fetch failed");
}

describe("api client timeout + retry policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries an idempotent GET exactly once on a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce(okJsonResponse({ available: true, reason: null }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkUsername("houston");

    expect(result).toEqual({ available: true, reason: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails a GET with one consistent offline message after the single retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(networkError());
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkUsername("houston")).rejects.toThrow(
      OFFLINE_ERROR_MESSAGE
    );
    // initial attempt + exactly 1 retry, never more
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a POST — fails immediately with the offline message", async () => {
    const fetchMock = vi.fn().mockRejectedValue(networkError());
    vi.stubGlobal("fetch", fetchMock);

    await expect(startEmailLogin("h@example.com")).rejects.toThrow(
      OFFLINE_ERROR_MESSAGE
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a GET on timeout-style abort errors", async () => {
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce(okJsonResponse({ available: false, reason: "taken" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkUsername("taken-name");

    expect(result).toEqual({ available: false, reason: "taken" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not swallow non-network errors", async () => {
    const weird = new Error("something unrelated blew up");
    const fetchMock = vi.fn().mockRejectedValue(weird);
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkUsername("houston")).rejects.toThrow(
      "something unrelated blew up"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes an abort signal (default timeout) to fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJsonResponse({ available: true, reason: null }));
    vi.stubGlobal("fetch", fetchMock);

    await checkUsername("houston");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
