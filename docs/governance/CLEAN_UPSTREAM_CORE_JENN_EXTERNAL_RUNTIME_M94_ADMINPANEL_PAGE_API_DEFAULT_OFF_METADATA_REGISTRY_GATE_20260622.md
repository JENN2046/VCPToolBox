# M94 AdminPanel Page/API Default-Off Metadata Registry Gate

Date: 2026-06-22

Status: PASS

Decision: `DEFAULT_OFF_METADATA_REGISTRY_IMPLEMENTED_NO_DYNAMIC_RUNTIME`

## 1. Scope

M94 adds a pure metadata-only registry for the M93 reviewed AdminPanel page/API external packages.

Allowed in M94:

- parse external `AdminExtensions/*/admin-extension-manifest.json`;
- read `frontend.plannedRoutes` labels and package status;
- return route label metadata, package metadata, and guard status for scoped local validation;
- keep the registry disabled unless explicitly enabled through a scoped metadata flag.

M94 did not:

- connect metadata to production AdminPanel route/nav;
- dynamically import or execute external Vue;
- require or execute external API modules;
- mount backend runtime routes;
- write real `.env` / `config.env`;
- modify external package content;
- run AdminPanel build or modify `AdminPanel-Vue/dist/**`;
- start production server;
- call provider, OAuth, bridge, live write, sync, publish, or deployment endpoints.

## 2. Implementation

Changed files:

```text
modules/adminExtensionRegistry.js
tests/admin-extension-registry.test.js
```

New exported metadata gate:

```text
VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED
buildAdminExtensionMetadataRegistry()
```

Default-off behavior:

```text
metadataRegistryEnabled=false
runtimeEnabled=false
metadataPackages=[]
frontendMetadataRoutes=[]
diagnostics=admin_extension_metadata_registry_disabled:1
```

When explicitly enabled with scoped env in tests, the registry requires:

```text
VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED=1
VCP_ADMIN_EXTENSION_ALLOWED_ROOTS=<external root>
VCP_ADMIN_EXTENSION_DIRS=<reviewed package dirs>
VCP_ADMIN_EXTENSION_ALLOWLIST=<reviewed extension ids>
```

No real config was changed.

## 3. Exposed Metadata Only

The registry may expose:

- `extensionId`;
- `displayName`;
- sanitized `description`;
- `sourcePackage`;
- `copyFirstContentIncluded`;
- `reviewRequired`;
- `reviewCompleted`;
- `routeId`;
- `routeName`;
- `title`;
- `navGroup`;
- `showInSidebar`;
- `requiresAuth`;
- `contentCopied`;
- boolean `componentRefPresent`;
- boolean `apiModuleRefPresent`.

The registry does not expose:

- raw component paths;
- raw API module paths;
- absolute filesystem paths for Vue/API execution;
- token, secret, provider key, credential, or auth material;
- executable loader functions;
- mounted routes.

## 4. M93 Package Evidence

Scoped enabled harness result:

```text
metadataRegistryEnabled=true
runtimeEnabled=false
packageCount=5
routeCount=5
registeredPackageCount=5
exposedRawComponentRefs=false
exposedRawApiRefs=false
diagnostics=none
```

OAuthAuthCenter remains guarded:

```text
reviewRequired=[
  "runtime-action-guard-before-mount",
  "no-provider-or-upstream-smoke-without-explicit-runtime-gate"
]
```

## 5. Validation

Commands:

```text
node --check modules\adminExtensionRegistry.js
node tests\admin-extension-registry.test.js
node tests\admin-extension-runtime-mount.test.js
```

Results:

```text
adminExtensionRegistry syntax PASS
admin-extension-registry.test.js: 7 pass / 0 fail
admin-extension-runtime-mount.test.js: 3 pass / 0 fail
```

Scoped harness:

```text
disabled.packageCount=0
disabled.routeCount=0
enabled.packageCount=5
enabled.routeCount=5
enabled.runtimeEnabled=false
enabled.exposedRawComponentRefs=false
enabled.exposedRawApiRefs=false
```

## 6. Safety Confirmations

```text
dynamic_frontend_runtime_enabled=no
production_router_modified=no
frontend_route_nav_modified=no
AdminPanel_dist_modified=no
real_config_env_written=no
external_package_modified=no
provider_or_oauth_action_called=no
bridge_or_live_write_called=no
production_server_started=no
LocalState_private_read=no
```

## 7. Rollback

Rollback is scoped to the core M94 commit:

```text
git revert <M94 core commit>
```

This removes the metadata-only builder/tests and returns M93 package content to its prior external package state. It does not affect real config or external package files.

## 8. Next Gate

Next planned gate:

```text
M95_ADMINPANEL_PAGE_API_METADATA_REGISTRY_REVIEW_OR_ROUTE_NAV_TASKBOOK_DECISION
```

M95 must still not enable dynamic external Vue runtime, write real config, run build/dist, call OAuth/provider actions, or remove core fallback without a separate explicit gate.
