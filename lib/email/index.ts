import { logger } from "@/lib/logger";

/**
 * Transactional email delivery.
 *
 * Providers (EMAIL_PROVIDER):
 *  - "resend"   → Resend HTTPS API (RESEND_API_KEY, EMAIL_FROM). Real email.
 *  - "disabled" → default. Nothing is sent; a warning without any token or
 *                 link is logged. Safe for local dev and CI.
 * Tests inject a capturing transport via `__setEmailTransportForTests`.
 *
 * Security properties:
 *  - Credentials are read server-side only (never NEXT_PUBLIC_*).
 *  - Links are built from the configured APP_URL / NEXT_PUBLIC_APP_URL,
 *    NEVER from request headers, so a forged Host header cannot redirect a
 *    reset link to an attacker's domain.
 *  - Message bodies, links and tokens are never logged.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Category for logs/metrics only. */
  kind: "password_reset" | "email_verification" | "account_exists";
}

export type SendResult = { ok: true; id?: string } | { ok: false; reason: "disabled" | "provider_error" | "misconfigured" };

export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8000;

export function createResendTransport(opts: { apiKey: string; from: string; fetchImpl?: FetchLike }): EmailTransport {
  const doFetch: FetchLike = opts.fetchImpl ?? ((i, init) => fetch(i, init));
  return {
    name: "resend",
    async send(message) {
      try {
        const res = await doFetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: opts.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            tags: [{ name: "category", value: message.kind }],
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (!res.ok) {
          // Status only: provider error bodies can echo the request.
          logger.error("Email provider rejected message", { provider: "resend", kind: message.kind, status: res.status });
          return { ok: false, reason: "provider_error" };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: data.id };
      } catch (error) {
        logger.error("Email provider request failed", {
          provider: "resend",
          kind: message.kind,
          error: error instanceof Error ? error.name : "unknown",
        });
        return { ok: false, reason: "provider_error" };
      }
    },
  };
}

const disabledTransport: EmailTransport = {
  name: "disabled",
  async send(message) {
    logger.warn("Email delivery disabled; message not sent", { kind: message.kind });
    return { ok: false, reason: "disabled" };
  },
};

function misconfigured(missing: string[]): EmailTransport {
  return {
    name: "misconfigured",
    async send(message) {
      logger.error("Email provider misconfigured; message not sent", { kind: message.kind, missing });
      return { ok: false, reason: "misconfigured" };
    },
  };
}

export function createTransportFromEnv(env: Record<string, string | undefined> = process.env): EmailTransport {
  const provider = (env.EMAIL_PROVIDER ?? "disabled").trim().toLowerCase();
  if (provider === "resend") {
    const missing = ["RESEND_API_KEY", "EMAIL_FROM"].filter((k) => !env[k]?.trim());
    if (missing.length) return misconfigured(missing);
    return createResendTransport({ apiKey: env.RESEND_API_KEY!.trim(), from: env.EMAIL_FROM!.trim() });
  }
  if (provider === "disabled" || provider === "") return disabledTransport;
  return misconfigured([`EMAIL_PROVIDER=${provider} (unsupported)`]);
}

let override: EmailTransport | null = null;
let cached: EmailTransport | null = null;

/** Test hook. Pass null to restore env-based selection. */
export function __setEmailTransportForTests(t: EmailTransport | null): void {
  override = t;
  cached = null;
}

export function getEmailTransport(): EmailTransport {
  if (override) return override;
  cached ??= createTransportFromEnv();
  return cached;
}

// ─── Links ────────────────────────────────────────────────────────────────

/**
 * Base URL for links in emails. Only configuration is trusted. In production
 * it must be https; otherwise no link is produced and nothing is sent.
 */
export function getTrustedAppUrl(env: Record<string, string | undefined> = process.env): URL | null {
  const raw = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && url.protocol === "http:")) return null;
  if (url.username || url.password) return null;
  return url;
}

/**
 * The token goes in the URL FRAGMENT: browsers never send fragments to the
 * server, so the token cannot land in access logs, CDN/proxy logs or Referer
 * headers. The page reads it client-side and POSTs it in the request body.
 */
