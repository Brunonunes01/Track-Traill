import { useRouter } from "expo-router";
import { storeNavigationPayload } from "./navPayloadStore";

const routeMap: Record<string, string> = {
  Login: "/login",
  Register: "/register",
  MainTabs: "/(tabs)",
  Home: "/(tabs)",
  Mapa: "/(tabs)/mapa",
  "Próximas": "/(tabs)/proximas",
  Atividades: "/(tabs)/atividades",
  Perfil: "/(tabs)/perfil",
  Amigos: "/friends",
  RouteDetail: "/route-detail",
  AlertForm: "/alert-form",
  AlertDetail: "/alert-detail",
  ActivitySummary: "/activity-summary",
  ActivityView: "/activity-view",
  Configuracoes: "/configuracoes",
  Ajuda: "/ajuda",
  Admin: "/admin",
  AdminDashboard: "/admin",
  SuggestRoute: "/suggest-route",
  TraceRoute: "/trace-route",
};

export function useExpoNavigationBridge() {
  const router = useRouter();

  const navigate = (name: string, params?: any) => {
    const target = routeMap[name];
    if (!target) return;

    if (params && typeof params === "object") {
      const payloadId = storeNavigationPayload(params);
      router.push({ pathname: target as any, params: { payloadId } });
      return;
    }

    router.push(target as any);
  };

  const replace = (name: string, params?: any) => {
    const target = routeMap[name];
    if (!target) return;

    if (params && typeof params === "object") {
      const payloadId = storeNavigationPayload(params);
      router.replace({ pathname: target as any, params: { payloadId } });
      return;
    }

    router.replace(target as any);
  };

  return {
    navigate,
    replace,
    goBack: () => router.back(),
    openDrawer: () => {},
    getParent: () => undefined,
  };
}
