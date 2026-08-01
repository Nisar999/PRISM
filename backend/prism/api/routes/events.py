"""Real-time WebSocket event routes."""

import asyncio
import json
import logging
from typing import Set, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from prism.core.event_bus import event_bus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["events"])


class ConnectionManager:
    """Manages active WebSocket connections and client event channel subscriptions."""

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        self._event_bus_handler_active = False

    async def connect(self, websocket: WebSocket) -> None:
        """Accept connection, add to sets, and register EventBus listener if needed."""
        await websocket.accept()
        self.active_connections.add(websocket)
        # Default subscription to wildcard "*" so client receives all events initially
        self.subscriptions[websocket] = {"*"}
        
        if not self._event_bus_handler_active:
            event_bus.subscribe("*", self.handle_event_bus_event)
            self._event_bus_handler_active = True
            logger.info("Subscribed ConnectionManager to EventBus wildcard.")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove connection and clean up EventBus listener if no connections left."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
            
        if not self.active_connections and self._event_bus_handler_active:
            event_bus.unsubscribe("*", self.handle_event_bus_event)
            self._event_bus_handler_active = False
            logger.info("Unsubscribed ConnectionManager from EventBus (no active connections).")

    async def subscribe_client(self, websocket: WebSocket, event_type: str) -> None:
        """Subscribe client websocket to a specific event type."""
        if websocket in self.subscriptions:
            # If they subscribe to specific, remove generic wildcard to avoid duplication
            if "*" in self.subscriptions[websocket]:
                self.subscriptions[websocket].remove("*")
            self.subscriptions[websocket].add(event_type)
            logger.debug(f"WebSocket client subscribed to event: {event_type}")

    async def unsubscribe_client(self, websocket: WebSocket, event_type: str) -> None:
        """Unsubscribe client websocket from a specific event type."""
        if websocket in self.subscriptions and event_type in self.subscriptions[websocket]:
            self.subscriptions[websocket].remove(event_type)
            logger.debug(f"WebSocket client unsubscribed from event: {event_type}")

    async def handle_event_bus_event(self, event_data: Dict[str, Any]) -> None:
        """Callback triggered by EventBus publishes. Forward to matching subscribers."""
        event_type = event_data.get("event_type")
        data = event_data.get("data")
        
        if not event_type:
            return
            
        disconnected: Set[WebSocket] = set()
        for connection in self.active_connections:
            subs = self.subscriptions.get(connection, set())
            if "*" in subs or event_type in subs:
                try:
                    await connection.send_json({
                        "event_type": event_type,
                        "data": data
                    })
                except Exception as e:
                    logger.warning(f"Failed to send event to WebSocket, scheduling disconnect: {e}")
                    disconnected.add(connection)
                    
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """FastAPI WebSocket endpoint for real-time Kernel event streaming."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                action = message.get("action")
                event_type = message.get("event_type")
                
                if action == "subscribe" and event_type:
                    await manager.subscribe_client(websocket, event_type)
                elif action == "unsubscribe" and event_type:
                    await manager.unsubscribe_client(websocket, event_type)
            except json.JSONDecodeError:
                logger.warning(f"Received invalid JSON over WebSocket: {data}")
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}", exc_info=True)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket disconnected gracefully.")
    except Exception as e:
        manager.disconnect(websocket)
        logger.error(f"WebSocket disconnected with error: {e}", exc_info=True)
