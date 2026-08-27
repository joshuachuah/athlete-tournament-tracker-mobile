import {
  clearProfileCache,
  readProfileCache,
  writeProfileCache,
} from "@/lib/profile-cache.web";

describe("web profile cache", () => {
  const browserStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: browserStorage,
    });
    clearProfileCache();
  });

  it("keeps profile data in memory instead of browser storage", () => {
    writeProfileCache('{"version":2}');

    expect(readProfileCache()).toBe('{"version":2}');
    expect(browserStorage.setItem).not.toHaveBeenCalled();
  });

  it("clears the in-memory profile", () => {
    writeProfileCache('{"version":2}');
    clearProfileCache();

    expect(readProfileCache()).toBeNull();
  });
});
