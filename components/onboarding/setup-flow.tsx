import * as Haptics from "expo-haptics";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  LogOut,
  Mail,
  MapPin,
  Trash2,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SelectionSheet } from "@/components/onboarding/selection-sheet";
import { colors, radii, spacing } from "@/constants/theme";
import {
  countryOptions,
  currencyLabel,
  currencyOptions,
  getOnboardingDraft,
  OTHER_OPTION,
  type OnboardingDraft,
  saveOnboardingDraft,
  sportOptions,
  suggestedCurrency,
} from "@/lib/onboarding";

export type SetupProfileValues = {
  name: string;
  home_country: string;
  home_currency: string;
  sport: string;
  monthly_income: number;
  savings_balance: number;
  monthly_sponsorship: number;
};

type SheetType = "country" | "currency" | null;

const initialDraft = (userId: string, initialName: string): OnboardingDraft =>
  getOnboardingDraft(userId) ?? {
    step: 1,
    name: initialName,
    country: "",
    currency: "",
    sport: "",
    customCountry: false,
    customCurrency: false,
    customSport: false,
  };

function selectionFeedback() {
  if (process.env.EXPO_OS === "ios") {
    Haptics.selectionAsync().catch(() => undefined);
  }
}

export function SetupFlow({
  email,
  initialName,
  saving,
  serverError,
  userId,
  onComplete,
  onDeleteAccount,
  onSignOut,
}: {
  email: string;
  initialName: string;
  saving: boolean;
  serverError: string | null;
  userId: string;
  onComplete: (values: SetupProfileValues) => Promise<void>;
  onDeleteAccount: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => initialDraft(userId, initialName));
  const [sheet, setSheet] = useState<SheetType>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    saveOnboardingDraft(userId, draft);
  }, [draft, userId]);

  function updateDraft(values: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...values }));
    setValidationError(null);
  }

  function moveToStep(step: number) {
    updateDraft({ step: Math.max(1, Math.min(4, step)) });
    selectionFeedback();
  }

  function chooseCountry(value: string) {
    if (value === OTHER_OPTION) {
      updateDraft({
        country: "",
        currency: "",
        customCountry: true,
        customCurrency: true,
      });
    } else {
      updateDraft({
        country: value,
        currency: suggestedCurrency(value) ?? "",
        customCountry: false,
        customCurrency: false,
      });
    }

    setSheet(null);
    selectionFeedback();
  }

  function chooseCurrency(value: string) {
    if (value === OTHER_OPTION) {
      updateDraft({ currency: "", customCurrency: true });
    } else {
      updateDraft({ currency: value, customCurrency: false });
    }

    setSheet(null);
    selectionFeedback();
  }

  function chooseSport(value: string) {
    if (value === OTHER_OPTION) {
      updateDraft({ sport: "", customSport: true });
    } else {
      updateDraft({ sport: value, customSport: false });
    }

    selectionFeedback();
  }

  async function continueSetup() {
    if (draft.step === 1) {
      if (!draft.name.trim()) {
        setValidationError("Add your name to continue.");
        return;
      }

      moveToStep(2);
      return;
    }

    if (draft.step === 2) {
      if (!draft.country.trim()) {
        setValidationError("Choose or enter your home country.");
        return;
      }

      if (!/^[A-Za-z]{3}$/.test(draft.currency.trim())) {
        setValidationError("Choose or enter a three-letter currency code.");
        return;
      }

      moveToStep(3);
      return;
    }

    if (draft.step === 3) {
      if (!draft.sport.trim()) {
        setValidationError("Choose or enter your primary sport.");
        return;
      }

      moveToStep(4);
      return;
    }

    await onComplete({
      name: draft.name.trim(),
      home_country: draft.country.trim(),
      home_currency: draft.currency.trim().toUpperCase(),
      sport: draft.sport.trim(),
      monthly_income: 0,
      savings_balance: 0,
      monthly_sponsorship: 0,
    });
  }

  async function signOut() {
    setSigningOut(true);
    setValidationError(null);

    try {
      await onSignOut();
    } catch (error) {
      setValidationError((error as Error).message);
      setSigningOut(false);
    }
  }

  const firstName = draft.name.trim().split(/\s+/)[0] || "Athlete";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <SetupHeader
          onPrevious={() => moveToStep(draft.step - 1)}
          step={draft.step}
        />

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {draft.step === 1 ? (
            <ProfileStep
              draft={draft}
              email={email}
              error={validationError}
              onChangeName={(name) => updateDraft({ name })}
            />
          ) : null}
          {draft.step === 2 ? (
            <HomeStep
              draft={draft}
              error={validationError}
              onChangeCountry={(country) => updateDraft({ country })}
              onChangeCurrency={(currency) =>
                updateDraft({ currency: currency.toUpperCase() })
              }
              onOpenCountry={() => setSheet("country")}
              onOpenCurrency={() => setSheet("currency")}
            />
          ) : null}
          {draft.step === 3 ? (
            <SportStep
              draft={draft}
              error={validationError}
              onChangeCustomSport={(sport) => updateDraft({ sport })}
              onChooseSport={chooseSport}
            />
          ) : null}
          {draft.step === 4 ? (
            <ReviewStep
              draft={draft}
              firstName={firstName}
              onEdit={moveToStep}
            />
          ) : null}

          {serverError ? (
            <Text accessibilityRole="alert" selectable style={styles.errorText}>
              {serverError}
            </Text>
          ) : null}
        </ScrollView>

        <SetupFooter
          onContinue={continueSetup}
          onDeleteAccount={onDeleteAccount}
          onSignOut={signOut}
          saving={saving}
          signingOut={signingOut}
          step={draft.step}
        />
      </KeyboardAvoidingView>

      {sheet === "country" ? (
        <SelectionSheet
          onClose={() => setSheet(null)}
          onSelect={chooseCountry}
          options={countryOptions}
          selectedValue={draft.customCountry ? OTHER_OPTION : draft.country}
          title="Choose your home country"
        />
      ) : null}
      {sheet === "currency" ? (
        <SelectionSheet
          onClose={() => setSheet(null)}
          onSelect={chooseCurrency}
          options={currencyOptions}
          selectedValue={draft.customCurrency ? OTHER_OPTION : draft.currency}
          title="Choose your home currency"
        />
      ) : null}
    </SafeAreaView>
  );
}

