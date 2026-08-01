"""Tests for real-time WebSocket event routes."""

import asyncio
from fastapi.testclient import TestClient
from prism.main import create_app
from prism.core.event_bus import event_bus


def test_websocket_event_subscription() -> None:
    """Verify that clients can subscribe to and receive EventBus events via WebSockets."""
    app = create_app()
    client = TestClient(app)
    
    with client.websocket_connect("/api/v1/events/ws") as websocket:
        # The WebSocket connection automatically subscribes to wildcard "*" by default
        
        # Publish an event to the EventBus
        async def trigger_event():
            await event_bus.publish("test_event_type", {"test_key": "test_val"})
            
        # Run async event publish
        asyncio.run(trigger_event())
        
        # Read event from the WebSocket
        message = websocket.receive_json()
        assert message["event_type"] == "test_event_type"
        assert message["data"] == {"test_key": "test_val"}


def test_websocket_selective_subscription() -> None:
    """Verify that clients can subscribe to specific events and ignore others."""
    app = create_app()
    client = TestClient(app)
    
    with client.websocket_connect("/api/v1/events/ws") as websocket:
        # Send action to subscribe only to 'specific_event'
        websocket.send_json({
            "action": "subscribe",
            "event_type": "specific_event"
        })
        
        # Wait a small moment to ensure the subscription maps
        async def trigger_events():
            # This should be ignored because the client unsubscribed from wildcard upon specific subscription
            await event_bus.publish("ignored_event", {"key": "val"})
            # This should be received
            await event_bus.publish("specific_event", {"match": True})
            
        asyncio.run(trigger_events())
        
        # Read the event (it should skip 'ignored_event' and fetch 'specific_event')
        message = websocket.receive_json()
        assert message["event_type"] == "specific_event"
        assert message["data"] == {"match": True}
