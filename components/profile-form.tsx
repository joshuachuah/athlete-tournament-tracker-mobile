import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { colors, spacing } from "@/constants/theme";
import type { AthleteProfile } from "@/types";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required."),
  home_country: z.string().min(1, "Country is required."),
  home_currency: z.string().length(3, "Use a 3-letter currency code."),
  sport: z.string().min(1, "Sport is required."),
  monthly_income: z.number().min(0),
  savings_balance: z.number().min(0),
  monthly_sponsorship: z.number().min(0),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm({
  profile,
  onSubmit,
  submitLabel,
  loading,
}: {
  profile?: AthleteProfile | null;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  submitLabel: string;
  loading?: boolean;
}) {
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name ?? "",
      home_country: profile?.home_country ?? "",
      home_currency: profile?.home_currency ?? "USD",
      sport: profile?.sport ?? "",
      monthly_income: profile?.monthly_income ?? 0,
      savings_balance: profile?.savings_balance ?? 0,
      monthly_sponsorship: profile?.monthly_sponsorship ?? 0,
    },
  });

  return (
    <View style={{ gap: spacing.lg }}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Input
            label="Name"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            autoCapitalize="words"
            error={errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="home_country"
        render={({ field }) => (
          <Input
            label="Home country"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            autoCapitalize="words"
            error={errors.home_country?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="home_currency"
        render={({ field }) => (
          <Input
            label="Home currency"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={(value) => field.onChange(value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            error={errors.home_currency?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="sport"
        render={({ field }) => (
          <Input
            label="Sport"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            autoCapitalize="words"
            error={errors.sport?.message}
          />
        )}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        <Controller
          control={control}
          name="monthly_income"
          render={({ field }) => (
            <MoneyInput
              label="Monthly income"
              value={field.value}
              onBlur={field.onBlur}
              onChangeValue={field.onChange}
              error={errors.monthly_income?.message}
              style={{ minWidth: 145 }}
            />
          )}
        />
        <Controller
          control={control}
          name="savings_balance"
          render={({ field }) => (
            <MoneyInput
              label="Savings"
              value={field.value}
              onBlur={field.onBlur}
              onChangeValue={field.onChange}
              error={errors.savings_balance?.message}
              style={{ minWidth: 145 }}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="monthly_sponsorship"
        render={({ field }) => (
          <MoneyInput
            label="Monthly sponsorship"
            value={field.value}
            onBlur={field.onBlur}
            onChangeValue={field.onChange}
            error={errors.monthly_sponsorship?.message}
          />
        )}
      />

      <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
        Monetary values are stored in your home currency and converted by the
        server when tournaments use another currency.
      </Text>
      <Button label={submitLabel} loading={loading} onPress={handleSubmit(onSubmit)} />
    </View>
  );
}
