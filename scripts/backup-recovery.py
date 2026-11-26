#!/usr/bin/env python3
"""Encrypted TaskNest release backups and restore into an empty stack."""
import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
import zipfile

DATABASES = ("tasknest_identity", "tasknest_work", "tasknest_notification")
FILES = "/var/lib/tasknest/files"
PAYLOAD = "tasknest.tar.gz.age"
WRITERS = ("api-gateway", "identity-service", "work-service", "notification-service", "ai-service")
MAIL_LIMIT_MIB = 13  # Leave room for base64 and email formatting under Brevo's 20 MB cap.


def run(command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)


def output(command):
    return run(command, stdout=subprocess.PIPE, text=True).stdout.strip()


def checksum(path):
    with path.open("rb") as stream:
        digest = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
        return digest.hexdigest()


def mysql(compose, arguments, **kwargs):
    return run([*compose, "exec", "-T", "mysql", "sh", "-c",
                'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec "$@"', "mysql-backup",
                *arguments], **kwargs)


def sql(compose, statement):
    return mysql(compose, ["mysql", "-uroot", "-BN", "-e", statement],
                 stdout=subprocess.PIPE, text=True).stdout.strip()


def file_command(compose):
    container = output([*compose, "ps", "--all", "--quiet", "work-service"])
    if not container:
        raise ValueError("Create the work-service container before accessing its file volume.")
    image = output(["docker", "inspect", "--format", "{{.Image}}", container])
    return container, image


@contextmanager
def quiesce(compose):
    running = set(output([*compose, "ps", "--status", "running", "--services"]).splitlines())
    writers = [service for service in WRITERS if service in running]
    try:
        if writers:
            run([*compose, "stop", *writers], stdout=sys.stderr)
        yield
    finally:
        if writers:
            run([*compose, "start", "--wait", *writers], stdout=sys.stderr)


def backup(args, compose, sha, directory):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    name = f"tasknest-{stamp}-{sha[:12]}.zip"
    with tempfile.TemporaryDirectory(dir=directory, prefix=".staging-") as staging:
        work = Path(staging)
        database = work / "mysql.sql"
        files = work / "files.tar"
        with quiesce(compose):
            ai = sql(compose, "SHOW DATABASES LIKE 'tasknest\\_ai'")
            databases = (*DATABASES, "tasknest_ai") if ai == "tasknest_ai" else DATABASES
            with database.open("wb") as stream:
                mysql(compose, ["mysqldump", "-uroot", "--single-transaction", "--routines",
                                "--events", "--triggers", "--hex-blob", "--set-gtid-purged=OFF",
                                "--databases", *databases], stdout=stream)
            container, image = file_command(compose)
            with files.open("wb") as stream:
                run(["docker", "run", "--rm", "--network", "none", "--volumes-from",
                     f"{container}:ro", "--entrypoint", "tar", image, "-cf", "-", "-C", FILES, "."],
                    stdout=stream)

        manifest = {"format": 1, "release": sha, "createdUtc": stamp, "databases": databases,
                    "sha256": {path.name: checksum(path) for path in (database, files)}}
        metadata = work / "manifest.json"
        metadata.write_text(json.dumps(manifest), encoding="utf-8")
        encrypted = work / PAYLOAD
        with encrypted.open("wb") as stream:
            with subprocess.Popen(["age", "-R", str(args.recipients)], stdin=subprocess.PIPE,
                                  stdout=stream) as encoder:
                with tarfile.open(fileobj=encoder.stdin, mode="w|gz") as archive:
                    for path in (database, files, metadata):
                        archive.add(path, arcname=path.name)
                encoder.stdin.close()
                if encoder.wait() != 0:
                    raise ValueError("age encryption failed.")

        with zipfile.ZipFile(work / name, "w") as archive:
            archive.write(encrypted, PAYLOAD)
        result = directory / name
        (work / name).replace(result)

    expired = sorted(directory.glob("tasknest-*.zip"), reverse=True)[args.keep:]
    for path in expired:
        path.unlink()
    return result


