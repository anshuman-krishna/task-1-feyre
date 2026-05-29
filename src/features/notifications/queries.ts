"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";

export type Notification = {
  id: string;
  type:
    | "prediction_completed"
    | "prediction_failed"
    | "follow_up_due"
    | "patient_critical"
    | "system"
    | "automation"
    | "anomaly_detected"
    | "assignment_changed";
  priority: "low" | "normal" | "high" | "critical";
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = { items: Notification[]; unread: number };

export const notificationsKey = ["notifications"] as const;

export function useNotifications() {
  return useQuery<NotificationsResponse>({
    queryKey: notificationsKey,
    queryFn: () => fetcher<NotificationsResponse>("/api/notifications"),
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher<{ count: number }>(`/api/notifications/${id}`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetcher<{ count: number }>("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher<{ count: number }>(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}
