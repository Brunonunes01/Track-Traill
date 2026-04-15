import React from "react";
import DashboardScreen from "../src/screens/DashboardScreen";
import { useExpoNavigationBridge } from "../src/navigation/useExpoNavigationBridge";

export default function HistoryRoute() {
  const navigation = useExpoNavigationBridge();
  return <DashboardScreen navigation={navigation as any} />;
}
