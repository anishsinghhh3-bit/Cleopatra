import asyncio
import json

import websockets


async def main():
    uri = "ws://127.0.0.1:8000/ws/game/test1"
    async with websockets.connect(uri) as ws:
        print("Initial state:", await ws.recv())

        await ws.send(json.dumps({"type": "move", "uci": "e2e4"}))
        print("After e2e4:", await ws.recv())

        # e2 is now empty -- this replay must be rejected, not crash the server
        await ws.send(json.dumps({"type": "move", "uci": "e2e4"}))
        print("Illegal-move test:", await ws.recv())


asyncio.run(main())
