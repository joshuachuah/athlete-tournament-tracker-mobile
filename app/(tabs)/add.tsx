import { Link, Redirect } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Search, PlusCircle } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function AddScreen() {
  const { profile, session } = useAuth();

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
          }}
        >
          Add tournament
        </Text>
        <Text
          style={{ color: colors.foreground, fontSize: 30, fontWeight: "900" }}
          selectable
        >
          Build a server-backed P&L projection.
        </Text>
      </View>

      <Card>
        <PlusCircle color={colors.accent} size={26} />
        <Text
          style={{ color: colors.foreground, fontSize: 19, fontWeight: "800" }}
          selectable
        >
          Start from scratch
        </Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
          Enter dates, prize rounds, travel costs, subsidies, and spending plan
          across the five-step wizard.
        </Text>
        <Link href="/tournaments/new/details" asChild>
          <Button label="Open wizard" />
        </Link>
      </Card>

      <Card>
        <Search color={colors.accent} size={26} />
        <Text
          style={{ color: colors.foreground, fontSize: 19, fontWeight: "800" }}
          selectable
        >
          Search known tournaments
        </Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
          Find server-provided tournament records and prefill the wizard with
          known dates, location, currency, and prize estimates.
        </Text>
        <Link href="/search" asChild>
          <Button label="Search tournaments" variant="secondary" />
        </Link>
      </Card>
    </ScrollView>
  );
}
