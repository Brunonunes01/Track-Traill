import { createStackNavigator } from "@react-navigation/stack";
import DrawerNavigator from "../../src/navigation/DrawerNavigator";
import ActivityViewScreen from "../../src/screens/ActivityViewScreen";
import CartScreen from "../../src/screens/CartScreen";
import CheckoutScreen from "../../src/screens/CheckoutScreen";
import HomeScreen from "../../src/screens/HomeScreen"; // Este é o nosso mapa de exploração
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
    // Mudamos a rota inicial para "Login". Assim o app sempre pede autenticação primeiro.
    // Após logar, o usuário vai para a "DashboardScreen".
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="DashboardScreen" component={DrawerNavigator} />
      
      {/* O Mapa (HomeScreen) agora é uma tela acessada via botão */}
      <Stack.Screen name="Home" component={HomeScreen} /> 
      
      <Stack.Screen name="CartScreen" component={CartScreen} />
      <Stack.Screen name="Activity" component={ActivityViewScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
    </Stack.Navigator>
  );
}