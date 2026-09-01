export class AppError extends Error {
  constructor(message, status = 400, code = "APP_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validationError(message) {
  return new AppError(message, 400, "VALIDATION");
}

export function notFound(message = "Registro não encontrado.") {
  return new AppError(message, 404, "NOT_FOUND");
}

export function forbidden(message = "Você não tem permissão para esta operação.") {
  return new AppError(message, 403, "FORBIDDEN");
}

export function unauthorized(message = "Não autenticado.") {
  return new AppError(message, 401, "UNAUTHORIZED");
}

export function conflict(message) {
  return new AppError(message, 409, "CONFLICT");
}

export function toErrorResponse(error) {
  if (error instanceof AppError || error.status) {
    return {
      status: error.status || 400,
      body: { error: error.message, code: error.code || "APP_ERROR" },
    };
  }

  console.error(error);
  return {
    status: 500,
    body: { error: "Não foi possível concluir a operação. Tente novamente." },
  };
}

export function jsonError(error) {
  const { status, body } = toErrorResponse(error);
  return Response.json(body, { status });
}
