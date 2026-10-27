# CIADI Dashboard para Windows

Este diretório empacota o dashboard existente como aplicação Windows (Electron/NSIS). A camada Electron instala e atualiza a aplicação; não reescreve os módulos nem migra automaticamente o Supabase.

## Fonte da aplicação
- O workflow `.github/workflows/ciadi-windows-setup.yml` espera o ficheiro `CIADI_DASHBOARD_FINANCEIRO.html` na raiz do repositório.
- Na compilação, esse ficheiro é copiado para `ciadi-windows/index.html` sem editar o original.
- O mesmo HTML deve conter o logótipo PNG oficial incorporado, porque o workflow tenta extrair daí o ícone Windows.
- Não substitua nem reorganize a estrutura do dashboard para publicar uma atualização. Faça alterações funcionais no ficheiro original, teste-as e mantenha uma cópia/commit da versão anterior.

## Gerar um instalador de teste
1. Abra **Actions → CIADI Windows Setup → Run workflow**.
2. Selecione a branch que contém a versão a testar (normalmente `main`, depois de as alterações terem sido aprovadas e integradas).
3. Aguarde o job terminar com sucesso.
4. Descarregue o artefacto **CIADI-Windows-Setup**. O workflow configura retenção de 14 dias.
5. Instale num Windows de teste e valide os itens da secção **Lista de homologação** abaixo antes de distribuir o instalador.

## Lista de homologação
- [ ] O workflow conclui sem erros e o artefacto contém `CIADI-Setup-*.exe`.
- [ ] O instalador abre, permite escolher a pasta e cria atalhos.
- [ ] A aplicação abre e apresenta o logótipo CIADI correto.
- [ ] O login funciona com uma conta de teste autorizada; não guardar credenciais de produção no pacote.
- [ ] A ligação ao Supabase funciona com permissões normais e RLS preservada.
- [ ] Leitura, gravação autorizada, persistência e relatórios são testados com dados fictícios/de homologação.
- [ ] Os menus e módulos existentes, incluindo o módulo biométrico, abrem sem erros.
- [ ] Atualização e desinstalação não apagam dados do utilizador.
- [ ] Backup e restauro são verificados antes de qualquer mudança sensível.
- [ ] Registo da versão, resultado dos testes e limitações conhecidas ficam documentados.

Não marque um item como concluído sem evidência de teste. Uma compilação bem-sucedida, por si só, não comprova a integração funcional nem a conformidade legal/fiscal.

## Publicar uma atualização automática
1. Confirme que o HTML atualizado está na raiz e que foi testado e aprovado.
2. Crie e envie uma tag de versão no formato `ciadi-vMAJOR.MINOR.PATCH`, por exemplo `ciadi-v1.0.1`.
3. O workflow sincroniza a versão do pacote com a tag, compila o instalador e publica a release com `CIADI-Setup-*.exe`, `latest.yml` e ficheiros `*.blockmap`.
4. As instalações existentes verificam as GitHub Releases através de `electron-updater`; o utilizador pode descarregar a atualização e reiniciar para a aplicar.

A versão tem de aumentar em cada release. Não publique novamente a mesma versão com conteúdo diferente. Não crie uma tag de produção antes da homologação e da autorização de publicação.

## Proteção dos dados e do Supabase
- O atualizador substitui ficheiros da aplicação. O instalador está configurado para não eliminar os dados da aplicação ao desinstalar, mas isso não substitui backups e teste de restauro.
- Não faça alterações destrutivas ao esquema do Supabase como parte de uma atualização normal. Se uma funcionalidade exigir mudanças de base de dados, use migrações SQL versionadas, compatibilidade retroativa, backup e validação antes de produção.
- Não coloque service-role keys, palavras-passe, tokens, certificados ou chaves privadas no HTML, repositório ou pacote. O browser não deve receber credenciais administrativas do Supabase.
- Não altere dados, RLS, políticas ou chaves de produção sem autorização explícita.

## Assinatura
A assinatura de produção do executável requer um certificado de assinatura de código válido. Configure os secrets `CSC_LINK` e `CSC_KEY_PASSWORD` apenas depois de obter o certificado. Sem esse certificado, o Windows poderá apresentar avisos de editor desconhecido. A assinatura não deve ser presumida sem evidência na release.

## Módulo de homologação biométrica — ZKTeco K20 Pro
O pacote inclui `biometric-k20pro.html`, acessível pelo menu da aplicação **CIADI → Assiduidade Biométrica (ZKTeco K20 Pro) — Homologação**.

Estado documentado do módulo:
- Importa e valida localmente ficheiros CSV exportados pelo software do terminal.
- Permite mapear colunas de matrícula/código e data/hora.
- Mostra uma prévia e sinaliza duplicados, campos em falta e datas/hora não reconhecidas.
- Não consulta nem grava no Supabase, não transmite o CSV e não se liga ao terminal por TCP/IP.
- A ligação direta depende da confirmação do firmware, protocolo e SDK/API pelo fornecedor.
- É uma ferramenta de homologação local, não um sistema de assiduidade já homologado.

A página é incluída no instalador Windows. Esta documentação não comprova que a compilação, a integração ou a release tenham sido executadas nesta versão.
