# Auditoria e plano — Manutenção remota CIADI para Windows
Data: 2026-10-26
Base auditada: branch `main`, commit `fcc1f5b8312883ef5a986ecbbf908b39fa64b530`
Âmbito: leitura do código e workflows do repositório; sem alterações ao Supabase, dados ou computadores.

## Resultado da auditoria estática

### O que já existe
- Aplicação Windows baseada em Electron, com `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`.
- `electron-updater` está declarado nas dependências.
- Em modo empacotado, a aplicação verifica atualizações, pede autorização antes de descarregar e pede confirmação antes de reiniciar para instalar.
- O `package.json` aponta o provider de publicação para GitHub Releases no repositório `ivanioalberto83-cmyk/CIADI-`.
- O workflow `.github/workflows/ciadi-windows-setup.yml` compila o instalador em Windows; builds normais produzem artefacto temporário e tags `ciadi-vMAJOR.MINOR.PATCH` publicam uma release.
- O NSIS está configurado para não apagar os dados da aplicação ao desinstalar.

### Lacunas / riscos a resolver
1. Não foi encontrado no código analisado um canal de suporte remoto assistido nem uma função de diagnóstico exportável.
2. O atualizador não equivale a acesso remoto ao computador: apenas procura, descarrega e aplica releases.
3. O evento `error` do atualizador escreve a mensagem na consola, mas não apresenta um relatório de diagnóstico amigável ao operador.
4. A publicação automática ainda depende de uma release/tag válida e de validar o fluxo de atualização numa instalação Windows real.
5. Não foi confirmada a existência de assinatura de código; sem certificado válido, o Windows pode mostrar avisos de editor desconhecido.
6. Não foi executado neste trabalho um teste real de instalação, atualização, falha e rollback.

## Plano de implementação por fases

### Fase 1 — diagnóstico local seguro
- Adicionar uma opção explícita «Ajuda > Exportar diagnóstico».
- Exportar apenas versão da aplicação, versão do Electron/Node, versão do Windows, arquitetura, data/hora, estado da rede/endpoint público do serviço e estado do atualizador.
- Não incluir tokens, palavras-passe, chaves Supabase, conteúdo de consultas, nomes de pacientes, documentos clínicos nem conteúdo de formulários.
- Guardar o ficheiro localmente por escolha do operador; nunca enviar automaticamente.

### Fase 2 — canal de atualização controlado
- Validar tags e artefactos de release, hash SHA-256 e metadados `latest.yml`.
- Manter aprovação explícita do utilizador antes de descarregar/instalar.
- Documentar versão anterior e procedimento de recuperação; não fazer migrações destrutivas da base de dados durante a atualização.
- Testar numa máquina de homologação, incluindo interrupção de rede, atualização cancelada e arranque após atualização.

### Fase 3 — suporte remoto assistido (opcional)
- Não implementar controlo remoto oculto nem serviço persistente de acesso remoto.
- Se for necessário controlo do ecrã, usar ferramenta de suporte aprovada, sessão iniciada pelo utilizador, código temporário, indicador visível e possibilidade de terminar a sessão.
- Registar início/fim e operador sem recolher dados clínicos desnecessários.

## Critérios de aceitação
- Diagnóstico exportado não contém segredos nem dados de pacientes.
- Atualização só é aplicada após confirmação e verificação da origem.
- Instalação, dados locais e configuração sobrevivem à atualização.
- A versão anterior pode ser reinstalada por procedimento documentado.
- Build Windows verde e teste manual de homologação registado antes de publicar em produção.

## Estado
Auditoria estática concluída; este documento é preparatório. Não foram feitas alterações ao código de produção, à base de dados Supabase ou a computadores dos polos. As funcionalidades acima ainda não são declaradas implementadas ou testadas.
