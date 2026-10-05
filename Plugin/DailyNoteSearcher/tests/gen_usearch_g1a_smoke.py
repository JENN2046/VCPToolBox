#!/usr/bin/env python3
import json
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def post(port, route, payload):
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}{route}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=3) as response:
        return json.loads(response.read())


def start(binary, port, mode, instance_id, token, metadata_path=None):
    env = os.environ.copy()
    env.update(
        {
            "DAILY_NOTE_SEARCHER_HOST": "127.0.0.1",
            "DAILY_NOTE_SEARCHER_PORT": str(port),
            "DAILY_NOTE_SEARCHER_INSTANCE_ID": instance_id,
            "DAILY_NOTE_SEARCHER_SHUTDOWN_TOKEN": token,
            "GEN_USEARCH_MODE": mode,
        }
    )
    if metadata_path is not None:
        env["GEN_USEARCH_METADATA_PATH"] = str(metadata_path)
    return subprocess.Popen(
        [str(binary), "--serve"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )


def stderr_text(process):
    return process.stderr.read().decode("utf-8", errors="replace")


def wait_health(process, port, timeout=5):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                f"process exited before health rc={process.returncode}: {stderr_text(process)}"
            )
        try:
            return post(port, "/health", {})
        except Exception as error:
            last_error = error
            time.sleep(0.05)
    raise RuntimeError(f"health timeout: {last_error}")


def shutdown(process, port, token, instance_id):
    response = post(
        port,
        "/shutdown",
        {"token": token, "instance_id": instance_id},
    )
    process.wait(timeout=5)
    if process.returncode != 0:
        raise RuntimeError(f"shutdown rc={process.returncode}: {stderr_text(process)}")
    return response


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: gen_usearch_g1a_smoke.py <DailyNoteSearcher binary>")

    binary = pathlib.Path(sys.argv[1]).resolve()
    if not binary.is_file():
        raise SystemExit(f"binary not found: {binary}")

    temp_root = pathlib.Path(tempfile.mkdtemp(prefix="gen-usearch-g1a-"))
    metadata_db = temp_root / "metadata.sqlite3"

    legacy_port = free_port()
    legacy = start(binary, legacy_port, "legacy", "legacy-a", "tok-legacy")
    legacy_health = wait_health(legacy, legacy_port)
    assert legacy_health["gen_usearch"]["phase"] == "G1-A"
    assert legacy_health["gen_usearch"]["mode"] == "LEGACY"
    assert legacy_health["gen_usearch"]["status"] == "DISABLED"
    assert legacy_health["gen_usearch"]["runtime_fence"] is None
    shutdown(legacy, legacy_port, "tok-legacy", "legacy-a")
    print("LEGACY_HEALTH=PASS")

    legacy_root = temp_root / "legacy-search"
    legacy_root.mkdir()
    (legacy_root / "note.md").write_text(
        "shadow isolation keeps legacy search available\n",
        encoding="utf-8",
    )

    shadow_port = free_port()
    shadow = start(
        binary,
        shadow_port,
        "shadow",
        "shadow-a",
        "tok-shadow-a",
        metadata_db,
    )
    first_health = wait_health(shadow, shadow_port)
    assert first_health["gen_usearch"]["mode"] == "GENERATIONAL_SHADOW"
    assert first_health["gen_usearch"]["status"] == "READY"
    assert first_health["gen_usearch"]["error"] is None
    assert first_health["gen_usearch"]["runtime_fence"] == 1
    assert pathlib.Path(first_health["gen_usearch"]["metadata_path"]) == metadata_db
    print("SHADOW_FIRST_FENCE=1")

    contender_port = free_port()
    contender = start(
        binary,
        contender_port,
        "shadow",
        "shadow-b",
        "tok-shadow-b",
        metadata_db,
    )
    contender_health = wait_health(contender, contender_port)
    assert contender_health["gen_usearch"]["mode"] == "GENERATIONAL_SHADOW"
    assert contender_health["gen_usearch"]["status"] == "ERROR"
    assert contender_health["gen_usearch"]["runtime_fence"] is None
    assert "INDEX_RUNTIME_ALREADY_OWNED" in contender_health["gen_usearch"]["error"]

    legacy_result = post(
        contender_port,
        "/search",
        {
            "query": "shadow isolation",
            "root_path": str(legacy_root),
            "allowed_extensions": "md",
        },
    )
    assert legacy_result["status"] == "success"
    assert legacy_result["total"] >= 1
    shutdown(contender, contender_port, "tok-shadow-b", "shadow-b")
    print("SHADOW_FAILURE_ISOLATION=PASS")

    shutdown(shadow, shadow_port, "tok-shadow-a", "shadow-a")

    replacement_port = free_port()
    replacement = start(
        binary,
        replacement_port,
        "shadow",
        "shadow-c",
        "tok-shadow-c",
        metadata_db,
    )
    replacement_health = wait_health(replacement, replacement_port)
    assert replacement_health["gen_usearch"]["runtime_fence"] == 2
    shutdown(replacement, replacement_port, "tok-shadow-c", "shadow-c")
    print("SHADOW_GRACEFUL_REACQUIRE_FENCE=2")

    active = start(
        binary,
        free_port(),
        "active",
        "active-a",
        "tok-active",
        temp_root / "active.sqlite3",
    )
    active.wait(timeout=5)
    active_error = stderr_text(active)
    assert active.returncode != 0
    assert "ACTIVE_ENGINE_UNAVAILABLE" in active_error
    print("ACTIVE_FAIL_CLOSED=PASS")

    print("G1_A_SERVICE_SMOKE=PASS")


if __name__ == "__main__":
    main()
