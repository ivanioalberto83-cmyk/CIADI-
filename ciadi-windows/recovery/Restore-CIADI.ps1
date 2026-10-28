[CmdletBinding()]
param(
  [Parameter(Mandatory=$false)]
  [string]$BackupPath,
  [Parameter(Mandatory=$false)]
  [switch]$ConfirmRestore
)

$ErrorActionPreference = 'Stop'
$recoveryRoot = Join-Path $env:LOCALAPPDATA 'CIADI\Recovery'

if (-not $BackupPath) {
  if (-not (Test-Path $recoveryRoot)) {
    throw "Não existem pontos de recuperação em $recoveryRoot"
  }
  $latest = Get-ChildItem -Path $recoveryRoot -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { throw "Nenhum ponto de recuperação encontrado." }
  $BackupPath = $latest.FullName
}

$manifestPath = Join-Path $BackupPath 'manifest.json'
$appBackup = Join-Path $BackupPath 'app'
if (-not (Test-Path $manifestPath) -or -not (Test-Path $appBackup)) {
  throw "Ponto de recuperação inválido: falta manifest.json ou pasta app."
}
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$target = [string]$manifest.installPath
if (-not $target -or -not (Test-Path $target)) {
  throw "A pasta de instalação original não existe. Instale a versão CIADI compatível antes de restaurar."
}

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  throw "Execute o PowerShell como Administrador para restaurar ficheiros instalados em Program Files."
}
if (-not $ConfirmRestore) {
  Write-Host "Ponto: $BackupPath"
  Write-Host "Versão guardada: $($manifest.appVersion)"
  Write-Host "Destino: $target"
  throw "A restauração não foi executada. Reveja o destino e execute novamente com -ConfirmRestore."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$currentCopy = Join-Path $recoveryRoot "before-restore-$stamp"
New-Item -ItemType Directory -Path $currentCopy -Force | Out-Null
if (Test-Path $target) {
  Copy-Item -Path $target -Destination (Join-Path $currentCopy 'app') -Recurse -Force
}
@{
  createdAt = (Get-Date).ToString('o')
  purpose = 'Cópia de segurança imediatamente antes da restauração'
  target = $target
} | ConvertTo-Json | Set-Content -Path (Join-Path $currentCopy 'manifest.json') -Encoding UTF8

Get-ChildItem -Path $target -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $appBackup '*') -Destination $target -Recurse -Force
Write-Host "Ficheiros da aplicação restaurados a partir de $BackupPath"
Write-Host "Cópia anterior preservada em $currentCopy"
Write-Host "Abra o CIADI e valide login, ligação Supabase e módulos críticos antes de retomar operações."
