"""Custom exception hierarchy for database / repository operations.

All exceptions inherit from ``DatabaseError`` so callers can catch
a single base class or handle specific sub-types.
"""

from __future__ import annotations


class DatabaseError(Exception):
    """Base exception for all database-related errors."""

    def __init__(self, message: str = "Database operation failed") -> None:
        self.message = message
        super().__init__(self.message)


class RecordNotFoundError(DatabaseError):
    """Raised when a queried record does not exist."""

    def __init__(
        self,
        table: str,
        identifier: str,
    ) -> None:
        self.table = table
        self.identifier = identifier
        super().__init__(
            f"Record not found in '{table}' with identifier '{identifier}'"
        )


class RecordAlreadyExistsError(DatabaseError):
    """Raised when an insert violates a uniqueness constraint."""

    def __init__(
        self,
        table: str,
        identifier: str,
    ) -> None:
        self.table = table
        self.identifier = identifier
        super().__init__(
            f"Record already exists in '{table}' with identifier '{identifier}'"
        )


class DatabaseConnectionError(DatabaseError):
    """Raised when the database client cannot be reached."""

    def __init__(self, detail: str = "") -> None:
        msg = "Failed to connect to the database"
        if detail:
            msg = f"{msg}: {detail}"
        super().__init__(msg)
