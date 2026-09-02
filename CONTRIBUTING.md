# Contributing

This page covers the development setup, the checks every change has to pass, and the rules for commits and pull requests. The user-facing docs live in `docs/`; this file is for contributors.

## Development setup

The full walkthrough is in [docs/development.md](docs/development.md): prerequisites per OS, the Tauri CLI install, and running the app against a local persea server. Rust 1.88 or newer comes via rustup. Node and npm are only needed for the end-to-end suite in `tests/e2e/`; the shell frontend in `shell/` is plain HTML and JavaScript with no build step.

## Checks

Run the Rust gates from `src-tauri/`:

```sh
cargo check
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt --all --check
```

CI runs the same gates on Windows, Linux and macOS on every pull request. Clippy and the formatter are stricter than `cargo check`, so run the full set before you push.

Dependency-facing changes get two more checks: `cargo audit` for known vulnerabilities and `cargo deny check` for licenses and sources. The policy for `cargo deny` lives in `deny.toml` at the repository root.

The end-to-end suite drives the built app through tauri-driver. It is summarized in [docs/development.md](docs/development.md) and documented in full in [tests/e2e/README.md](tests/e2e/README.md). Lint and test commands for the shell pages will run from the repository root with npm once the frontend tooling lands; today the shell has no build or test step.

## Commits

Commit messages follow Conventional Commits: a type prefix such as `fix:`, `feat:`, `docs:`, `test:`, `chore:` or `ci:`, then a short summary. Reference the issue the change belongs to in the subject, for example `fix: keep the tray icon in sync on Wayland (persea-desktop#42)`. When the pull request closes its issue, add `Closes #N` to the description.

## Signed commits

The MainProtection ruleset on `main` requires signed commits, so unsigned commits are rejected on push. Configure signing once, with SSH or GPG.

SSH signing:

```sh
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

Then add the same public key on GitHub under Settings → SSH and GPG keys, marked as a signing key.

GPG signing:

```sh
gpg --full-generate-key
git config --global gpg.format openpgp
git config --global user.signingkey KEY-ID
```

Add the public key on GitHub under the same settings page. GitHub documents both flows in "Managing commit signature verification".

## Ruleset bypass policy

MainProtection protects the `main` branch: signed commits, linear history, and required CodeQL results. Bypassing the ruleset is limited to the repository admin role and to emergencies, for example an incident or a release blocker.

Every bypass use gets a comment on the related issue explaining why the bypass was needed and which checks it skipped. The comment is part of the procedure.

## Pull requests

One change per pull request. The description states what changed and why, and references the issues it resolves. The PR template carries the gate checklist, and the code owner is requested for review automatically.
