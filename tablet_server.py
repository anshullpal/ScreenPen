import asyncio
import json
import websockets


connected_clients = set()


async def handle_client(websocket):

    connected_clients.add(websocket)

    print("Tablet connected!")

    try:

        async for message in websocket:

            data = json.loads(message)

            print("Received:", data)

    except websockets.exceptions.ConnectionClosed:

        print("Tablet disconnected.")

    finally:

        connected_clients.remove(websocket)


async def main():

    print("Starting ScreenPen tablet server...")

    async with websockets.serve(
        handle_client,
        "0.0.0.0",
        8765
    ):

        print(
            "WebSocket server running on port 8765"
        )

        await asyncio.Future()


asyncio.run(main())