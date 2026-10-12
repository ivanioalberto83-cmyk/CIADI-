# CIADI Dashboard para Windows

Este diretório contém o empacotamento Electron/NSIS para gerar `CIADI-Setup-1.0.0.exe` e verificar atualizações publicadas em GitHub Releases.

## Como gerar o instalador
1. A raiz do repositório deve conter o ficheiro original `CIADI_DASHBOARD_FINANCEIRO(1).html`.
2. Abra **Actions → CIADI Windows Setup → Run workflow**.
3. Aguarde o job terminar e descarregue o artefacto **CIADI-Windows-Setup**.
4. Para publicar uma versão de atualização, aumente `version` em `package.json`, faça commit e crie uma tag `ciadi-v1.0.1` (a primeira versão usa `ciadi-v1.0.0`).

## Atualizações
As atualizações usam GitHub Releases do repositório `ivanioalberto83-cmyk/CIADI-`. A publicação por tag cria a release e inclui o instalador, `latest.yml` e os ficheiros blockmap.

## Assinatura do executável
A assinatura criptográfica do Setup.exe requer um certificado de assinatura de código apropriado. Configure os secrets `CSC_LINK` e `CSC_KEY_PASSWORD` apenas depois de obter o certificado. Não coloque certificados, palavras-passe, chaves privadas ou segredos Supabase no código.

## Estado
O workflow compila o executável em Windows; este ficheiro de configuração não é o próprio Setup.exe. A compilação só pode ser validada depois de executar o workflow com o dashboard original disponível na raiz do repositório.
