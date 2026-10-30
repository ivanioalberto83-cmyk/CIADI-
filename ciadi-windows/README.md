# CIADI Dashboard para Windows

Este diretório empacota o dashboard existente como aplicação Windows (Electron/NSIS). O objetivo é preservar a estrutura e o funcionamento do dashboard: a camada Electron serve para instalar e atualizar a aplicação; não reescreve os módulos nem migra automaticamente o Supabase.

## Fonte da aplicação
- A fonte canónica do Dashboard é `CIADI_DASHBOARD_FINANCEIRO.html`, na raiz do repositório.
- O workflow `CIADI Windows Setup` copia essa fonte para `ciadi-windows/index.html` antes da compilação; o ficheiro de origem não é editado durante o build.
- `index.html` na raiz é actualmente uma cópia byte-a-byte da fonte canónica (mesmo blob SHA na revisão auditada), mas não é consumido pelo workflow Windows. Não edite as duas cópias em separado: alterações funcionais devem ser feitas na fonte canónica e a duplicação deverá ser tratada numa etapa própria, depois de confirmar os consumidores do `index.html` raiz.

## Gerar um instalador de teste
1. Abra **Actions → CIADI Windows Setup → Run workflow**.
2. Aguarde o job terminar com sucesso.
3. Descarregue o artefacto **CIADI-Windows-Setup**. Esse artefacto é de teste e fica disponível durante 14 dias.

## Publicar uma atualização automática
1. Confirme que o HTML atualizado está na raiz e que foi testado.
2. Crie e envie uma tag de versão no formato `ciadi-vMAJOR.MINOR.PATCH`, por exemplo `ciadi-v1.0.1`.
3. O workflow sincroniza a versão do pacote com a tag, compila o instalador e publica a release com `CIADI-Setup-*.exe`, `latest.yml` e os ficheiros `*.blockmap`.
4. As instalações existentes verificam a GitHub Release através de `electron-updater`; o utilizador pode descarregar a atualização e reiniciar para a aplicar.

A versão tem de aumentar em cada release. Não publique novamente a mesma versão com conteúdo diferente.

## Proteção dos dados e do Supabase
- O atualizador substitui os ficheiros da aplicação, não deve apagar a pasta de dados do utilizador e o instalador está configurado para não eliminar os dados da aplicação ao desinstalar.
- Não faça alterações destrutivas ao esquema do Supabase como parte de uma atualização normal. Se uma funcionalidade exigir mudanças de base de dados, use migrações SQL versionadas, com compatibilidade retroativa, backup e validação antes de produção.
- Não coloque service-role keys, palavras-passe, tokens, certificados ou chaves privadas no HTML, repositório ou pacote. O browser não deve receber credenciais administrativas do Supabase.

## Assinatura
A assinatura de produção do executável requer um certificado de assinatura de código válido. Configure os secrets `CSC_LINK` e `CSC_KEY_PASSWORD` somente depois de obter o certificado. Sem esse certificado, o Windows poderá apresentar avisos de editor desconhecido.

## Limitação atual
O Setup.exe e as atualizações automáticas só ficam validados após uma compilação Windows bem-sucedida e uma release publicada. A fonte `CIADI_DASHBOARD_FINANCEIRO.html` tem de estar na raiz do repositório para o workflow concluir.


## Módulo de homologação biométrica — ZKTeco K20 Pro

O pacote inclui `biometric-k20pro.html`, acessível pelo menu da aplicação **CIADI → Assiduidade Biométrica (ZKTeco K20 Pro) — Homologação**.

Estado nesta fase:
- Importa e valida localmente ficheiros CSV exportados pelo software do terminal.
- Permite mapear as colunas de matrícula/código e data/hora.
- Mostra uma prévia e sinaliza duplicados, campos em falta e datas/hora não reconhecidas.
- Não consulta nem grava no Supabase, não transmite o CSV e não se liga ao terminal por TCP/IP.
- A ligação direta depende da confirmação do firmware, protocolo e SDK/API pelo fornecedor.
- O módulo é uma ferramenta de homologação local, não um sistema de assiduidade já homologado.

A página é incluída no instalador Windows. Esta alteração de código não publica uma release automaticamente; a compilação de teste tem de concluir com sucesso no GitHub Actions.
