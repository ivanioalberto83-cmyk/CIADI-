$ErrorActionPreference = "Continue"

Write-Host "CIADI - Verificacao previa para homologacao local" -ForegroundColor Cyan
Write-Host "Este script NAO liga ao Supabase, NAO pede credenciais e NAO altera bases de dados."
Write-Host ""

function Show-CommandVersion([string]$Name, [string]$VersionArg = "--version") {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host "[EM FALTA] $Name nao encontrado no PATH." -ForegroundColor Yellow
        return $false
    }
    Write-Host "[OK] $Name encontrado: $($cmd.Source)" -ForegroundColor Green
    try { & $Name $VersionArg 2>&1 | Select-Object -First 2 } catch {
        Write-Host "  Nao foi possivel obter versao: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    return $true
}

$nodeOk = Show-CommandVersion "node"
$gitOk = Show-CommandVersion "git"
$supabaseOk = Show-CommandVersion "supabase"

$dockerOk = Show-CommandVersion "docker"
if ($dockerOk) {
    Write-Host ""
    Write-Host "Verificacao do daemon Docker (apenas leitura):"
    docker info --format "Server={{.ServerVersion}} OS={{.OperatingSystem}}" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[AVISO] Docker instalado, mas o daemon nao parece estar activo." -ForegroundColor Yellow
        $dockerOk = $false
    }
}

Write-Host ""
Write-Host "Resumo:"
Write-Host "  Node.js: $nodeOk"
Write-Host "  Git: $gitOk"
Write-Host "  Supabase CLI: $supabaseOk"
Write-Host "  Docker activo: $dockerOk"
Write-Host ""
Write-Host "Proximo passo seguro: partilhar apenas este resumo (sem tokens, passwords, .env ou connection strings)."
Write-Host "NAO executar db push, db reset --linked, migration up --linked ou qualquer comando de escrita remota."
