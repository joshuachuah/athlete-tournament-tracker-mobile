import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

import { ProtectedScreen } from "@/components/auth/protected-screen";
import { colors } from "@/constants/theme";

export default function TabLayout() {
  return (
    <ProtectedScreen>
      <NativeTabs
        backgroundColor={colors.background}
        blurEffect="none"
        disableTransparentOnScrollEdge
        minimizeBehavior="onScrollDown"
        shadowColor={colors.border}
        tintColor={colors.accent}
      >
        <NativeTabs.Trigger name="dashboard">
          <Icon sf="chart.bar.fill" drawable="ic_menu_sort_by_size" />
          <Label>Dashboard</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="add">
          <Icon sf="plus.circle.fill" drawable="ic_input_add" />
          <Label>Add</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <Icon sf="person.crop.circle.fill" drawable="ic_menu_myplaces" />
          <Label>Profile</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="account">
          <Icon sf="person.text.rectangle.fill" drawable="ic_menu_manage" />
          <Label>Account</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ProtectedScreen>
  );
}
