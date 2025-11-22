"use client";

type NotificationType = "success" | "error" | "info";

type NotificationBarProps = {
  type: NotificationType;
  message: string;
};

export function NotificationBar({ type, message }: NotificationBarProps) {
  return <div className={`notification-bar notification-${type}`}>{message}</div>;
}
