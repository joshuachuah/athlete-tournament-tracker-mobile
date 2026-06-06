import type { ZodError } from "zod";

export function zodErrorMap(error: ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}
