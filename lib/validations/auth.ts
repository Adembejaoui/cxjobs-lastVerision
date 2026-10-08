import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  name: z.string().min(2, "Name must be at least 2 characters"),
  invitationToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

/**
 * Admin user management - account fields only.
 *
 * Only name, email, and isActive are editable. role and passwordHash are
 * explicitly excluded from the schema so they can never be supplied.
 */
export const adminUpdateUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

/**
 * Company profile fields that can be edited by admin.
 * Based on the Prisma `companies` model and existing companyProfileSchema.
 */
export const adminUpdateCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").optional(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable(),
  coverImageUrl: z.string().url("Invalid cover image URL").optional().nullable(),
  companySize: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")).nullable(),
  foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional().nullable(),
  description: z.string().max(5000, "Description must be 5000 characters or less").optional().nullable(),
  isRemoteFriendly: z.boolean().optional().nullable(),
  isHybridFriendly: z.boolean().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  twitterUrl: z.string().optional().nullable(),
  facebookUrl: z.string().optional().nullable(),
  isVerified: z.boolean().optional().nullable(),
  emailCompany: z.string().email("Invalid company contact email").max(254, "Email must be 254 characters or less").optional().nullable(),
});

/**
 * Combined schema for admin user update with optional company data.
 * The server determines if company fields apply based on the user's role.
 */
export const adminUpdateUserWithCompanySchema = adminUpdateUserSchema.extend({
  company: adminUpdateCompanySchema.optional(),
});

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminUpdateCompanyInput = z.infer<typeof adminUpdateCompanySchema>;
export type AdminUpdateUserWithCompanyInput = z.infer<typeof adminUpdateUserWithCompanySchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
