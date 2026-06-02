import { ContractType } from "@/app/generated/prisma/enums";
import { z } from "zod";

const WorkModeEnum = z.enum(["REMOTE", "HYBRID", "ON_SITE"]);
const FrequencyEnum = z.enum(["DAILY", "WEEKLY", "INSTANT"]);

export const createJobAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  keywords: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  contractType: z.nativeEnum(ContractType).optional().nullable(),
  workMode: WorkModeEnum.optional().nullable(),
  salaryMin: z.number().int().min(0).optional().nullable(),
  frequency: FrequencyEnum.default("DAILY"),
});

export type CreateJobAlertInput = z.infer<typeof createJobAlertSchema>;

export const updateJobAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  keywords: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  contractType: z.nativeEnum(ContractType).optional().nullable(),
  workMode: WorkModeEnum.optional().nullable(),
  salaryMin: z.number().int().min(0).optional().nullable(),
  frequency: FrequencyEnum.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateJobAlertInput = z.infer<typeof updateJobAlertSchema>;