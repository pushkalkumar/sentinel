"""Response envelope and error mapping (CONTRACT §0.2). Route handlers return ok(data)."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("sentinel.api")

ERROR_STATUS: dict[str, int] = {
    "VALIDATION_ERROR": 422,
    "MISSING_DEVICE_FP": 400,
    "UNAUTHORIZED": 401,
    "FORBIDDEN": 403,
    "DEVICE_BLOCKED": 403,
    "NOT_FOUND": 404,
    "INVALID_TRANSITION": 409,
    "CONFLICT": 409,
    "RATE_LIMITED": 429,
    "SIM_UNAVAILABLE": 502,
    "INTERNAL": 500,
}

_STATUS_TO_CODE: dict[int, str] = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    502: "SIM_UNAVAILABLE",
}


def ok(data: Any) -> dict:
    return {"ok": True, "data": data, "error": None}


def error_body(code: str, message: str, details: Any = None) -> dict:
    return {"ok": False, "data": None, "error": {"code": code, "message": message, "details": details}}


class ApiError(Exception):
    def __init__(self, code: str, message: str = "", details: Any = None, status: int | None = None):
        super().__init__(message or code)
        self.code = code
        self.message = message or code
        self.details = details
        self.status = status if status is not None else ERROR_STATUS.get(code, 500)

    def response(self) -> JSONResponse:
        return JSONResponse(status_code=self.status, content=error_body(self.code, self.message, self.details))


async def _api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return exc.response()


async def _http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _STATUS_TO_CODE.get(exc.status_code, "INTERNAL")
    detail = exc.detail
    message = detail if isinstance(detail, str) else code.lower().replace("_", " ")
    details = None if isinstance(detail, str) else detail
    return JSONResponse(status_code=exc.status_code, content=error_body(code, message, details))


async def _validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_body("VALIDATION_ERROR", "request validation failed", exc.errors()),
    )


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content=error_body("INTERNAL", type(exc).__name__))


def install_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(HTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(Exception, _unhandled_handler)
