"""PRISM Event Bus Subsystem."""

import asyncio
import logging
from typing import Any, Callable, Dict, List, Awaitable
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata

logger = logging.getLogger(__name__)

class EventBus(PrismSubsystem):
    """Subsystem for async event publishing and subscription."""

    def __init__(self):
        metadata = SubsystemMetadata(
            name="event_bus",
            version="1.0.0",
            description="Manages publish-subscribe event communication across subsystems",
            dependencies=[]
        )
        super().__init__(metadata)
        self._handlers: Dict[str, List[Callable[[Any], Awaitable[None]]]] = {}

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info("Event Bus initialized.")

    def subscribe(self, event_type: str, handler: Callable[[Any], Awaitable[None]]) -> None:
        """Subscribe an async handler to an event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        if handler not in self._handlers[event_type]:
            self._handlers[event_type].append(handler)
            logger.debug(f"Subscribed handler to event: {event_type}")

    def unsubscribe(self, event_type: str, handler: Callable[[Any], Awaitable[None]]) -> None:
        """Unsubscribe a handler from an event type."""
        if event_type in self._handlers:
            try:
                self._handlers[event_type].remove(handler)
                logger.debug(f"Unsubscribed handler from event: {event_type}")
            except ValueError:
                pass

    async def publish(self, event_type: str, data: Any) -> None:
        """Publish an event to all subscribers asynchronously."""
        handlers = self._handlers.get(event_type, []).copy()
        wildcard_handlers = self._handlers.get("*", []).copy()
        
        if not handlers and not wildcard_handlers:
            return
        
        logger.debug(f"Publishing event {event_type} to {len(handlers) + len(wildcard_handlers)} handlers")
        
        tasks = []
        for handler in handlers:
            tasks.append(self._safe_execute(handler, data, event_type))
        for handler in wildcard_handlers:
            tasks.append(self._safe_execute(handler, {"event_type": event_type, "data": data}, event_type))
            
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_execute(self, handler: Callable[[Any], Awaitable[None]], data: Any, event_type: str) -> None:
        try:
            await handler(data)
        except Exception as e:
            logger.error(f"Error executing handler for event {event_type}: {e}", exc_info=True)

event_bus = EventBus()
