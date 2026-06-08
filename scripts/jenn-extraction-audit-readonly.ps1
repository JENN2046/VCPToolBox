param(
    [string]$ZipPath = "C:\Users\617\Downloads\vcptoolbox_jenn_extraction_package_20260608.zip"
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Output ""
    Write-Output "## $Title"
}

function Test-RepositoryPath {
    param([string]$RelativePath)
    $normalized = $RelativePath -replace "/", [System.IO.Path]::DirectorySeparatorChar
    return Test-Path -Path $normalized
}

function Write-PathStatus {
    param(
        [string]$Group,
        [string[]]$Paths
    )

    Write-Section $Group
    foreach ($path in $Paths) {
        if (Test-RepositoryPath $path) {
            Write-Output "FOUND`t$path"
        } else {
            Write-Output "MISSING`t$path"
        }
    }
}

function Get-SecretRiskKind {
    param([string]$Path)

    if ($Path -match "(^|/|\\)(\.env(\..*)?|config\.env)$") {
        return "env_or_config_file"
    }
    if ($Path -match "\.(pem|key|p12)$") {
        return "key_material_path"
    }
    if ($Path -match "(?i)(secret|token|password|passwd|apikey|api_key)") {
        return "secret_like_path"
    }
    return $null
}

function New-AgentPathFromCodePoints {
    param([int[]]$CodePoints)
    $name = -join ($CodePoints | ForEach-Object { [char]$_ })
    return "Agent/$name.txt"
}

Write-Output "# Jenn extraction readonly audit"
Write-Output "mode`tREAD_ONLY"
Write-Output "zip`t$ZipPath"

Write-Section "git"
git branch --show-current
git status --short
git rev-parse HEAD

Write-Section "zip package"
if (Test-Path -LiteralPath $ZipPath) {
    $zipItem = Get-Item -LiteralPath $ZipPath
    Write-Output "FOUND`t$($zipItem.FullName)`t$($zipItem.Length) bytes"
} else {
    Write-Output "MISSING`t$ZipPath"
}

$extractNow = @(
    ".agent_board",
    "AGENTS.override.md",
    "MEMORY.md",
    "data/photo-studio",
    "README For VCPChat.md",
    "Plugin/AIGentOrchestrator",
    "Plugin/AIGentPrompt",
    "Plugin/AIGentQuality",
    "Plugin/AIGentStyle",
    "Plugin/AIGentWorkflow",
    "Plugin/CodexMemoryBridge",
    "Plugin/DingTalkCLI",
    "Plugin/DingTalkTable",
    "Plugin/ImageAutoRegister",
    "Plugin/ImageRatingManager",
    "Plugin/PhotoStudioAssetArchive"
)

$extractAfterLoader = @(
    "Agent/AIImageGenExpert.txt",
    "Agent/AuditMaster.txt",
    "Agent/MemoriaSorter.txt",
    "Agent/Muse.txt",
    (New-AgentPathFromCodePoints @(0x52A8, 0x529B, 0x731B, 0x517D)),
    (New-AgentPathFromCodePoints @(0x5C0F, 0x79CB)),
    (New-AgentPathFromCodePoints @(0x8BFA, 0x5B9D)),
    "Agent/Metis.txt",
    "Agent/Nova.txt",
    "AdminPanel-Vue/src/views/AiImageAgents.vue",
    "AdminPanel-Vue/src/views/ChannelHubManager.vue",
    "AdminPanel-Vue/src/views/CodexImagegenRelay.vue",
    "AdminPanel-Vue/src/views/CodexMemoryMonitor.vue",
    "AdminPanel-Vue/src/views/OAuthAuthCenter.vue",
    "AdminPanel-Vue/src/api/aiImageAgents.ts",
    "AdminPanel-Vue/src/api/channelHub.ts",
    "AdminPanel-Vue/src/api/codexImagegenRelay.ts",
    "AdminPanel-Vue/src/api/codexMemory.ts",
    "AdminPanel-Vue/src/api/oauthAuth.ts"
)

$keepAsCorePatch = @(
    "Plugin.js",
    "adminServer.js",
    "KnowledgeBaseManager.js",
    "EmbeddingUtils.js",
    "TagMemoEngine.js",
    "modelRedirectHandler.js",
    "AdminPanel-Vue/src/api/index.ts",
    "AdminPanel-Vue/src/app/routes/manifest.ts",
    "AdminPanel-Vue/src/app/routes/components.ts",
    "AdminPanel-Vue/vite.config.ts",
    ".gitignore",
    "config.env.example",
    "package.json",
    "package-lock.json",
    "AdminPanel-Vue/package.json",
    "AdminPanel-Vue/package-lock.json"
)

$neverCommitPublicly = @(
    ".env",
    ".env.*",
    "config.env",
    "Plugin/**/config.env",
    "real_tokens",
    "real_api_keys",
    "private_runtime_cache",
    "browser_history",
    "account_passwords"
)

Write-PathStatus "extract_now inventory" $extractNow
Write-PathStatus "extract_after_loader inventory" $extractAfterLoader
Write-PathStatus "keep_as_core_patch inventory" $keepAsCorePatch
Write-PathStatus "never_commit_publicly inventory" $neverCommitPublicly

Write-Section "loader capability probe"
$loaderNeedles = @(
    "VCP_PLUGIN_DIRS",
    "VCP_AGENT_DIRS",
    "VCP_AGENT_OVERRIDE_DIRS",
    "VCP_LOCAL_STATE_DIR",
    "VCP_ADMIN_EXTENSION_DIRS"
)
foreach ($needle in $loaderNeedles) {
    $matches = rg -n --fixed-strings $needle Plugin.js adminServer.js server.js modules AdminPanel-Vue/src 2>$null
    if ($LASTEXITCODE -eq 0 -and $matches) {
        Write-Output "FOUND`t$needle"
        $matches | ForEach-Object { Write-Output "  $_" }
    } else {
        Write-Output "MISSING`t$needle"
    }
}

Write-Section "secret-risk paths only"
$trackedFiles = git ls-files
foreach ($path in $trackedFiles) {
    $risk = Get-SecretRiskKind $path
    if ($risk) {
        Write-Output "$risk`t$path"
    }
}

Write-Section "env/config paths only"
$configPaths = @()
foreach ($path in @(".env", "config.env")) {
    if (Test-Path -LiteralPath $path) {
        $configPaths += $path
    }
}
if (Test-Path -Path "Plugin") {
    $configPaths += Get-ChildItem -Path "Plugin" -Recurse -File -Filter "config.env" -Force -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName.Substring((Get-Location).Path.Length + 1) }
}
if ($configPaths.Count -eq 0) {
    Write-Output "NONE"
} else {
    $configPaths | Sort-Object -Unique | ForEach-Object { Write-Output "env_or_config_file`t$_" }
}

Write-Section "classification"
Write-Output "Full absorb`tpackage documentation strategy, inventory model, secret-risk paths-only rule"
Write-Output "Selective absorb`tloader patches, copy-first extraction flow"
Write-Output "Observe only`tAdminPanel dynamic extension loader, LocalState full migration, large stub/remove phase"

Write-Section "readonly guarantees"
Write-Output "no_fetch"
Write-Output "no_extract"
Write-Output "no_copy"
Write-Output "no_move"
Write-Output "no_delete"
Write-Output "no_secret_content_read"
