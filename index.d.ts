export interface ValidationError {
  code: number;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class Validator {
  constructor(schema: object | string);
  validate(data: unknown): ValidationResult;
  validateJSON(jsonString: string): ValidationResult;
}

export function validate(
  schema: object | string,
  data: unknown
): ValidationResult;

export function version(): string;
