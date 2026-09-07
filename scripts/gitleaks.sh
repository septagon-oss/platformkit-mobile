#!/usr/bin/env bash
# The secret scan, checksum-pinned, called by every workflow that must not
# publish one. It reads the history, so the checkout needs its full depth.
set -euo pipefail
VERSION=8.30.1
SHA256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb

tools=$(mktemp -d)
trap 'rm -rf "$tools"' EXIT
curl -fsSLo "$tools/gitleaks.tar.gz" \
  "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz"
(cd "$tools" && echo "${SHA256}  gitleaks.tar.gz" | sha256sum -c -)
tar -xzf "$tools/gitleaks.tar.gz" -C "$tools" gitleaks
"$tools/gitleaks" git --no-banner --redact .