export function buildTokenLink(path: "/reset-password" | "/verify-email", token: string, base: URL): string {
  const link = new URL(path, base);
  link.search = "";
  link.hash = new URLSearchParams({ token }).toString();
  return link.href;
}

// ─── Templates ────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, intro: string, cta: string, link: string, footer: string): { html: string; text: string } {
  const l = escapeHtml(link);
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
<table role="presentation" width="100%" style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:32px"><tr><td>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
<p style="line-height:1.5;margin:0 0 24px">${escapeHtml(intro)}</p>
<p style="margin:0 0 24px"><a href="${l}" style="display:inline-block;background:#1e1b4b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(cta)}</a></p>
<p style="font-size:13px;color:#475569;line-height:1.5;margin:0 0 8px">If the button does not work, copy this link into your browser:</p>
<p style="font-size:13px;word-break:break-all;margin:0 0 24px"><a href="${l}">${l}</a></p>
<p style="font-size:13px;color:#64748b;line-height:1.5;margin:0">${escapeHtml(footer)}</p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${intro}\n\n${cta}: ${link}\n\n${footer}\n`;
  return { html, text };
}

export function passwordResetEmail(to: string, link: string, ttlMinutes: number): EmailMessage {
  const { html, text } = layout(
    "Reset your CXJobs password",
    `We received a request to reset the password for this account. The link expires in ${ttlMinutes} minutes and can be used once.`,
    "Reset password",
    link,
    "If you did not request this, you can ignore this email; your password will not change."
  );
  return { to, subject: "Reset your CXJobs password", html, text, kind: "password_reset" };
}

export function verificationEmail(to: string, link: string, ttlHours: number): EmailMessage {
  const { html, text } = layout(
    "Confirm your email address",
    `Please confirm that this address belongs to you. The link expires in ${ttlHours} hours.`,
    "Verify email",
    link,
    "If you did not create a CXJobs account, you can ignore this email."
  );
  return { to, subject: "Confirm your CXJobs email address", html, text, kind: "email_verification" };
}

/**
 * Sent when someone registers with an address that already has an account,
 * so the API can answer identically for new and existing addresses without
 * leaving the real owner uninformed. Contains no token.
 */
export function accountExistsEmail(to: string, loginLink: string): EmailMessage {
  const { html, text } = layout(
    "Someone tried to create a CXJobs account with your email",
    "An account with this email address already exists, so no new account was created. If this was you, sign in instead — or reset your password from the sign-in page if you have forgotten it.",
    "Sign in",
    loginLink,
    "If this was not you, no action is needed; your account was not changed."
  );
  return { to, subject: "Your CXJobs account already exists", html, text, kind: "account_exists" };
}

// ─── High-level senders (never throw) ────────────────────────────────────

export async function sendAccountExistsEmail(to: string): Promise<SendResult> {
  const base = getTrustedAppUrl();
  if (!base) {
    logger.error("Email link base URL not configured (APP_URL / NEXT_PUBLIC_APP_URL)", { kind: "account_exists" });
    return { ok: false, reason: "misconfigured" };
  }
  return getEmailTransport().send(accountExistsEmail(to, new URL("/login", base).href));
}

export async function sendPasswordResetEmail(to: string, token: string, ttlMinutes: number): Promise<SendResult> {
  const base = getTrustedAppUrl();
  if (!base) {
    logger.error("Email link base URL not configured (APP_URL / NEXT_PUBLIC_APP_URL)", { kind: "password_reset" });
    return { ok: false, reason: "misconfigured" };
  }
  return getEmailTransport().send(passwordResetEmail(to, buildTokenLink("/reset-password", token, base), ttlMinutes));
}

export async function sendVerificationEmail(to: string, token: string, ttlHours: number): Promise<SendResult> {
  const base = getTrustedAppUrl();
  if (!base) {
    logger.error("Email link base URL not configured (APP_URL / NEXT_PUBLIC_APP_URL)", { kind: "email_verification" });
    return { ok: false, reason: "misconfigured" };
  }
  return getEmailTransport().send(verificationEmail(to, buildTokenLink("/verify-email", token, base), ttlHours));
}
