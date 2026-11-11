/**
 * Message for the `?error=` code Auth.js appends to `/login` after a refused
 * OAuth sign-in. Only known codes map to text; the raw query value is never
 * displayed, so the parameter cannot inject arbitrary wording.
 */
export function oauthErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "OAuthAccountNotLinked":
      // An account already uses this address with another sign-in method.
      // It is never linked automatically (account-takeover protection).
      return "This email address is already registered with a different sign-in method. Sign in with your email and password instead.";
    case "AccessDenied":
      return "Sign-in was refused. Please use a verified Google account or contact support.";
    case null:
    case undefined:
    case "":
      return null;
    default:
      return "Sign-in failed. Please try again.";
  }
}
