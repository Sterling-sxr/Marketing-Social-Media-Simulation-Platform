import argparse
import asyncio
import json
import websockets


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="ws://localhost:8080", help="Base origin like ws://localhost:8080")
    parser.add_argument("--user", default="alice", help="User to subscribe for notifications")
    args = parser.parse_args()

    url = f"{args.base.rstrip('/')}/ws/notifications/?user={args.user}"
    print(f"Connecting to {url} ...")

    async for ws in websockets.connect(url, ping_interval=20):
        try:
            async for msg in ws:
                try:
                    data = json.loads(msg)
                except Exception:
                    print(msg)
                    continue
                print("<-", json.dumps(data, indent=2))
        except websockets.ConnectionClosed:
            print("Connection closed. Reconnecting in 3s...")
            await asyncio.sleep(3)
            continue


if __name__ == "__main__":
    asyncio.run(main())

