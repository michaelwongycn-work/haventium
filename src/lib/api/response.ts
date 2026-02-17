import { NextResponse } from "next/server";

/**
 * API Response Helpers
 * Standardized response formatting for all API routes
 */

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function apiUnauthorized(message: string = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function apiForbidden(message: string = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function apiNotFound(message: string = "Resource not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function apiServerError(message: string = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}
