import { createStackNavigator } from "@react-navigation/stack";
import DrawerNavigator from "../../src/navigation/DrawerNavigator";
import HomeScreen from "../../src/screens/HomeScreen";
import LoginScreen from "../../src/screens/LoginScreen";
import RegisterScreen from "../../src/screens/RegisterScreen";


export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  DashboardScreen: undefined; 
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootStack() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="DashboardScreen" component={DrawerNavigator} />
    </Stack.Navigator>
  );
}