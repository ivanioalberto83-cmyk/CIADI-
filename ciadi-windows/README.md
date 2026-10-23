# CIADI Dashboard para Windows

Este diretório empacota o dashboard existente como aplicação Windows (Electron/NSIS). O objetivo é preservar a estrutura e o funcionamento do dashboard: a camada Electron serve para instalar e atualizar a aplicação; não reescreve os módulos nem migra automaticamente o Supabase.

## Fonte da aplicação
- A raiz do repositório deve conter `CIADI_DASHBOARD_FINANCEIRO.html`.
- O workflow valida esse ficheiro e copia-o para `ciadi-windows/index.html` sem editar o original.
- Não substitua nem reorganize a estrutura do dashboard para publicar uma atualização. Faça alterações funcionais no ficheiro original, teste-as e mantenha uma cópia/commit da versão anterior.

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
O Setup.exe e as atualizações automáticas só ficam validados após uma compilação Windows bem-sucedida e uma release publicada. O workflow usa `CIADI_DASHBOARD_FINANCEIRO.html` na raiz. A compilação real e o teste do instalador continuam obrigatórios antes de distribuir a atualização.
