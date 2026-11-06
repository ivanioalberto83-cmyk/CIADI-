# CIADI Dashboard para Windows

Este diretório empacota o dashboard existente como aplicação Windows (Electron/NSIS). O objetivo é preservar a estrutura e o funcionamento do dashboard: a camada Electron serve para instalar e atualizar a aplicação; não reescreve os módulos nem migra automaticamente o Supabase.

## Fonte da aplicação
- A raiz do repositório deve conter `CIADI_DASHBOARD_FINANCEIRO.html`.
- A compilação copia esse ficheiro para `ciadi-windows/index.html` sem editar o original.
- Não substitua nem reorganize a estrutura do dashboard para publicar uma atualização. Faça alterações funcionais no ficheiro original, teste-as e mantenha uma cópia/commit da versão anterior.

## Estações e identidade visual do Setup
- O instalador permite seleccionar, de forma independente, uma ou várias estações: CIADI ADM, CIADI Suporte Informático, CIADI Recursos Humanos e CIADI Receção.
- É criada uma ligação própria no Ambiente de Trabalho e no menu Iniciar para cada estação seleccionada.
- ADM e Suporte Informático não exigem escolha de polo. RH e/ou Receção exigem a escolha inicial de Talatona ou Jardim de Rosas.
- O perfil passado pelo atalho identifica o contexto de entrada; não concede permissões. O login é obrigatório e as permissões continuam dependentes da conta autenticada.
- O workflow extrai o logótipo PNG incorporado no Dashboard e gera `ciadi.ico`, utilizado no executável, instalador e atalhos.

## Gerar um instalador de homologação
1. Abra **Actions → CIADI Setup Homologation → Run workflow** ou envie alterações para a branch de correcção.
2. Aguarde os testes de contrato e a compilação Windows terminarem com sucesso.
3. Descarregue o artefacto **CIADI-Setup-1.0.5-Homologacao**. O artefacto é de teste, não uma release, e fica disponível durante 14 dias.

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
O Setup.exe e as atualizações automáticas só ficam validados após uma compilação Windows bem-sucedida e uma release publicada. A fonte `CIADI_DASHBOARD_FINANCEIRO(1).html` ainda tem de estar na raiz do repositório para o workflow concluir.


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
