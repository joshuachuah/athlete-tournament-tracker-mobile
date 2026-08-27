// Global test doubles for native modules that jest-expo does not mock.
// expo-secure-store backs the profile cache and the Supabase session adapter.
jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();

  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      values.delete(key);
    },
    __reset: () => values.clear(),
  };
});

beforeEach(() => {
  const secureStore = jest.requireMock("expo-secure-store") as {
    __reset?: () => void;
  };
  secureStore.__reset?.();
});
