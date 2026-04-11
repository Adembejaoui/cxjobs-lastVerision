import { prisma } from "@/lib/prisma";
import { Notification, Prisma } from "@prisma/client";

export type NotificationType = 
  | "JOB_RECOMMENDATION"
  | "APPLICATION_STATUS"
  | "APPLICATION_VIEWED"
  | "NEW_MESSAGE"
  | "INTERVIEW_INVITE"
  | "JOB_EXPIRED"
  | "SYSTEM"
  | "NEW_APPLICATION"
  | "APPLICATION_STATUS_CHANGED"
  | "INTERVIEW_SCHEDULED"
  | "WELCOME"
  | "NEW_COMPANY_REGISTERED"
  | "NEW_CANDIDATE_REGISTERED";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Creates a new notification for a user
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data,
    },
  });

  return notification;
}

/**
 * Creates notifications for multiple users
 */
export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">
): Promise<number> {
  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data,
    })),
  });

  return result.count;
}

/**
 * Gets notifications for a user with pagination
 */
export async function getNotifications(
  userId: string,
  options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 20, 50);
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(options?.unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, unreadCount };
}

/**
 * Gets unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

/**
 * Marks a notification as isRead
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });

  return result.count > 0;
}

/**
 * Marks all notifications as isRead for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return result.count;
}

/**
 * Deletes a notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });

  return result.count > 0;
}

/**
 * Deletes old isRead notifications (cleanup utility)
 * @param daysOld Number of days to keep isRead notifications
 */
export async function cleanupOldNotifications(
  daysOld: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      readAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

// ==================== NOTIFICATION HELPERS ====================

/**
 * Notification templates for different types
 */
export const NotificationTemplates = {
  NEW_APPLICATION: (jobTitle: string, candidateName: string) => ({
    title: "New Application Received",
    message: `${candidateName} has applied to your job posting "${jobTitle}"`,
  }),
  APPLICATION_VIEWED: (jobTitle: string, companyName: string) => ({
    title: "Application Viewed",
    message: `${companyName} has viewed your application for "${jobTitle}"`,
  }),
  APPLICATION_STATUS_CHANGED: (jobTitle: string, status: string) => ({
    title: "Application Status Updated",
    message: `Your application for "${jobTitle}" has been updated to: ${status}`,
  }),
  INTERVIEW_SCHEDULED: (jobTitle: string, companyName: string) => ({
    title: "Interview Scheduled",
    message: `You have an interview scheduled with ${companyName} for "${jobTitle}"`,
  }),
  JOB_PUBLISHED: (jobTitle: string) => ({
    title: "Job Published",
    message: `Your job posting "${jobTitle}" is now live and visible to candidates`,
  }),
  JOB_EXPIRING: (jobTitle: string, daysLeft: number) => ({
    title: "Job Expiring Soon",
    message: `Your job posting "${jobTitle}" will expire in ${daysLeft} days`,
  }),
  JOB_EXPIRED: (jobTitle: string) => ({
    title: "Job Expired",
    message: `Your job posting "${jobTitle}" has expired`,
  }),
  WELCOME: (name: string) => ({
    title: "Welcome to CXJobs!",
    message: `Welcome ${name}! Complete your profile to get started.`,
  }),
  PROFILE_INCOMPLETE: () => ({
    title: "Complete Your Profile",
    message: "Your profile is incomplete. Add more details to increase your visibility.",
  }),
  PASSWORD_CHANGED: () => ({
    title: "Password Changed",
    message: "Your password has been successfully changed.",
  }),
  NEW_COMPANY_REGISTERED: (companyName: string) => ({
    title: "New Company Registered",
    message: `A new company "${companyName}" has registered on the platform.`,
  }),
  NEW_CANDIDATE_REGISTERED: (candidateName: string) => ({
    title: "New Candidate Registered",
    message: `A new candidate "${candidateName}" has joined the platform.`,
  }),
} as const;

/**
 * Helper to create a new application notification
 */
export async function notifyNewApplication(
  companyUserId: string,
  jobTitle: string,
  candidateName: string,
  applicationId: string,
  jobId: string
): Promise<Notification> {
  const template = NotificationTemplates.NEW_APPLICATION(jobTitle, candidateName);
  return createNotification({
    userId: companyUserId,
    type: "NEW_APPLICATION",
    title: template.title,
    message: template.message,
    data: { applicationId, jobId, candidateName, jobTitle },
  });
}

/**
 * Helper to create application status change notification
 */
export async function notifyApplicationStatusChanged(
  candidateUserId: string,
  jobTitle: string,
  newStatus: string,
  applicationId: string,
  jobId: string
): Promise<Notification> {
  const template = NotificationTemplates.APPLICATION_STATUS_CHANGED(jobTitle, newStatus);
  return createNotification({
    userId: candidateUserId,
    type: "APPLICATION_STATUS_CHANGED",
    title: template.title,
    message: template.message,
    data: { applicationId, jobId, jobTitle, newStatus },
  });
}

/**
 * Helper to create interview scheduled notification
 */
export async function notifyInterviewScheduled(
  candidateUserId: string,
  jobTitle: string,
  companyName: string,
  applicationId: string,
  jobId: string
): Promise<Notification> {
  const template = NotificationTemplates.INTERVIEW_SCHEDULED(jobTitle, companyName);
  return createNotification({
    userId: candidateUserId,
    type: "INTERVIEW_SCHEDULED",
    title: template.title,
    message: template.message,
    data: { applicationId, jobId, jobTitle, companyName },
  });
}

/**
 * Helper to create welcome notification
 */
export async function notifyWelcome(
  userId: string,
  name: string
): Promise<Notification> {
  const template = NotificationTemplates.WELCOME(name);
  return createNotification({
    userId,
    type: "WELCOME",
    title: template.title,
    message: template.message,
  });
}

/**
 * Helper to notify admins of new company registration
 */
export async function notifyAdminsNewCompany(
  companyName: string,
  companyId: string
): Promise<number> {
  // Get all admin users
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deletedAt: null },
    select: { id: true },
  });

  if (admins.length === 0) return 0;

  const template = NotificationTemplates.NEW_COMPANY_REGISTERED(companyName);
  return createNotificationsForUsers(
    admins.map((a) => a.id),
    {
      type: "NEW_COMPANY_REGISTERED",
      title: template.title,
      message: template.message,
      data: { companyId, companyName },
    }
  );
}

/**
 * Helper to notify admins of new candidate registration
 */
export async function notifyAdminsNewCandidate(
  candidateName: string,
  candidateId: string
): Promise<number> {
  // Get all admin users
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deletedAt: null },
    select: { id: true },
  });

  if (admins.length === 0) return 0;

  const template = NotificationTemplates.NEW_CANDIDATE_REGISTERED(candidateName);
  return createNotificationsForUsers(
    admins.map((a) => a.id),
    {
      type: "NEW_CANDIDATE_REGISTERED",
      title: template.title,
      message: template.message,
      data: { candidateId, candidateName },
    }
  );
}
