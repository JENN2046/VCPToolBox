# runtime/VCPToolBox

This directory is reserved for the upstream-tracking VCPToolBox repository.

## Important

If this directory is replaced by a real Git clone of `JENN2046/VCPToolBox`, do not overwrite the repository's own `README.AGENTS_OS.md` blindly.

If needed, save this file as:

```text
README.AGENTS_OS.md
```

## Purpose

VCPToolBox is AGENTS OS's body layer and capability runtime.

It provides:

```text
plugin loading
tool calling
AdminPanel maintenance surface
routes and modules
memory runtime support
provider bridges
external world execution
```

## Must Stay Close To Upstream

This repo should track:

```text
upstream: https://github.com/lioensky/VCPToolBox
fork:    https://github.com/JENN2046/VCPToolBox
```

Do not turn VCPToolBox into a private all-in-one business repo.

## Allowed Jenn Core Patches

Only minimal patches are allowed long-term:

```text
external plugin loader
external agent loader
admin extension loader
local state loader
policy gate hook
bridge plugins
config template additions
```

## Must Not Contain

```text
state-private/
MEMORY.md
AGENTS.override.md
.agent_board/
data/photo-studio/
real .env
real config.env
large domain app source
full Codex governance runtime
```

## Merge Rule

Never merge upstream directly into `main`.

Use:

```bash
git checkout main
git pull origin main
git fetch upstream
git checkout -b merge/upstream-main-YYYYMMDD
git merge --no-ff --no-commit upstream/main
```

Resolve conflicts file by file.

## High-Risk Files

```text
Plugin.js
adminServer.js
server.js
app.js
modelRedirectHandler.js
routes/
modules/
AdminPanel-Vue/
Plugin/
package.json
package-lock.json
config.env.example
```

## Validation

```bash
git status --short
git diff --stat
git diff --name-only --diff-filter=U
npm test
npm run lint
npm run build
```

If the project does not define a script, say so. Do not fake test results.
