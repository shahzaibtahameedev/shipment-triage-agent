import type { Context, Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import { describeError, RunConflictError } from "../triage-runner.ts";

export const HTTP_STATUS = {
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  SERVER_ERROR: 500,
} as const;

const JSON_CONTENT_TYPE = "application/json";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];
const PORT_SEPARATOR = /:\d+$/;
const INVALID_JSON_MESSAGE = "Request body must be valid JSON";
const JSON_REQUIRED_MESSAGE = "Send the body as application/json";
const LOCAL_ONLY_MESSAGE = "This API only accepts requests addressed to localhost";
const VALIDATION_MESSAGE = "Validation failed";
const BODY_PATH = "body";

export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly details: string[];

  constructor(status: ContentfulStatusCode, message: string, details: string[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(message: string): ApiError {
  const error = new ApiError(HTTP_STATUS.NOT_FOUND, message);

  return error;
}

export function conflict(message: string): ApiError {
  const error = new ApiError(HTTP_STATUS.CONFLICT, message);

  return error;
}

export function badRequest(message: string): ApiError {
  const error = new ApiError(HTTP_STATUS.BAD_REQUEST, message);

  return error;
}

// A JSON content type forces a CORS preflight, so other websites can't post to this local API
async function readJsonBody(c: Context): Promise<unknown> {
  const contentType = c.req.header("content-type") ?? "";

  if (!contentType.includes(JSON_CONTENT_TYPE)) {
    throw new ApiError(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE, JSON_REQUIRED_MESSAGE);
  }

  try {
    const body: unknown = await c.req.json();

    return body;
  } catch {
    throw badRequest(INVALID_JSON_MESSAGE);
  }
}

export async function parseJsonBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  const body = await readJsonBody(c);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || BODY_PATH}: ${issue.message}`);
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, VALIDATION_MESSAGE, details);
  }

  return parsed.data;
}

// Blocks DNS-rebinding: a request must be addressed to localhost, whatever resolved to us
export async function requireLocalHost(c: Context, next: Next): Promise<void> {
  const hostname = (c.req.header("host") ?? "").replace(PORT_SEPARATOR, "");

  if (!LOCAL_HOSTNAMES.includes(hostname)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, LOCAL_ONLY_MESSAGE);
  }

  await next();
}

export function handleApiError(error: Error, c: Context): Response {
  if (error instanceof ApiError) {
    const response = c.json({ error: error.message, details: error.details }, error.status);

    return response;
  }

  if (error instanceof RunConflictError) {
    const response = c.json({ error: error.message, details: [] }, HTTP_STATUS.CONFLICT);

    return response;
  }

  console.error(error);
  const response = c.json({ error: describeError(error), details: [] }, HTTP_STATUS.SERVER_ERROR);

  return response;
}
