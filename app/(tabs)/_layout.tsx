import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

import { colors } from "@/constants/theme";

export default function TabLayout() {
  return (
    <NativeTabs tintColor={colors.accent} minimizeBehavior="onScrollDown">
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
    </NativeTabs>
  );
}
