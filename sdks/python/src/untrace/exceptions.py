"""Custom exceptions for the Untrace SDK."""

from typing import Optional

import httpx


class UntraceError(Exception):
    """Base exception for all Untrace SDK errors."""

    pass


class UntraceAPIError(UntraceError):
    """Raised when an API request fails."""

    def __init__(self, message: str, response: Optional[httpx.Response] = None):
        super().__init__(message)
        self.response = response


class UntraceValidationError(UntraceError):
    """Raised when request validation fails."""

    def __init__(self, message: str, response: Optional[httpx.Response] = None):
        super().__init__(message)
        self.response = response
