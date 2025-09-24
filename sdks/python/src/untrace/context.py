"""Context management for the Untrace SDK."""

import uuid
from typing import Any, Dict, Optional
from opentelemetry import context
from opentelemetry.trace import Span


class UntraceContext:
    """Context management utilities for Untrace SDK."""

    def __init__(self) -> None:
        """Initialize the Untrace context manager."""
        self._context_keys = {
            "user_id": context.create_key("untrace.user_id"),
            "session_id": context.create_key("untrace.session_id"),
            "workflow_id": context.create_key("untrace.workflow_id"),
            "run_id": context.create_key("untrace.run_id"),
            "metadata": context.create_key("untrace.metadata"),
        }

    def set_user_id(self, user_id: str) -> None:
        """Set the current user ID in context.

        Args:
            user_id: User ID to set
        """
        context.set_value(self._context_keys["user_id"], user_id)

    def get_user_id(self) -> Optional[str]:
        """Get the current user ID from context.

        Returns:
            User ID or None
        """
        value = context.get_value(self._context_keys["user_id"])
        return value if isinstance(value, str) else None

    def set_session_id(self, session_id: str) -> None:
        """Set the current session ID in context.

        Args:
            session_id: Session ID to set
        """
        context.set_value(self._context_keys["session_id"], session_id)

    def get_session_id(self) -> Optional[str]:
        """Get the current session ID from context.

        Returns:
            Session ID or None
        """
        value = context.get_value(self._context_keys["session_id"])
        return value if isinstance(value, str) else None

    def set_workflow_id(self, workflow_id: str) -> None:
        """Set the current workflow ID in context.

        Args:
            workflow_id: Workflow ID to set
        """
        context.set_value(self._context_keys["workflow_id"], workflow_id)

    def get_workflow_id(self) -> Optional[str]:
        """Get the current workflow ID from context.

        Returns:
            Workflow ID or None
        """
        value = context.get_value(self._context_keys["workflow_id"])
        return value if isinstance(value, str) else None

    def set_run_id(self, run_id: str) -> None:
        """Set the current run ID in context.

        Args:
            run_id: Run ID to set
        """
        context.set_value(self._context_keys["run_id"], run_id)

    def get_run_id(self) -> Optional[str]:
        """Get the current run ID from context.

        Returns:
            Run ID or None
        """
        value = context.get_value(self._context_keys["run_id"])
        return value if isinstance(value, str) else None

    def set_metadata(self, metadata: Dict[str, Any]) -> None:
        """Set metadata in context.

        Args:
            metadata: Metadata dictionary
        """
        context.set_value(self._context_keys["metadata"], metadata)

    def get_metadata(self) -> Optional[Dict[str, Any]]:
        """Get metadata from context.

        Returns:
            Metadata dictionary or None
        """
        value = context.get_value(self._context_keys["metadata"])
        return value if isinstance(value, dict) else None

    def create_workflow_context(
        self,
        workflow_name: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a workflow context with all necessary IDs.

        Args:
            workflow_name: Name of the workflow
            user_id: User ID (optional)
            session_id: Session ID (optional)
            metadata: Additional metadata (optional)

        Returns:
            Context dictionary
        """
        workflow_id = str(uuid.uuid4())
        run_id = str(uuid.uuid4())

        # Set context values
        self.set_workflow_id(workflow_id)
        self.set_run_id(run_id)

        if user_id:
            self.set_user_id(user_id)
        if session_id:
            self.set_session_id(session_id)
        if metadata:
            self.set_metadata(metadata)

        return {
            "workflow_id": workflow_id,
            "run_id": run_id,
            "user_id": user_id,
            "session_id": session_id,
            "metadata": metadata,
        }

    def get_current_context(self) -> Dict[str, Any]:
        """Get the current context as a dictionary.

        Returns:
            Current context dictionary
        """
        return {
            "user_id": self.get_user_id(),
            "session_id": self.get_session_id(),
            "workflow_id": self.get_workflow_id(),
            "run_id": self.get_run_id(),
            "metadata": self.get_metadata(),
        }

    def clear_context(self) -> None:
        """Clear all context values."""
        for key in self._context_keys.values():
            context.set_value(key, None)

    def with_context(self, context_dict: Dict[str, Any]) -> context.Context:
        """Create a new context with the given values.

        Args:
            context_dict: Context values to set

        Returns:
            New context
        """
        ctx = context.get_current()

        if "user_id" in context_dict:
            ctx = context.set_value(self._context_keys["user_id"], context_dict["user_id"], ctx)
        if "session_id" in context_dict:
            ctx = context.set_value(self._context_keys["session_id"], context_dict["session_id"], ctx)
        if "workflow_id" in context_dict:
            ctx = context.set_value(self._context_keys["workflow_id"], context_dict["workflow_id"], ctx)
        if "run_id" in context_dict:
            ctx = context.set_value(self._context_keys["run_id"], context_dict["run_id"], ctx)
        if "metadata" in context_dict:
            ctx = context.set_value(self._context_keys["metadata"], context_dict["metadata"], ctx)

        return ctx

    def attach_to_span(self, span: Span) -> None:
        """Attach current context to a span.

        Args:
            span: Span to attach context to
        """
        current_context = self.get_current_context()

        # Add context as span attributes
        attributes = {}
        for key, value in current_context.items():
            if value is not None:
                attributes[f"untrace.{key}"] = value

        if attributes:
            span.set_attributes(attributes)
