/**
 * Credential hygiene rules for test-data seeds and load-test session
 * generators (audit finding N1, Release Gate 0).
 *
 * Pure function over source text, so the rules can be tested against small
 * synthetic fixtures and applied to whichever real files are tracked, without
 * depending on gitignored local load-test files.
 */
export type SeedCredentialProblem = "hard-coded-password" | "fallback-password-literal" | "real-mail-domain";

export function findSeedCredentialProblems(source: string): SeedCredentialProblem[] {
  const problems = new Set<SeedCredentialProblem>();
  const lines = source.split(/\r?\n/);

  // A password constant initialised with a string literal, e.g.
  //   const TEST_PASSWORD = "...";   const PASSWORD = '...';
  if (/\b[A-Z_]*PASSWORD\s*=\s*["'`]/.test(source)) problems.add("hard-coded-password");

  // An environment variable with a literal fallback, e.g.
  //   process.env.K6_TEST_PASSWORD || "..."   (?? too)
  for (const line of lines.filter((l) => /PASSWORD/i.test(l))) {
    if (/(\|\||\?\?)\s*["'`]/.test(line)) problems.add("fallback-password-literal");
  }

  // Seeded accounts must use the reserved .test domain (RFC 2606), never a
  // real mail provider where the address could belong to a person.
  if (/@(gmail|yahoo|hotmail|outlook|live|icloud|proton(mail)?)\.[a-z]{2,}/i.test(source)) problems.add("real-mail-domain");

  return [...problems];
}