function SetupHeader({
  step,
  onPrevious,
}: {
  step: number;
  onPrevious: () => void;
}) {
  return (
    <>
      <View style={styles.header}>
        {step > 1 ? (
          <Pressable
            accessibilityLabel="Previous setup screen"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPrevious}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
          >
            <ChevronLeft
              color={colors.foreground}
              size={24}
              strokeWidth={2.2}
            />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Guided setup</Text>
          <Text style={styles.stepText}>{step} of 4</Text>
        </View>
        <View style={styles.headerButton} />
      </View>
      <View
        accessibilityLabel={`Setup progress: step ${step} of 4`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: 4, now: step }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${step * 25}%` }]} />
      </View>
    </>
  );
}

function SetupFooter({
  onContinue,
  onDeleteAccount,
  onSignOut,
  saving,
  signingOut,
  step,
}: {
  onContinue: () => Promise<void>;
  onDeleteAccount: () => void;
  onSignOut: () => Promise<void>;
  saving: boolean;
  signingOut: boolean;
  step: number;
}) {
  const primaryLabel =
    step === 3 ? "Review profile" : step === 4 ? "Finish setup" : "Continue";

  return (
    <View style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        disabled={saving || signingOut}
        onPress={onContinue}
        style={({ pressed }) => [
          styles.primaryButton,
          (saving || signingOut) && styles.disabled,
          pressed && !saving && !signingOut && styles.primaryPressed,
        ]}
      >
        {saving ? (
          <ActivityIndicator color={colors.brandForeground} />
        ) : null}
        <Text style={styles.primaryButtonText}>
          {saving ? "Saving profile…" : primaryLabel}
        </Text>
      </Pressable>

      {step === 1 ? (
        <View style={styles.accountActions}>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.accountAction,
              pressed && styles.pressed,
            ]}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.brand} size="small" />
            ) : (
              <LogOut color={colors.brand} size={15} strokeWidth={2.2} />
            )}
            <Text style={styles.accountActionText}>
              {signingOut ? "Signing out…" : "Not your account? Sign out"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onDeleteAccount}
            style={({ pressed }) => [
              styles.accountAction,
              pressed && styles.pressed,
            ]}
          >
            <Trash2 color={colors.loss} size={15} strokeWidth={2.1} />
            <Text style={styles.deleteActionText}>Delete this account</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function StepIntro({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.lead}>{body}</Text>
    </View>
  );
}

function ProfileStep({
  draft,
  email,
  error,
  onChangeName,
}: {
  draft: OnboardingDraft;
  email: string;
  error: string | null;
  onChangeName: (name: string) => void;
}) {
  return (
    <>
      <StepIntro
        body="Use the name you want shown across your season."
        title="Let’s start with you"
      />
      <View style={styles.profileCard}>
        <View style={[styles.textField, error && styles.textFieldError]}>
          <Text style={styles.fieldLabel}>Your name</Text>
          <TextInput
            accessibilityLabel="Your name"
            autoCapitalize="words"
            autoComplete="name"
            autoFocus={!draft.name}
            onChangeText={onChangeName}
            placeholder="Enter your name"
            placeholderTextColor={colors.mutedForeground}
            style={styles.nameInput}
            value={draft.name}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.inlineError}>
            {error}
          </Text>
        ) : null}
        <View style={styles.emailRow}>
          <Mail color={colors.mutedForeground} size={17} strokeWidth={2} />
          <Text numberOfLines={1} style={styles.emailText}>
            {email}
          </Text>
          <CircleCheck color={colors.profit} size={21} strokeWidth={2.4} />
        </View>
        <Text style={styles.helperText}>
          Your email is verified through your sign-in provider.
        </Text>
      </View>
    </>
  );
}

function HomeStep({
  draft,
  error,
  onChangeCountry,
  onChangeCurrency,
  onOpenCountry,
  onOpenCurrency,
}: {
  draft: OnboardingDraft;
  error: string | null;
  onChangeCountry: (country: string) => void;
  onChangeCurrency: (currency: string) => void;
  onOpenCountry: () => void;
  onOpenCurrency: () => void;
}) {
  const countryBadge =
    countryOptions.find((option) => option.value === draft.country)?.badge ?? "+";

  return (
    <>
      <StepIntro
        body="We’ll use this to keep tournament totals consistent."
        title="Where is home?"
      />
      <View style={styles.selectionStack}>
        <SelectionCard
          badge={countryBadge}
          label="Home country"
          onPress={onOpenCountry}
          placeholder="Choose a country"
          value={draft.country}
        />
        {draft.customCountry ? (
          <CustomField
            autoCapitalize="words"
            label="Country name"
            onChangeText={onChangeCountry}
            placeholder="Enter your country"
            value={draft.country}
          />
        ) : null}

        <SelectionCard
          badge={draft.currency || "$"}
          label="Home currency"
          onPress={onOpenCurrency}
          placeholder="Choose a currency"
          value={draft.currency ? currencyLabel(draft.currency) : ""}
        />
        {draft.customCurrency ? (
          <CustomField
            autoCapitalize="characters"
            label="Three-letter currency code"
            maxLength={3}
            onChangeText={onChangeCurrency}
            placeholder="e.g. MYR"
            value={draft.currency}
          />
        ) : null}
      </View>
      <Text style={styles.helperText}>
        Your country suggests a currency. You can still change it.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.inlineError}>
          {error}
        </Text>
      ) : null}
    </>
  );
}

function SelectionCard({
  badge,
  label,
  placeholder,
  value,
  onPress,
}: {
  badge: string;
  label: string;
  placeholder: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}. ${value || placeholder}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectionCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.selectionBadge}>
        <Text numberOfLines={1} style={styles.selectionBadgeText}>
          {badge}
        </Text>
      </View>
      <View style={styles.selectionCopy}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text
          numberOfLines={1}
          style={value ? styles.selectionValue : styles.selectionPlaceholder}
        >
          {value || placeholder}
        </Text>
      </View>
      <ChevronRight
        color={colors.mutedForeground}
        size={20}
        strokeWidth={2}
      />
    </Pressable>
  );
}

function CustomField({
  autoCapitalize,
  label,
  maxLength,
  placeholder,
  value,
  onChangeText,
}: {
  autoCapitalize: "characters" | "words";
  label: string;
  maxLength?: number;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.customField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={styles.customInput}
        value={value}
      />
    </View>
  );
}

function SportStep({
  draft,
  error,
  onChangeCustomSport,
  onChooseSport,
}: {
  draft: OnboardingDraft;
  error: string | null;
  onChangeCustomSport: (sport: string) => void;
  onChooseSport: (sport: string) => void;
}) {
  return (
    <>
      <StepIntro
        body="Choose your primary sport. You can change this later."
        title="What do you compete in?"
      />
      <View style={styles.sportGrid}>
        {sportOptions.map((option) => {
          const selected = option.value === OTHER_OPTION
            ? draft.customSport
            : !draft.customSport && option.value === draft.sport;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onChooseSport(option.value)}
              style={({ pressed }) => [
                styles.sportTile,
                selected && styles.sportTileSelected,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.sportBadge,
                  selected && styles.sportBadgeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.sportBadgeText,
                    selected && styles.sportBadgeTextSelected,
                  ]}
                >
                  {option.badge}
                </Text>
              </View>
              <View style={styles.sportLabelRow}>
                <Text
                  style={[
                    styles.sportLabel,
                    selected && styles.sportLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {selected ? (
                  <Check
                    color={colors.brandForeground}
                    size={18}
                    strokeWidth={2.6}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {draft.customSport ? (
        <CustomField
          autoCapitalize="words"
          label="Your primary sport"
          onChangeText={onChangeCustomSport}
          placeholder="Enter your sport"
          value={draft.sport}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.inlineError}>
          {error}
        </Text>
      ) : null}
    </>
  );
}

function ReviewStep({
  draft,
  firstName,
  onEdit,
}: {
  draft: OnboardingDraft;
  firstName: string;
  onEdit: (step: number) => void;
}) {
  return (
    <>
      <View style={styles.reviewIntro}>
        <View style={styles.readyMark}>
          <Check color={colors.brandForeground} size={34} strokeWidth={2.7} />
        </View>
        <Text accessibilityRole="header" style={styles.reviewTitle}>
          You’re ready, {firstName}
        </Text>
        <Text style={styles.reviewLead}>
          Review the athlete profile we’ll use in your dashboard.
        </Text>
      </View>
      <View style={styles.summaryGrid}>
        <SummaryTile
          label="Athlete"
          onEdit={() => onEdit(1)}
          value={draft.name}
          wide
        />
        <SummaryTile
          label="Home"
          onEdit={() => onEdit(2)}
          value={draft.country}
        />
        <SummaryTile
          label="Currency"
          onEdit={() => onEdit(2)}
          value={draft.currency.toUpperCase()}
        />
        <SummaryTile
          label="Primary sport"
          onEdit={() => onEdit(3)}
          value={draft.sport}
          wide
        />
      </View>
    </>
  );
}

function SummaryTile({
  label,
  value,
  wide = false,
  onEdit,
}: {
  label: string;
  value: string;
  wide?: boolean;
  onEdit: () => void;
}) {
  return (
    <View style={[styles.summaryTile, wide && styles.summaryTileWide]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Pressable
        accessibilityLabel={`Edit ${label.toLowerCase()}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onEdit}
        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  headerCopy: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
  },
  stepText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 3,
    marginHorizontal: spacing.xl,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  intro: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 33,
  },
  lead: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 21,
  },
  profileCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    boxShadow:
      "0 1px 2px rgba(16, 23, 18, 0.04), 0 18px 40px -24px rgba(23, 63, 49, 0.34)",
  },
  textField: {
    minHeight: 70,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  textFieldError: {
    borderColor: colors.loss,
  },
  fieldLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "700",
  },
  nameInput: {
    minHeight: 32,
    paddingVertical: 0,
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "800",
  },
  inlineError: {
    marginTop: spacing.sm,
    color: colors.loss,
    fontSize: 12,
    lineHeight: 17,
  },
  emailRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.background,
  },
  emailText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 13,
  },
  helperText: {
    marginTop: spacing.md,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  selectionStack: {
    gap: spacing.md,
  },
  selectionCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    boxShadow:
      "0 1px 2px rgba(16, 23, 18, 0.03), 0 12px 30px -22px rgba(23, 63, 49, 0.3)",
  },
  selectionBadge: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceMuted,
  },
  selectionBadgeText: {
    maxWidth: 38,
    color: colors.brand,
    fontSize: 11,
    fontWeight: "900",
  },
  selectionCopy: {
    flex: 1,
    gap: 3,
  },
  selectionValue: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
  },
  selectionPlaceholder: {
    color: colors.mutedForeground,
    fontSize: 15,
  },
  customField: {
    minHeight: 66,
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  customInput: {
    minHeight: 30,
    paddingVertical: 0,
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  sportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  sportTile: {
    width: "48%",
    minWidth: 140,
    minHeight: 116,
    flexGrow: 1,
    justifyContent: "space-between",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    boxShadow:
      "0 1px 2px rgba(16, 23, 18, 0.03), 0 12px 30px -22px rgba(23, 63, 49, 0.3)",
  },
  sportTileSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  sportBadge: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceMuted,
  },
  sportBadgeSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  sportBadgeText: {
    color: colors.brand,
    fontWeight: "900",
  },
  sportBadgeTextSelected: {
    color: colors.brandForeground,
  },
  sportLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sportLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
  },
  sportLabelSelected: {
    color: colors.brandForeground,
  },
  reviewIntro: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  readyMark: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    borderRadius: 23,
    borderCurve: "continuous",
    backgroundColor: colors.brand,
  },
  reviewTitle: {
    color: colors.foreground,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.9,
    textAlign: "center",
  },
  reviewLead: {
    maxWidth: 300,
    marginTop: spacing.sm,
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  summaryTile: {
    position: "relative",
    width: "48%",
    minWidth: 140,
    minHeight: 84,
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    boxShadow:
      "0 1px 2px rgba(16, 23, 18, 0.03), 0 12px 30px -22px rgba(23, 63, 49, 0.3)",
  },
  summaryTileWide: {
    width: "100%",
  },
  summaryValue: {
    marginTop: spacing.xs,
    marginRight: 34,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
  },
  editButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
  },
  editButtonText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  errorText: {
    marginTop: spacing.lg,
    color: colors.loss,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(23, 63, 49, 0.08)",
    backgroundColor: colors.background,
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.brand,
    boxShadow: "0 8px 20px rgba(23, 63, 49, 0.16)",
  },
  primaryPressed: {
    opacity: 0.84,
  },
  primaryButtonText: {
    color: colors.brandForeground,
    fontSize: 16,
    fontWeight: "800",
  },
  accountActions: {
    alignItems: "center",
  },
  accountAction: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  accountActionText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
  },
  deleteActionText: {
    color: colors.loss,
    fontSize: 12,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.62,
  },
});
