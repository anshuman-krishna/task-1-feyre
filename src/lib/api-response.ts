import { NextResponse } from "next/server";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: { message: string; code?: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, init);
}

export function fail(message: string, status = 400, code?: string, details?: unknown) {
  return NextResponse.json<ApiFailure>(
    { success: false, error: { message, code, details } },
    { status },
  );
}
