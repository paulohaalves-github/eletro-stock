import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, unauthorized, forbidden } from "@/lib/errors";
import { can } from "@/lib/permissions";

export function apiHandler(handler, { permission, public: isPublic = false } = {}) {
  return async (request, context) => {
    try {
      const session = await getSession();
      if (!isPublic && !session) throw unauthorized();
      if (permission && session && !can(session.role, permission)) throw forbidden();
      const result = await handler(request, { ...(context || {}), session });
      if (result instanceof Response) return result;
      return NextResponse.json(result);
    } catch (error) {
      return jsonError(error);
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
