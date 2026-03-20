import React from "react";
import AdminDashboardScreen from "../src/screens/AdminDashboardScreen";
import { useExpoNavigationBridge } from "../src/navigation/useExpoNavigationBridge";

export default function AdminRoute() {
  const navigation = useExpoNavigationBridge();
  return <AdminDashboardScreen navigation={navigation as any} />;
}
