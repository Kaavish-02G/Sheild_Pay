import type { ZodSchema } from "zod";

export class SchemaValidationError extends Error {
  readonly schemaName: string;
  readonly issues: unknown;

  constructor(schemaName: string, issues: unknown) {
    super(`[P2] ${schemaName} validation failed`);
    this.name = "SchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

export function parseOrThrow<T>(
  schema: ZodSchema<T>,
  schemaName: string,
  data: unknown
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new SchemaValidationError(schemaName, parsed.error.flatten());
  }
  return parsed.data;
}
