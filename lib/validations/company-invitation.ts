import { z } from "zod";

export const ALLOWED_INVITATION_DURATIONS = [7, 14, 30, 60, 90] as const;

export const createCompanyInvitationSchema = z.object({
  managerName: z
    .string()
    .min(2, "Manager name must be at least 2 characters")
    .max(100, "Manager name must be 100 characters or less")
    .optional(),
  managerEmail: z
    .string()
    .email("Invalid manager email address")
    .max(254, "Email must be 254 characters or less")
    .optional(),
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(200, "Company name must be 200 characters or less"),
  companyEmail: z
    .string()
    .email("Invalid company email address")
    .max(254, "Email must be 254 characters or less"),
  durationDays: z
    .union([
      z.literal(7),
      z.literal(14),
      z.literal(30),
      z.literal(60),
      z.literal(90),
    ])
    .describe(
      `Invalid duration. Allowed values: ${ALLOWED_INVITATION_DURATIONS.join(", ")} days`
    ),
});

export type CreateCompanyInvitationInput = z.infer<typeof createCompanyInvitationSchema>;

export type CompanyInvitationStatus = "PENDING" | "IN_PROGRESS" | "CREATED" | "CLOSED";

export const companyInvitationStatuses: CompanyInvitationStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "CREATED",
  "CLOSED",
];

export function isValidCompanyInvitationStatus(value: string): value is CompanyInvitationStatus {
  return companyInvitationStatuses.includes(value as CompanyInvitationStatus);
}
