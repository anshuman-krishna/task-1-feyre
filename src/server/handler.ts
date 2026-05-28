import { ZodError } from "zod";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/api-response";
import type { NextResponse } from "next/server";

// route-handler wrapper. centralises error mapping so handlers
// can throw with intent and stay readable.
export function withErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail("validation failed", 422, "validation_error", err.flatten());
      }
      if (err instanceof ApiError) {
        return fail(err.message, err.status, err.code, err.details);
      }
      // unknown — never leak the stack
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error("[api]", err);
      }
      return fail("internal error", 500, "internal_error");
    }
  };
}
