import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function AdminUserList({
  title,
  users,
  emptyMessage,
  actionLabel,
  onActionPress,
  disableActionForUid,
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {users.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : (
        users.map((user) => {
          const userRole = user.role === "admin" ? "admin" : "user";
          const actionDisabled = disableActionForUid === user.uid;

          return (
            <View key={user.uid} style={styles.userCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {user.fullName || user.username || "Usuário"}
                </Text>
                <Text style={styles.userEmail}>{user.email || "Sem e-mail"}</Text>
              </View>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>{userRole.toUpperCase()}</Text>
              </View>

              {onActionPress && actionLabel ? (
                <TouchableOpacity
                  onPress={() => onActionPress(user)}
                  disabled={actionDisabled}
                  style={[styles.actionBtn, actionDisabled && styles.actionBtnDisabled]}
                >
                  <Ionicons name="person-remove-outline" size={16} color="#fff" />
                  <Text style={styles.actionText}>{actionLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    padding: 16,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptyText: {
    color: "#aaa",
    fontSize: 14,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2b2b2b",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  userName: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  userEmail: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  actionBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
});
