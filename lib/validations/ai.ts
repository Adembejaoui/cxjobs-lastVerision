import { ContractType, EmploymentType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const WorkModeEnum = z.enum(["REMOTE", "HYBRID", "ON_SITE"]);

export const jobGenerationSchema = z.object({
  title: z.string().min(3, "Job title must be at least 3 characters").max(100),
  company: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  contractType: z.nativeEnum(ContractType).optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).optional().nullable(),
  workMode: WorkModeEnum.optional().nullable(),
  requirements: z.array(z.string()).max(10).optional(),
  benefits: z.array(z.string()).max(10).optional(),
  language: z.enum(["en", "fr"]).default("en").optional(),
});

export type JobGenerationInput = z.infer<typeof jobGenerationSchema>;