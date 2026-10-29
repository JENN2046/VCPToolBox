# Local Windows x64 only. Writes to a new output directory; never installs a
# payload into SourceRoot or changes its loader, branches, services, or receipts.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$SourceRoot,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ExpectedCommit,
    [Parameter(Mandatory=$true)][string]$OutputRoot
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT' -or [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() -ne 'X64') {
    throw 'WINDOWS_NATIVE_VERIFICATION_BLOCKED: a real Windows x64 environment is required; no Wine or cross-build substitute.'
}
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
if ($OutputRoot.StartsWith($SourceRoot.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'OutputRoot must be outside the source checkout.'
}
if (Test-Path -LiteralPath $OutputRoot) { throw 'OutputRoot must be a new isolated directory.' }
foreach ($command in @('git','node','npm.cmd','cargo','rustc','cl.exe','link.exe')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Missing Windows build prerequisite: $command" }
}
$identity = (& node -p "JSON.stringify({platform:process.platform,arch:process.arch,node:process.version,napi:process.versions.napi})") | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $identity.platform -ne 'win32' -or $identity.arch -ne 'x64' -or $identity.node -ne 'v22.23.1') {
    throw 'Expected actual Windows x64 Node v22.23.1.'
}
$head = (& git -C $SourceRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $ExpectedCommit) { throw 'SourceRoot HEAD differs from the explicitly selected R1-C commit.' }
& git -C $SourceRoot diff --quiet $ExpectedCommit -- .
if ($LASTEXITCODE -ne 0) { throw 'Tracked source differs from ExpectedCommit; use a clean isolated checkout.' }
foreach ($config in @('config.env','.env','Plugin/RAGDiaryPlugin/config.env')) {
    if (Test-Path -LiteralPath (Join-Path $SourceRoot $config)) { throw "Runtime configuration is forbidden in this test checkout: $config" }
}
# Dependencies must have been installed for Windows in this isolated checkout.
& node -e "const D=require(process.argv[1]); const d=new D(':memory:'); d.close();" (Join-Path $SourceRoot 'node_modules/better-sqlite3')
if ($LASTEXITCODE -ne 0) { throw 'Build the isolated Windows better-sqlite3 dependency first.' }
$rust = (& rustc +1.89.0 --version --verbose 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $rust -notmatch '(?m)^release: 1\.89\.0\s*$' -or $rust -notmatch '(?m)^host: x86_64-pc-windows-msvc\s*$') {
    throw 'Rust 1.89.0 native x86_64-pc-windows-msvc toolchain is required.'
}
New-Item -ItemType Directory -Path $OutputRoot | Out-Null
$logRoot = Join-Path $OutputRoot 'logs'
New-Item -ItemType Directory -Path $logRoot | Out-Null
$rust | Set-Content -LiteralPath (Join-Path $logRoot 'rustc.txt') -Encoding utf8
& cargo +1.89.0 --version 2>&1 | Set-Content -LiteralPath (Join-Path $logRoot 'cargo.txt') -Encoding utf8
$identity | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'node.json') -Encoding utf8
# cl /Bv without an input may exit nonzero; record identity without treating
# its documented missing-input exit as a build/test success or failure.
$previousErrors = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    & cl.exe /Bv 2>&1 | Set-Content -LiteralPath (Join-Path $logRoot 'msvc.txt') -Encoding utf8 -ErrorAction Stop
} finally { $ErrorActionPreference = $previousErrors }
$toolPaths = foreach ($name in @('cl.exe','link.exe')) {
    $file = Get-Item -LiteralPath (Get-Command $name).Source
    @{ name=$name; path=$file.FullName; fileVersion=$file.VersionInfo.FileVersion;
       sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$toolPaths | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'msvc-tools.json') -Encoding utf8
[System.Environment]::OSVersion.VersionString | Set-Content -LiteralPath (Join-Path $logRoot 'windows-version.txt') -Encoding utf8
function Invoke-Recorded([string]$Executable, [string[]]$Arguments, [string]$LogFile) {
    $previousErrors = $ErrorActionPreference
    try {
        # Native compilers normally write progress to stderr. Capture it, and
        # enforce the actual exit code; log-write errors still terminate.
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments 2>&1 | Tee-Object -FilePath $LogFile -ErrorAction Stop
        $commandExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousErrors }
    if ($commandExit -ne 0) { throw "Command failed ($commandExit); see $LogFile" }
}
$oldLocation = Get-Location
$oldToolchain = $env:RUSTUP_TOOLCHAIN
$oldFlags = $env:RUSTFLAGS
$oldEncodedFlags = $env:CARGO_ENCODED_RUSTFLAGS
$oldTarget = $env:CARGO_TARGET_DIR
try {
    $env:RUSTUP_TOOLCHAIN = '1.89.0'
    $env:RUSTFLAGS = ''
    $env:CARGO_ENCODED_RUSTFLAGS = ''
    Set-Location -LiteralPath $SourceRoot
    # Validate existing source inventory without replacing the historical receipt.
    Invoke-Recorded 'node' @('scripts/check-native-delivery.cjs','x86_64-unknown-linux-gnu','vexus','--receipt','docs/native-delivery-upstream-r1-linux.json') (Join-Path $logRoot 'source-inventory.txt')
    $receipt = Get-Content -LiteralPath 'docs/native-delivery-upstream-r1-linux.json' -Raw | ConvertFrom-Json
    $tools = Join-Path $OutputRoot 'tools'
    Invoke-Recorded 'npm.cmd' @('install','--prefix',$tools,'--ignore-scripts','--no-audit','--no-fund','@napi-rs/cli@2.18.4') (Join-Path $logRoot 'napi-install.txt')
    $napi = Join-Path $tools 'node_modules/.bin/napi.cmd'
    $binaries = @()
    foreach ($iteration in @(1,2)) {
        $buildRoot = Join-Path $OutputRoot "build-$iteration"
        foreach ($inputFile in $receipt.source_inputs.vexus) {
            $relative = [string]$inputFile.path
            if ($relative -notmatch '^rust-vexus-lite/' -or $relative -match '(^|/)\.\.(/|$)') { throw 'Unsafe source inventory path.' }
            $destination = Join-Path $buildRoot $relative
            New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
            Copy-Item -LiteralPath (Join-Path $SourceRoot $relative) -Destination $destination
        }
        $nativeRoot = Join-Path $buildRoot 'rust-vexus-lite'
        $env:CARGO_TARGET_DIR = Join-Path $buildRoot 'target'
        Set-Location -LiteralPath $nativeRoot
        Invoke-Recorded $napi @('build','--platform','--release','--cargo-flags=--locked') (Join-Path $logRoot "build-$iteration.txt")
        $binary = Join-Path $nativeRoot 'vexus-lite.win32-x64-msvc.node'
        if (-not (Test-Path -LiteralPath $binary)) { throw 'Expected native Windows output was not produced.' }
        $binaries += $binary
    }
    $signatureStates = foreach ($binary in $binaries) {
        $signature = Get-AuthenticodeSignature -FilePath $binary
        @{ path=$binary; status=$signature.Status.ToString(); statusMessage=$signature.StatusMessage }
    }
    $signatureStates | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'authenticode.json') -Encoding utf8
    Set-Location -LiteralPath $SourceRoot
    Invoke-Recorded 'node' @('scripts/check-vexus-windows-candidate.cjs',$SourceRoot,$ExpectedCommit,$binaries[0],$binaries[1],(Join-Path $OutputRoot 'proof')) (Join-Path $logRoot 'candidate-verification.txt')
    & git -C $SourceRoot diff --quiet $ExpectedCommit -- .
    if ($LASTEXITCODE -ne 0) { throw 'SourceRoot changed during validation.' }
    Write-Output 'Build and selected Windows tests completed. Inspect proof/result.json and remaining loader-version boundary before independent review; this is not deployment approval.'
} finally {
    Set-Location $oldLocation
    $env:RUSTUP_TOOLCHAIN = $oldToolchain
    $env:RUSTFLAGS = $oldFlags
    $env:CARGO_ENCODED_RUSTFLAGS = $oldEncodedFlags
    $env:CARGO_TARGET_DIR = $oldTarget
}
