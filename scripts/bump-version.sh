#!/bin/sh
# Bump the Persea Desktop version: src-tauri/tauri.conf.json ("version") and
# src-tauri/Cargo.toml (package.version), then refresh Cargo.lock.
# Usage: scripts/bump-version.sh X.Y.Z

set -eu

usage() {
    echo "usage: $0 X.Y.Z" >&2
    exit 2
}

[ $# -eq 1 ] || usage
NEW_VERSION=$1

# Semver-ish X.Y.Z: digits and dots only, three numeric parts, no leading
# zeros except on zero itself.
case $NEW_VERSION in
    *[!0-9.]*) usage ;;
    .|*.|*..*) usage ;;
esac

OLDIFS=$IFS
IFS=.
set -- $NEW_VERSION
IFS=$OLDIFS

[ $# -eq 3 ] || usage
for part in "$1" "$2" "$3"; do
    case $part in
        [0-9]|[1-9][0-9]*) : ;;
        *) usage ;;
    esac
done

# Refuse a dirty tree: modified or staged files. Untracked files are ignored.
dirty=$(git status --porcelain --untracked-files=no) || {
    echo "error: git status failed; run from inside the repository" >&2
    exit 1
}
if [ -n "$dirty" ]; then
    echo "error: working tree has modified or staged files:" >&2
    printf '%s\n' "$dirty" >&2
    echo "commit or revert them before bumping the version" >&2
    exit 1
fi

ROOT=$(git rev-parse --show-toplevel)
CONF=$ROOT/src-tauri/tauri.conf.json
CARGO_TOML=$ROOT/src-tauri/Cargo.toml
LOCK=$ROOT/src-tauri/Cargo.lock

[ -f "$CONF" ] || { echo "error: $CONF not found" >&2; exit 1; }
[ -f "$CARGO_TOML" ] || { echo "error: $CARGO_TOML not found" >&2; exit 1; }

# The version key must appear exactly once per file, or the rewrite below
# is not safe.
CONF_COUNT=$(grep -c '"version"[[:space:]]*:' "$CONF")
[ "$CONF_COUNT" -eq 1 ] || {
    echo "error: expected exactly one \"version\" key in tauri.conf.json, found $CONF_COUNT" >&2
    exit 1
}
TOML_COUNT=$(grep -c '^version[[:space:]]*=' "$CARGO_TOML")
[ "$TOML_COUNT" -eq 1 ] || {
    echo "error: expected exactly one package.version line in Cargo.toml, found $TOML_COUNT" >&2
    exit 1
}

CONF_LINE=$(grep '"version"[[:space:]]*:' "$CONF")
OLD_CONF_VERSION=$(printf '%s' "$CONF_LINE" | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')
TOML_LINE=$(grep '^version[[:space:]]*=' "$CARGO_TOML")
OLD_TOML_VERSION=$(printf '%s' "$TOML_LINE" | sed 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/')

if [ "$OLD_CONF_VERSION" != "$OLD_TOML_VERSION" ]; then
    echo "error: tauri.conf.json ($OLD_CONF_VERSION) and Cargo.toml ($OLD_TOML_VERSION) disagree; fix them first" >&2
    exit 1
fi
[ "$OLD_CONF_VERSION" != "$NEW_VERSION" ] || {
    echo "error: version is already $NEW_VERSION" >&2
    exit 1
}

# Edit via temp files next to the targets, then move over them. The checks
# after each sed verify that only the version line changed.
TMP_CONF=$CONF.tmp-bump
TMP_TOML=$CARGO_TOML.tmp-bump
trap 'rm -f "$TMP_CONF" "$TMP_TOML"' EXIT INT TERM

sed "s/\"version\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$CONF" > "$TMP_CONF"
sed "s/^version[[:space:]]*=[[:space:]]*\"[^\"]*\"/version = \"$NEW_VERSION\"/" "$CARGO_TOML" > "$TMP_TOML"

CONF_DIFF=$(diff "$CONF" "$TMP_CONF" | grep -c '^[<>]' || true)
TOML_DIFF=$(diff "$CARGO_TOML" "$TMP_TOML" | grep -c '^[<>]' || true)
[ "$CONF_DIFF" -eq 2 ] || {
    echo "error: tauri.conf.json rewrite changed more than the version" >&2
    exit 1
}
[ "$TOML_DIFF" -eq 2 ] || {
    echo "error: Cargo.toml rewrite changed more than the version" >&2
    exit 1
}

mv "$TMP_CONF" "$CONF"
mv "$TMP_TOML" "$CARGO_TOML"

echo "bumped $OLD_CONF_VERSION -> $NEW_VERSION"

if command -v cargo >/dev/null 2>&1; then
    (cd "$ROOT/src-tauri" && cargo update --workspace --offline)
    grep -A1 'name = "persea-desktop"' "$LOCK" | grep -q "version = \"$NEW_VERSION\"" || {
        echo "error: Cargo.lock still lists the old version" >&2
        exit 1
    }
else
    echo "note: cargo not found; run 'cargo update --workspace --offline' in src-tauri/ to refresh Cargo.lock" >&2
fi

echo "version is now $NEW_VERSION"
