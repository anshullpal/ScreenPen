import asyncio
import websockets


async def test():
    uri = "ws://10.190.100.92:8765"

    print("Connecting to:", uri)

    try:
        async with websockets.connect(uri) as ws:
            print("CONNECTED!")

            await ws.send(
                '{"type":"command","command":"tool:pen"}'
            )

            print("Command sent.")

            await asyncio.sleep(2)

    except Exception as error:
        print("CONNECTION FAILED:")
        print(type(error).__name__)
        print(error)


asyncio.run(test())