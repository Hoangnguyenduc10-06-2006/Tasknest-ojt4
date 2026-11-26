#!/usr/bin/env bash
# Runs on the Linux VPS. Keeps the existing .env and named database/file volumes.
set -euo pipefail
umask 077
root=${1:?Deployment root required}
sha=${2:?Release SHA required}
prefix=${3:?Image prefix required}
actor=${4:?Registry actor required}
[[ $sha =~ ^[a-f0-9]{40}$ ]]
release="$root/deploy/releases/$sha"
test -s "$root/.env" || { echo 'Missing server .env; configure it before enabling CD.' >&2; exit 1; }
command -v flock >/dev/null
command -v python3 >/dev/null
docker compose version >/dev/null
mkdir -p "$root/deploy/backups"
exec 9>"$root/deploy/deploy.lock"
flock -w 1800 9 || { echo 'Another release is being deployed.' >&2; exit 1; }
export IMAGE_PREFIX="$prefix" RELEASE_SHA="$sha" COMPOSE_PARALLEL_LIMIT=1
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
IFS= read -r token
printf '%s' "$token" | docker login ghcr.io -u "$actor" --password-stdin
unset token
compose=(docker compose --env-file "$root/.env" -f "$release/infra/compose/compose.yml" -f "$release/infra/compose/compose.production.yml")
# Keep a provisioned AI service on the same release as the gateway and frontend.
if "${compose[@]}" --profile ai config --format json | python3 -c '
import json, sys

services = json.load(sys.stdin)["services"]
environment = services.get("ai-service", {}).get("environment", {})
enabled = str(environment.get("AI_ENABLED", "")).lower() == "true"
database_configured = bool(str(environment.get("DB_PASSWORD") or "").strip())
sys.exit(0 if enabled and database_configured else 1)
'; then
  compose+=(--profile ai)
  echo 'Deploying configured AI service with this release.'
fi
"${compose[@]}" config --quiet
# Require a real HTTPS origin and secure cookies without printing secret values.
"${compose[@]}" config --format json | python3 -c '
import json,sys,urllib.parse,ipaddress,subprocess
c=json.load(sys.stdin)["services"]
origin=c["notification-service"]["environment"]["PUBLIC_APP_ORIGIN"]
u=urllib.parse.urlsplit(origin)
assert u.scheme=="https" and u.hostname and not u.username and not u.query and not u.fragment and u.path in ("", "/"), "Set PUBLIC_APP_ORIGIN to your HTTPS domain"
env=c["identity-service"]["environment"]
assert str(env["IDENTITY_COOKIE_SECURE"]).lower()=="true", "Production cookies must be Secure"
assert origin.rstrip("/") in [x.strip().rstrip("/") for x in env["IDENTITY_ALLOWED_ORIGINS"].split(",")], "Add production domain to IDENTITY_ALLOWED_ORIGINS"
# Install the source restriction before Compose can publish a public DB port.
mysql=c.get("mysql", {})
for mapping in mysql.get("ports", []):
 if int(mapping["target"]) != 3306: continue
 bind=ipaddress.ip_address(mapping.get("host_ip") or "0.0.0.0")
 if bind.is_loopback: continue
 assert bind.version == 4, "Public MySQL access supports IPv4 only"
 allowed=mysql.get("labels", {}).get("tasknest.mysql.allowed-ip", "")
 address=ipaddress.IPv4Address(allowed)
 assert not address.is_unspecified and not address.is_multicast, "Set MYSQL_ACCESS_ALLOWED_IP to your client IPv4"
 port=str(int(mapping["published"]))
 rule=["DOCKER-USER", "-p", "tcp", "!", "-s", str(address)+"/32", "-m", "conntrack", "--ctdir", "ORIGINAL", "--ctorigdstport", port, "-j", "DROP"]
 checked=subprocess.run(["iptables", "-C", *rule], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
 if checked.returncode:
  subprocess.run(["iptables", "-I", rule[0], "1", *rule[1:]], check=True)

'
"${compose[@]}" pull
mysql=$("${compose[@]}" ps --all --quiet mysql)
if [[ -n $mysql ]]; then
  # Abort if an existing database cannot be backed up; never delete its volume.
  backup="$root/deploy/backups/before-$sha-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  "${compose[@]}" exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --events --triggers --databases tasknest_identity tasknest_work tasknest_notification' | gzip > "$backup"
  gzip -t "$backup"
fi
if ! "${compose[@]}" up -d --no-build --wait --wait-timeout 1200; then
  "${compose[@]}" ps
  echo 'Release failed. Previous release marker retained; inspect container logs. Database rollback is manual.' >&2
  exit 1
fi
# Resolve the published host port without sourcing the secret .env as shell code.
port=$("${compose[@]}" port frontend 80)
python3 "$release/scripts/smoke-test.py" "http://$port"
if [[ -f "$root/deploy/current-release" ]]; then
  cp "$root/deploy/current-release" "$root/deploy/previous-release"
fi
printf '%s\n' "$sha" > "$root/deploy/current-release"
echo "Deployed release $sha; local smoke checks passed."
