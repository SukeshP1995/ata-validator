export interface ValidationError {
  code: number;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface StandardSchemaV1Props {
  version: 1;
  vendor: "ata-validator";
  validate(
    value: unknown
  ):
    | { value: unknown }
    | { issues: Array<{ message: string; path?: ReadonlyArray<{ key: PropertyKey }> }> };
}

export class Validator {
  constructor(schema: object | string);
  validate(data: unknown): ValidationResult;
  validateJSON(jsonString: string): ValidationResult;
  isValidJSON(jsonString: string): boolean;

  /** Standard Schema V1 interface — compatible with Fastify, tRPC, TanStack, etc. */
  readonly "~standard": StandardSchemaV1Props;
}

export function validate(
  schema: object | string,
  data: unknown
): ValidationResult;

export function version(): string;
