#!/bin/sh
# Stamp a beta version into the three version sources: src-tauri/tauri.conf.json
# ("version"), src-tauri/Cargo.toml (package.version) and src-tauri/Cargo.lock.
#
# The Tauri bundlers only accept plain numeric versions: the AppImage path
# rejects a hyphen outright ("contains invalid character"), and the MSI path
# rejects non-numeric pre-release or build metadata. A beta therefore cannot
# carry a semver pre-release suffix.
#
# The updater compares the published version against the COMPILED
# CARGO_PKG_VERSION, so the compiled version has to be the beta version too.
# Otherwise the app keeps seeing its own build as "an update available", or
# never sees the next one. That is why the version is stamped into the crate
# and the config instead of being passed as a build-time --config override.
#
# Usage: scripts/stamp-beta-version.sh X.Y.Z
#
# This runs inside a CI checkout that is about to be built, so unlike
# scripts/bump-version.sh it does not refuse a dirty tree.

set -eu

usage() {
    echo "usage: $0 X.Y.Z" >&2
    exit 2
}

[ $# -eq 1 ] || usage
NEW_VERSION=$1

# Plain numeric X.Y.Z only. The bounds come from the MSI bundler, which
# caps major and minor at 255 and the patch at 65535.
case $NEW_VERSION in
    *[!0-9.]*) usage ;;
    .*|*.|*..*) usage ;;
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
[ "$1" -le 255 ] || usage
[ "$2" -le 255 ] || usage
[ "$3" -le 65535 ] || usage

ROOT=$(git rev-parse --show-toplevel)
CONF=$ROOT/src-tauri/tauri.conf.json
CARGO_TOML=$ROOT/src-tauri/Cargo.toml
LOCK=$ROOT/src-tauri/Cargo.lock

[ -f "$CONF" ] || { echo "error: $CONF not found" >&2; exit 1; }
[ -f "$CARGO_TOML" ] || { echo "error: $CARGO_TOML not found" >&2; exit 1; }

# The version key must appear exactly once per file, or the rewrite below
# is not safe. The trailing whitespace class also matches the CR of a
# CRLF checkout, which the Windows build leg produces.
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

# The lock file entry for the local crate: rewrite the version line that
# follows the name line. The lock is refreshed by cargo during the build,
# but keeping it in sync means the tree is coherent for anything that
# reads the lock before the build starts.
if [ -f "$LOCK" ]; then
    LOCK_NAME_COUNT=$(grep -cE '^name = "persea-desktop"[[:space:]]*$' "$LOCK")
    [ "$LOCK_NAME_COUNT" -eq 1 ] || {
        echo "error: expected exactly one persea-desktop entry in Cargo.lock, found $LOCK_NAME_COUNT" >&2
        exit 1
    }
    awk -v v="$NEW_VERSION" '
        /^name = "persea-desktop"/ { in_pkg = 1 }
        in_pkg && /^version = / && !done {
            cr = ""
            if (sub(/\r$/, "")) { cr = "\r" }
            print "version = \"" v "\"" cr
            done = 1
            in_pkg = 0
            next
        }
        { print }
    ' "$LOCK" > "$LOCK.tmp-stamp"
    mv "$LOCK.tmp-stamp" "$LOCK"
fi

# Edit via temp files next to the targets, then move over them. The checks
# after each sed verify that only the version line changed.
#
# The inputs are normalised to LF first. On the Windows build leg the
# checkout is CRLF and sed reads the file in text mode, so a rewrite of the
# raw file would come out with LF endings and a raw diff would report every
# line as changed instead of the single version line.
TMP_CONF=$CONF.tmp-stamp
TMP_TOML=$CARGO_TOML.tmp-stamp
CONF_NORM=$CONF.tmp-norm
TOML_NORM=$CARGO_TOML.tmp-norm
trap 'rm -f "$TMP_CONF" "$TMP_TOML" "$CONF_NORM" "$TOML_NORM"' EXIT INT TERM

tr -d '\r' < "$CONF" > "$CONF_NORM"
tr -d '\r' < "$CARGO_TOML" > "$TOML_NORM"

sed "s/\"version\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$CONF_NORM" > "$TMP_CONF"
sed "s/^version[[:space:]]*=[[:space:]]*\"[^\"]*\"/version = \"$NEW_VERSION\"/" "$TOML_NORM" > "$TMP_TOML"

CONF_DIFF=$(diff "$CONF_NORM" "$TMP_CONF" | grep -c '^[<>]' || true)
TOML_DIFF=$(diff "$TOML_NORM" "$TMP_TOML" | grep -c '^[<>]' || true)
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

echo "stamped beta version $NEW_VERSION"
