"""
Forge Calculator API client for Python 3.9+ (standard library only).

    from forge_api import ForgeApi, ForgeApiError
    api = ForgeApi(os.environ["FORGE_API_KEY"])
    ores = api.ores()
    result = api.calculate({"type": "forge", "kind": "weapon", "item": "dark-knights-gauntlets",
                            "ores": [{"id": "galaxite", "count": 5}, {"id": "kyubite", "count": 5}]})
    print(result["data"]["item"]["stat"]["value"])

The catalogue is cached in memory and re-checked with ETag every 10 minutes (an unchanged catalogue costs one
small 304 response). Calls block, so in an asyncio bot run them with `await asyncio.to_thread(api.calculate, body)`.
"""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

FORGE_API_BASE = "https://the-forge-calculator.vercel.app/api/v1"
KEY_FORMAT = re.compile(r"^fc_live_[A-Za-z0-9_-]{43}$")


class ForgeApiError(Exception):
    """`status` is the HTTP status (0 when the API couldn't be reached); `code` is the API's stable error code."""

    def __init__(self, status: int, code: str, message: str, request_id: Optional[str] = None,
                 details: Any = None, retry_after: Optional[int] = None):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message
        self.request_id, self.details, self.retry_after = request_id, details, retry_after


class ForgeApi:
    def __init__(self, key: str, base: str = FORGE_API_BASE, refresh_seconds: int = 600, timeout: float = 8.0):
        if not key or not KEY_FORMAT.match(key):
            raise ValueError("FORGE_API_KEY is missing or isn't a Forge Calculator API key.")
        self._key, self._base, self._refresh, self._timeout = key, base.rstrip("/"), refresh_seconds, timeout
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ HTTP

    def _request(self, path: str, body: Optional[dict] = None, etag: Optional[str] = None):
        headers = {"Authorization": f"Bearer {self._key}", "Accept": "application/json", "User-Agent": "forge-api-python/1"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if etag:
            headers["If-None-Match"] = etag
        req = urllib.request.Request(self._base + path, data=data, headers=headers, method="POST" if body is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as res:
                return res.status, json.loads(res.read().decode()), res.headers.get("ETag")
        except urllib.error.HTTPError as e:
            if e.code == 304:
                return 304, None, etag
            raw = e.read().decode(errors="replace")
            try:
                err = json.loads(raw).get("error", {})
            except ValueError:
                err = {}
            retry = e.headers.get("Retry-After")
            raise ForgeApiError(e.code, err.get("code", f"HTTP_{e.code}"), err.get("message", f"The API answered {e.code}."),
                                err.get("requestId") or e.headers.get("X-Request-Id"), err.get("details"),
                                int(retry) if retry and retry.isdigit() else None) from None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            code = "TIMEOUT" if "timed out" in str(e) else "NETWORK_ERROR"
            raise ForgeApiError(0, code, "The Forge Calculator API didn't answer. Try again shortly.") from None

    # ------------------------------------------------------------------ catalogue

    def catalogue(self, **query: Any) -> dict:
        """GET /catalogue with optional filters: type, world, ids, search."""
        qs = urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
        path = "/catalogue" + (f"?{qs}" if qs else "")
        with self._lock:
            hit = self._cache.get(path)
        if hit and time.time() - hit["at"] < self._refresh:
            return hit["body"]
        try:
            status, body, etag = self._request(path, etag=hit["etag"] if hit else None)
            if status == 304 and hit:
                body = hit["body"]
            with self._lock:
                self._cache[path] = {"etag": etag, "body": body, "at": time.time()}
            return body
        except ForgeApiError:
            if hit:
                return hit["body"]  # keep serving the last good copy if the API is briefly down
            raise

    def ores(self) -> List[dict]:
        return self.catalogue(type="ores")["data"]["ores"]

    def weapons(self) -> List[dict]:
        return self.catalogue(type="weapons")["data"]["weapons"]

    def armour(self) -> List[dict]:
        return self.catalogue(type="armour")["data"]["armour"]

    # ------------------------------------------------------------------ calculate

    def calculate(self, body: dict) -> dict:
        """POST /calculate. Retries once after a 429 if the wait is 5 seconds or less."""
        try:
            return self._request("/calculate", body=body)[1]
        except ForgeApiError as e:
            if e.code == "RATE_LIMITED" and (e.retry_after or 99) <= 5:
                time.sleep(e.retry_after or 1)
                return self._request("/calculate", body=body)[1]
            raise


def autocomplete(items: List[dict], typed: str, limit: int = 25) -> List[dict]:
    """Up to 25 {name, value} choices: names that start with the text first, then names that contain it."""
    q = typed.strip().lower()
    starts = [x for x in items if x["name"].lower().startswith(q)]
    contains = [x for x in items if q in x["name"].lower() and not x["name"].lower().startswith(q)]
    return [{"name": x["name"][:100], "value": x["id"]} for x in (starts + contains)[:limit]]


if __name__ == "__main__":
    import os
    import sys

    api = ForgeApi(os.environ.get("FORGE_API_KEY", ""), os.environ.get("FORGE_API_BASE", FORGE_API_BASE))
    try:
        print(len(api.ores()), "ores")
        r = api.calculate({"type": "forge", "kind": "weapon", "item": "dark-knights-gauntlets",
                           "ores": [{"id": "galaxite", "count": 5}, {"id": "kyubite", "count": 5},
                                    {"id": "fierce-jade", "count": 5}, {"id": "bismuth", "count": 1}]})
        item = r["data"]["item"]
        print(item["name"], item["stat"]["value"], item["stat"]["unit"], "| estimated DPS", item["weapon"]["dps"]["total"])
    except ForgeApiError as e:
        print(f"{e.status} {e.code}: {e.message} (request {e.request_id})", file=sys.stderr)
        sys.exit(1)
