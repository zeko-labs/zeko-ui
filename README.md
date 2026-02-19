# Zeko UI Monorepo

A pnpm + Moon monorepo for Zeko apps and packages.

[Moon](https://moonrepo.dev/moon) is a task runner and monorepo management tool for the web ecosystem, written in Rust.
[Proto](https://moonrepo.dev/proto) is a version manager for all web languages and tools. A unified toolchain.

## Install

Proto is not necessary, but extremely convenient as it take cares of installing the correct version of Moon, Node, pnpm and Bun.

1. Install Proto (https://moonrepo.dev/docs/proto/install)

```bash
# macOS
brew install git unzip gzip xz

# Ubuntu / Debian
apt-get install git unzip gzip xz-utils

# RHEL-based / Fedora
dnf install git unzip gzip xz

# Linux, macOS, WSL
curl -fsSL https://get.prototools.dev | sh
```

```powershell
# Windows (PowerShell)
irm https://moonrepo.dev/install/proto.ps1 | iex
Set-ExecutionPolicy RemoteSigned
# Without admin privileges
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

2. Install Moon

```bash
proto install moon
```

3. Use Moon to run tasks from the repo root. All tools and dependencies will be installed automatically.

```bash
moon <project>:<task>
```

or within a project:

```bash
moon run <task>
```

## Projects and common tasks

To find out which tasks are available, look at the `moon.yml` files in each project folder.
The tasks in the root `.moon/tasks.yaml` are available to all projects.

## Formatting and checks

- Format entire workspace: `moon format-all`

## Git hooks (Lefthook)

Install hooks manually after dependencies are installed:

```bash
pnpm exec lefthook install
pnpm exec lefthook validate
```

The `pre-commit` hook runs:

- `moon :lint-fix`
- `moon run format-all-fix`

## Discover and diagnose tasks (optional)

Here are some useful commands to explore the monorepo structure and tasks.

```bash
moon task <task>
moon project <project>
moon query projects
```
