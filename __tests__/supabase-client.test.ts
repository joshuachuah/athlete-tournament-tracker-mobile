import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ auth: {} })),
}));

jest.mock("react-native-url-polyfill/auto", () => ({}));

const mockCreateClient = jest.mocked(createClient);
const mockSecureStore = jest.mocked(SecureStore);

type SupabaseModule = typeof import("@/lib/supabase");

function loadSupabaseModule(): SupabaseModule {
  let loaded: SupabaseModule | undefined;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a synchronous import after each env change
    loaded = require("@/lib/supabase") as SupabaseModule;
  });

  if (!loaded) {
    throw new Error("Supabase module did not load");
  }

  return loaded;
}

describe("Supabase client configuration", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  });

  afterAll(() => {
    if (originalUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    }
  });

  it("creates a PKCE-only client that never reads sessions from the URL", () => {
    const module = loadSupabaseModule();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          persistSession: true,
        }),
      }),
    );
    expect(module.hasSupabaseConfig).toBe(true);
    expect(module.supabase).toBe(mockCreateClient.mock.results[0]?.value);
  });

  it("persists the session through SecureStore", async () => {
    loadSupabaseModule();
    const options = mockCreateClient.mock.calls[0]?.[2];

    if (!options?.auth?.storage) {
      throw new Error("Supabase client storage was not configured");
    }

    await options.auth.storage.getItem("k");
    await options.auth.storage.setItem("k", "v");
    await options.auth.storage.removeItem("k");

    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith("k");
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith("k", "v");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith("k");
  });

  it.each([
    [undefined, undefined],
    ["https://example.supabase.co", undefined],
    [undefined, "publishable-key"],
  ])("exports a null client when config is incomplete", (url, key) => {
    if (url === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = url;
    }

    if (key === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
    }

    const module = loadSupabaseModule();

    expect(module.hasSupabaseConfig).toBe(false);
    expect(module.supabase).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