def send_backup(compose, path, address):
    config = json.loads(output([*compose, "config", "--format", "json"]))
    env = config["services"]["notification-service"]["environment"]
    size = path.stat().st_size
    attached = size <= MAIL_LIMIT_MIB * 1024 * 1024
    message = {
        "sender": {"email": env["MAIL_FROM_EMAIL"], "name": env.get("MAIL_FROM_NAME") or "TaskNest"},
        "to": [{"email": address}],
        "subject": f"TaskNest backup {path.name}",
        "textContent": (f"Đã tạo bản sao lưu mã hóa {path.name} ({size:,} byte). "
                        + ("Tệp được đính kèm." if attached else
                           f"Tệp vượt ngưỡng đính kèm {MAIL_LIMIT_MIB} MiB. Tải thủ công từ {path} trên VPS.")),
    }
    if attached:
        message["attachment"] = [{"name": path.name,
                                  "content": base64.b64encode(path.read_bytes()).decode("ascii")}]
    request = urllib.request.Request("https://api.brevo.com/v3/smtp/email",
                                     data=json.dumps(message).encode("utf-8"),
                                     headers={"api-key": env["BREVO_API_KEY"],
                                              "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 201:
                raise ValueError(f"Brevo returned HTTP {response.status}.")
    except urllib.error.HTTPError as error:
        raise ValueError(f"Brevo rejected the email (HTTP {error.code}). Backup is still on disk.") from None
    print("Brevo accepted the " + ("ZIP attachment." if attached else "size warning."))


def unpack(source, identity, work):
    with zipfile.ZipFile(source) as archive:
        if archive.namelist() != [PAYLOAD]:
            raise ValueError("Unexpected ZIP contents.")
        with archive.open(PAYLOAD) as member, (work / PAYLOAD).open("wb") as stream:
            shutil.copyfileobj(member, stream)

    with (work / "backup.tar.gz").open("wb") as stream:
        run(["age", "-d", "-i", str(identity), str(work / PAYLOAD)], stdout=stream)

    names = {"mysql.sql", "files.tar", "manifest.json"}
    with tarfile.open(work / "backup.tar.gz", "r:gz") as archive:
        members = archive.getmembers()
        if len(members) != len(names) or {item.name for item in members} != names:
            raise ValueError("Unexpected backup contents.")
        for item in members:
            if not item.isfile():
                raise ValueError("Unexpected backup entry type.")
            with archive.extractfile(item) as member, (work / item.name).open("wb") as stream:
                shutil.copyfileobj(member, stream)

    metadata = json.loads((work / "manifest.json").read_text())
    if metadata["format"] != 1 or tuple(metadata["databases"]) not in (DATABASES, (*DATABASES, "tasknest_ai")):
        raise ValueError("Unsupported backup format or database list.")
    for name in ("mysql.sql", "files.tar"):
        if checksum(work / name) != metadata["sha256"][name]:
            raise ValueError(f"Checksum mismatch for {name}.")
    with tarfile.open(work / "files.tar") as archive:
        for item in archive:
            path = PurePosixPath(item.name)
            if path.is_absolute() or ".." in path.parts or not (item.isfile() or item.isdir()):
                raise ValueError("Unsafe path or entry type in file volume backup.")
    return metadata


def restore(compose, sha, work, metadata):
    if metadata["release"] != sha:
        raise ValueError("Restore using the same release as the backup.")
    active = output([*compose, "ps", "--all", "--status", "running", "--status", "restarting",
                     "--status", "paused", "--status", "removing", "--services"]).splitlines()
    if active != ["mysql"]:
        raise ValueError("Restore target must have only MySQL running.")
    tables = sql(compose, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN "
                 "('tasknest_identity','tasknest_work','tasknest_notification','tasknest_ai')")
    if tables != "0":
        raise ValueError("Restore target already contains application tables.")
    container, image = file_command(compose)
    helper = ["docker", "run", "--rm", "-i", "--network", "none", "--volumes-from", container]
    run([*helper, "--entrypoint", "sh", image, "-ec",
         'test -z "$(ls -A "$1")" && test -w "$1"', "restore", FILES])
    with (work / "mysql.sql").open("rb") as stream:
        mysql(compose, ["mysql", "-uroot"], stdin=stream)
    with (work / "files.tar").open("rb") as stream:
        run([*helper, "--entrypoint", "tar", image, "-xf", "-", "-C", FILES], stdin=stream)
    print("Restored database and files. Start the target stack and run smoke checks.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/var/www/tasknest"))
    parser.add_argument("--image-prefix", default="ghcr.io/khanhan007/tasknest---ojt4")
    actions = parser.add_subparsers(dest="action", required=True)
    save = actions.add_parser("backup")
    save.add_argument("--recipients", type=Path, required=True, help="age public recipients file")
    save.add_argument("--email", required=True)
    save.add_argument("--keep", type=int, default=7)
    for action in ("verify", "restore"):
        command = actions.add_parser(action)
        command.add_argument("archive", type=Path)
        command.add_argument("--identity", type=Path, required=True, help="age private identity file")
    args = parser.parse_args()
    os.umask(0o077)
    if args.action == "verify":
        with tempfile.TemporaryDirectory(prefix="tasknest-verify-") as staging:
            metadata = unpack(args.archive, args.identity, Path(staging))
            print(f"Backup verified for release {metadata['release']}.")
        return

    root = args.root.resolve()
    deploy = root / "deploy"
    directory = deploy / "backups" / "encrypted"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (deploy / "deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        sha = (deploy / "current-release").read_text().strip()
        if not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise ValueError("Invalid deployment release marker.")
        os.environ.update(RELEASE_SHA=sha, IMAGE_PREFIX=args.image_prefix)
        release = deploy / "releases" / sha / "infra" / "compose"
        compose = ["docker", "compose", "--profile", "ai", "--env-file", str(root / ".env"), "-f",
                   str(release / "compose.yml"), "-f", str(release / "compose.production.yml")]
        if args.action == "backup":
            if args.keep < 1 or not args.recipients.is_file() or not shutil.which("age"):
                raise ValueError("Backup requires age, a public recipients file and --keep >= 1.")
            path = backup(args, compose, sha, directory)
            print(f"Backup saved to {path}", flush=True)
        else:
            with tempfile.TemporaryDirectory(dir=directory, prefix=".restore-") as staging:
                work = Path(staging)
                metadata = unpack(args.archive, args.identity, work)
                restore(compose, sha, work, metadata)
    if args.action == "backup":
        send_backup(compose, path, args.email)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError,
            tarfile.TarError, zipfile.BadZipFile) as error:
        sys.exit(f"TaskNest backup/recovery failed: {error}")
