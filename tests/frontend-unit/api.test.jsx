import { getJson } from "../../frontend/src/lib/api";

describe("api getJson", () => {
  test("deduplicates concurrent GET requests for the same URL", async () => {
    const response = {
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ items: [1, 2, 3] })),
    };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      getJson("/api/courses/1/posts/"),
      getJson("/api/courses/1/posts/"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ items: [1, 2, 3] });
    expect(second).toEqual({ items: [1, 2, 3] });
  });

  test("allows a new request after the previous one settles", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ items: [1] })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ items: [2] })),
      });
    vi.stubGlobal("fetch", fetchMock);

    await getJson("/api/courses/");
    await getJson("/api/courses/");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
