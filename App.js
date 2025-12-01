// App.js
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import React, { useEffect, useState } from "react";
import { CartProvider } from "./src/context/CartContext";

import DrawerNavigator from "./src/navigation/DrawerNavigator";
import ActivityViewScreen from "./src/screens/ActivityViewScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

import { auth } from "./src/services/connectionFirebase";

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((usr) => {
      setUser(usr);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return null;

  return (
    <CartProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="ActivityView" component={ActivityViewScreen} />
            </>
          ) : (
            <>
              {/* ✅ Drawer principal */}
              <Stack.Screen name="Drawer" component={DrawerNavigator} />

              {/* ✅ Tela DETALHE fora do Drawer */}
              <Stack.Screen
                name="ActivityView"
                component={ActivityViewScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </CartProvider>
  );
}
