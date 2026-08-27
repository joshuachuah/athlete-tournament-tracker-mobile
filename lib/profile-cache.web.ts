let cachedProfile: string | null = null;

export function readProfileCache(): string | null {
  return cachedProfile;
}

export function writeProfileCache(value: string): void {
  cachedProfile = value;
}

export function clearProfileCache(): void {
  cachedProfile = null;
}
