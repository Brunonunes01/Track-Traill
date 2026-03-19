import { createStackNavigator } from "@react-navigation/stack";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { auth } from "../../services/connectionFirebase";
import DrawerNavigator from "../../src/navigation/DrawerNavigator";
import ActivityViewScreen from "../../src/screens/ActivityViewScreen";
import AdminDashboardScreen from "../../src/screens/AdminDashboardScreen";
import ActivitySummaryScreen from "../../src/screens/ActivitySummaryScreen";
import AlertDetailScreen from "../../src/screens/AlertDetailScreen";
import AlertFormScreen from "../../src/screens/AlertFormScreen";
import AtividadesScreen from "../../src/screens/AtividadesScreen";
import CartScreen from "../../src/screens/CartScreen";
import CheckoutScreen from "../../src/screens/CheckoutScreen";
import HomeScreen from "../../src/screens/HomeScreen";
import LoginScreen from "../../src/screens/LoginScreen";
import RegisterScreen from "../../src/screens/RegisterScreen";
import RouteDetailScreen from "../../src/screens/RouteDetailScreen";
import SuggestRouteScreen from "../../src/screens/SuggestRouteScreen";

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  DashboardScreen: undefined; 
  CartScreen: undefined;
  ActivityView: any; // <-- CORRIGIDO AQUI DE "Activity" PARA "ActivityView"
  Atividades: any; 
  Checkout: undefined;
  SuggestRoute: undefined; 
  AdminDashboard: undefined;
  RouteDetail: any;
  AlertForm: any;
  AlertDetail: any;
  ActivitySummary: any;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootStack() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  return (
    <Stack.Navigator
      initialRouteName={user ? "DashboardScreen" : "Login"}
      screenOptions={{ headerShown: false }}
    >
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="DashboardScreen" component={DrawerNavigator} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="CartScreen" component={CartScreen} />
          <Stack.Screen name="ActivityView" component={ActivityViewScreen} />
          <Stack.Screen name="Atividades" component={AtividadesScreen} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} />
          <Stack.Screen name="SuggestRoute" component={SuggestRouteScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="RouteDetail" component={RouteDetailScreen} />
          <Stack.Screen name="AlertForm" component={AlertFormScreen} />
          <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
          <Stack.Screen name="ActivitySummary" component={ActivitySummaryScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
