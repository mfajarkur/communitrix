export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION' | 'CONFLICT' | 'NOT_FOUND' | 'UNKNOWN';
      message: string;
      fieldErrors?: Record<string, string[]>;
    };
