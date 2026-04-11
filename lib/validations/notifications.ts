import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  jobMatches: z.boolean().optional(),
  applicationUpdates: z.boolean().optional(),
  newMessages: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

export const defaultNotificationPreferences = {
  jobMatches: true,
  applicationUpdates: true,
  newMessages: true,
  weeklyDigest: true,
  pushEnabled: false,
};