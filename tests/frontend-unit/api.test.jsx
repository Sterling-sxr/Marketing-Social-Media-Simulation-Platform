import { getJson } from "../../frontend/src/lib/api";

describe("api getJson", () => {
  test("returns parsed JSON for successful requests", async () => {
    const response = {
      ok: true,
      headers: { get: vi.fn().mockReturnValue("application/json") },
      text: vi.fn().mockResolvedValue(JSON.stringify({ items: [1, 2, 3] })),
    };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await getJson("/api/courses/1/posts/");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  test("surfaces a helpful message for HTML error responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
      text: vi.fn().mockResolvedValue("<html>gateway error</html>"),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/api/courses/")).rejects.toMatchObject({
      message: "Server returned an HTML error page (502). Please retry and check backend/gateway logs.",
      status: 502,
    });
  });

  test("reuses the same in-flight GET request for identical URLs", async () => {
    let resolveResponse;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(responsePromise);
    vi.stubGlobal("fetch", fetchMock);

    const first = getJson("/api/admin/dashboard/?range_days=7");
    const second = getJson("/api/admin/dashboard/?range_days=7");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse({
      ok: true,
      headers: { get: vi.fn().mockReturnValue("application/json") },
      text: vi.fn().mockResolvedValue(JSON.stringify({ summary: { total_courses: 2 } })),
    });

    await expect(first).resolves.toEqual({ summary: { total_courses: 2 } });
    await expect(second).resolves.toEqual({ summary: { total_courses: 2 } });
  });
});
