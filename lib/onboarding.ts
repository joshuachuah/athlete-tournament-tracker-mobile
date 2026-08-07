import { z } from "zod";

import { draftStorage } from "@/lib/storage";

export type OnboardingOption = {
  value: string;
  label: string;
  detail?: string;
  badge: string;
};

type CountryOption = OnboardingOption & {
  currency: string;
};

export const OTHER_OPTION = "__other__";

export const countryOptions: CountryOption[] = [
  { value: "Malaysia", label: "Malaysia", badge: "MY", currency: "MYR" },
  { value: "Singapore", label: "Singapore", badge: "SG", currency: "SGD" },
  { value: "Australia", label: "Australia", badge: "AU", currency: "AUD" },
  { value: "New Zealand", label: "New Zealand", badge: "NZ", currency: "NZD" },
  { value: "United Kingdom", label: "United Kingdom", badge: "GB", currency: "GBP" },
  { value: "United States", label: "United States", badge: "US", currency: "USD" },
  { value: "Canada", label: "Canada", badge: "CA", currency: "CAD" },
  { value: "India", label: "India", badge: "IN", currency: "INR" },
  { value: "Egypt", label: "Egypt", badge: "EG", currency: "EGP" },
  { value: "France", label: "France", badge: "FR", currency: "EUR" },
  { value: "Germany", label: "Germany", badge: "DE", currency: "EUR" },
  { value: "Netherlands", label: "Netherlands", badge: "NL", currency: "EUR" },
  { value: "Spain", label: "Spain", badge: "ES", currency: "EUR" },
  { value: "Switzerland", label: "Switzerland", badge: "CH", currency: "CHF" },
  { value: "United Arab Emirates", label: "United Arab Emirates", badge: "AE", currency: "AED" },
  { value: "Qatar", label: "Qatar", badge: "QA", currency: "QAR" },
  { value: "Hong Kong", label: "Hong Kong", badge: "HK", currency: "HKD" },
  { value: "Japan", label: "Japan", badge: "JP", currency: "JPY" },
  { value: "South Korea", label: "South Korea", badge: "KR", currency: "KRW" },
  { value: OTHER_OPTION, label: "Another country", badge: "+", currency: "" },
];

const currencyNames: Record<string, string> = {
  AED: "UAE Dirham",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar",
  CHF: "Swiss Franc",
  EGP: "Egyptian Pound",
  EUR: "Euro",
  GBP: "British Pound",
  HKD: "Hong Kong Dollar",
  INR: "Indian Rupee",
  JPY: "Japanese Yen",
  KRW: "South Korean Won",
  MYR: "Malaysian Ringgit",
  NZD: "New Zealand Dollar",
  QAR: "Qatari Riyal",
  SGD: "Singapore Dollar",
  USD: "US Dollar",
};

export const currencyOptions: OnboardingOption[] = [
  ...Object.entries(currencyNames).map(([code, name]) => ({
    value: code,
    label: code,
    detail: name,
    badge: code,
  })),
  {
    value: OTHER_OPTION,
    label: "Another currency",
    detail: "Enter a three-letter currency code",
    badge: "+",
  },
];

export const sportOptions: OnboardingOption[] = [
  { value: "Squash", label: "Squash", badge: "S" },
  { value: "Tennis", label: "Tennis", badge: "T" },
  { value: "Badminton", label: "Badminton", badge: "B" },
  { value: OTHER_OPTION, label: "Other", badge: "+" },
];

export function suggestedCurrency(country: string): string | null {
  return countryOptions.find((option) => option.value === country)?.currency || null;
}

export function currencyLabel(currency: string): string {
  const code = currency.toUpperCase();
  const name = currencyNames[code];
  return name ? `${code} — ${name}` : code;
}

const onboardingDraftSchema = z.strictObject({
  version: z.literal(1),
  step: z.number().int().min(1).max(4),
  name: z.string(),
  country: z.string(),
  currency: z.string(),
  sport: z.string(),
  customCountry: z.boolean(),
  customCurrency: z.boolean(),
  customSport: z.boolean(),
});

export type OnboardingDraft = Omit<
  z.infer<typeof onboardingDraftSchema>,
  "version"
>;

function onboardingDraftStorageKey(userId: string): string {
  return `athlete-tracker:onboarding-draft:${userId}`;
}

export function getOnboardingDraft(userId: string): OnboardingDraft | null {
  const result = onboardingDraftSchema.safeParse(
    draftStorage.get(onboardingDraftStorageKey(userId)),
  );

  if (!result.success) {
    draftStorage.clear(onboardingDraftStorageKey(userId));
    return null;
  }

  const { version: _version, ...draft } = result.data;
  return draft;
}

export function saveOnboardingDraft(
  userId: string,
  draft: OnboardingDraft,
): void {
  draftStorage.set(onboardingDraftStorageKey(userId), {
    version: 1,
    ...draft,
  });
}

export function clearOnboardingDraft(userId: string): void {
  draftStorage.clear(onboardingDraftStorageKey(userId));
}
