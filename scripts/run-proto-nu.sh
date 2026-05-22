#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/.." && pwd)"
proto_tools="${repo_root}/.prototools"
proto_version="$(sed -n 's/^proto = "\(.*\)"$/\1/p' "${proto_tools}" | head -n 1)"

if [[ -z "${proto_version}" ]]; then
	echo "Unable to resolve proto version from ${proto_tools}" >&2
	exit 1
fi

export PROTO_HOME="${PROTO_HOME:-${HOME}/.proto}"
export PATH="${PROTO_HOME}/bin:${PROTO_HOME}/shims:${PATH}"

installed_proto_version="$(proto --version 2>/dev/null | awk '{print $2}' || true)"
if [[ "${installed_proto_version}" != "${proto_version}" ]]; then
	curl -fsSL https://moonrepo.dev/install/proto.sh | bash -s -- "${proto_version}" --yes
fi

proto install --yes node
proto install --yes pnpm
proto install --yes nu

exec proto run nu -- "$@"
