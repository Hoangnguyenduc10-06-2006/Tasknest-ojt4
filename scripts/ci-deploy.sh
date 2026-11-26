#!/usr/bin/env bash
# GitHub runner only. No production .env or private key is copied into a release.
set -euo pipefail
umask 077
: "${SSH_HOST:?Set DEPLOY_HOST}" "${SSH_USER:?Set DEPLOY_USER}"
: "${SSH_PRIVATE_KEY:?Set DEPLOY_SSH_KEY}" "${SSH_KNOWN_HOSTS:?Set DEPLOY_KNOWN_HOSTS}"
: "${GITHUB_SHA:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_ACTOR:?}" "${REGISTRY_TOKEN:?}"
SSH_PORT=${SSH_PORT:-22}
DEPLOY_ROOT=${DEPLOY_ROOT:-/var/www/tasknest}
[[ $SSH_HOST =~ ^[a-zA-Z0-9.-]+$ && $SSH_USER =~ ^[a-zA-Z0-9_-]+$ && $SSH_PORT =~ ^[0-9]+$ ]]
[[ $DEPLOY_ROOT =~ ^/[a-zA-Z0-9_/-]+$ && $DEPLOY_ROOT != / && $DEPLOY_ROOT != *..* ]]
[[ $GITHUB_SHA =~ ^[a-f0-9]{40}$ && $GITHUB_REPOSITORY =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ && $GITHUB_ACTOR =~ ^[a-zA-Z0-9_-]+$ ]]
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$tmp/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$tmp/known_hosts"
chmod 600 "$tmp/key" "$tmp/known_hosts"
options=(-i "$tmp/key" -o "UserKnownHostsFile=$tmp/known_hosts" -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o "Port=$SSH_PORT")
target="$SSH_USER@$SSH_HOST"
release="$DEPLOY_ROOT/deploy/releases/$GITHUB_SHA"
tar -czf "$tmp/release.tgz" infra scripts/deploy-release.sh scripts/smoke-test.py scripts/backup-recovery.py
ssh "${options[@]}" "$target" "mkdir -p '$release'"
scp "${options[@]}" "$tmp/release.tgz" "$target:$release/release.tgz"
ssh "${options[@]}" "$target" "tar -xzf '$release/release.tgz' -C '$release' && rm '$release/release.tgz'"
# Short-lived workflow token is sent over stdin, never in command-line arguments.
printf '%s\n' "$REGISTRY_TOKEN" | ssh "${options[@]}" "$target" \
  "bash '$release/scripts/deploy-release.sh' '$DEPLOY_ROOT' '$GITHUB_SHA' 'ghcr.io/${GITHUB_REPOSITORY,,}' '$GITHUB_ACTOR'"
