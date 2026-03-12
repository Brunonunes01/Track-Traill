import { createStackNavigator } from "@react-navigation/stack";
import DrawerNavigator from "../../src/navigation/DrawerNavigator";
import ActivityViewScreen from "../../src/screens/ActivityViewScreen";
import AdminDashboardScreen from "../../src/screens/AdminDashboardScreen";
import AtividadesScreen from "../../src/screens/AtividadesScreen";
import CartScreen from "../../src/screens/CartScreen";
import CheckoutScreen from "../../src/screens/CheckoutScreen";
import HomeScreen from "../../src/screens/HomeScreen";
import LoginScreen from "../../src/screens/LoginScreen";
import RegisterScreen from "../../src/screens/RegisterScreen";
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
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="DashboardScreen" component={DrawerNavigator} />
      
      <Stack.Screen name="Home" component={HomeScreen} /> 
      <Stack.Screen name="CartScreen" component={CartScreen} />
      
      {/* CORRIGIDO AQUI TAMBÉM PARA RENDERIZAR O ECRÃ CERTO */}
      <Stack.Screen name="ActivityView" component={ActivityViewScreen} />
      
      <Stack.Screen name="Atividades" component={AtividadesScreen} /> 
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="SuggestRoute" component={SuggestRouteScreen} /> 
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} /> 
    </Stack.Navigator>
  );
}