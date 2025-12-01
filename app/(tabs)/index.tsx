import { createStackNavigator } from "@react-navigation/stack";
import DrawerNavigator from "../../src/navigation/DrawerNavigator";
import ActivityViewScreen from "../../src/screens/ActivityViewScreen";
import CartScreen from "../../src/screens/CartScreen";
import CheckoutScreen from "../../src/screens/CheckoutScreen";
import HomeScreen from "../../src/screens/HomeScreen";
import LoginScreen from "../../src/screens/LoginScreen";
import RegisterScreen from "../../src/screens/RegisterScreen";

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  DashboardScreen: undefined; 
  CartScreen: undefined;
  Activity: undefined;
  Checkout: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootStack() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="DashboardScreen" component={DrawerNavigator} />
      <Stack.Screen name="CartScreen" component={CartScreen} />
      <Stack.Screen name="Activity" component={ActivityViewScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
    </Stack.Navigator>
  );
}