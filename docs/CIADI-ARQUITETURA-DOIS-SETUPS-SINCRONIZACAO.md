# CIADI — Arquitetura de dois instaladores Windows e sincronização ponta a ponta

**Data:** 2026-10-27  
**Branch de trabalho:** `feature/ciadi-compras-contabilidade-integrada`  
**Estado:** especificação de desenvolvimento; não publicada; não aplicada à produção.

## Decisão de arquitetura

Criar dois instaladores Windows distintos a partir de uma base de código comum, com capacidades separadas pela experiência e pelas permissões:

1. **CIADI ADM** — administração central, gestão de acessos, configuração, auditoria, exportações e relatórios consolidados.
2. **CIADI Produção** — operação diária nos polos Talatona e Jardim de Rosas, com o centro de custo autorizado selecionado após login, registos operacionais, movimentos comerciais/financeiros permitidos e sincronização.

Ambos ligam ao mesmo projeto Supabase e aos mesmos registos centrais. A separação é imposta no backend por Auth/RLS e validações de relações; ocultar menus ou distribuir instaladores diferentes não constitui controlo de segurança.

## Polos

- `CC-001` — CIADI Polo Talatona.
- `CC-002` — CIADI Polo Jardim de Rosas.

A lista de polos mostrada a um operador deve vir das atribuições autorizadas no backend. Não confiar em valores de centro enviados pelo cliente sem validação.

## CIADI ADM — funções pretendidas

- Gestão de perfis, funções, permissões e atribuições perfil-centro.
- Consulta individual de cada polo e relatórios consolidados autorizados.
- Exportações CSV/XLSX/PDF e relatórios comerciais, financeiros e operacionais.
- Auditoria de operações, aprovações, reconciliações e análise de exceções de sincronização.
- Gestão central de catálogos, serviços, fornecedores e parâmetros, com separação entre dados globais e configuração específica do polo.
- Monitorização do estado de sincronização e dos dispositivos.
- Gestão de backups/exportações administrativas conforme as permissões e a política de retenção.
- Operações irreversíveis ou privilegiadas exigem confirmação, registo de auditoria e permissões específicas.

## CIADI Produção — funções pretendidas

- Login individual e seleção apenas dos centros atribuídos.
- Registos de produção clínica/operacional conforme as permissões do utilizador.
- Cadastro/consulta comercial nos limites autorizados.
- Faturação, recebimentos, despesas, compras, caixa e fecho de turno quando autorizados.
- Registo de movimentos com centro, utilizador, dispositivo, timestamp e identificador único.
- Indicador visível de sincronização: pendente, em curso, sincronizado ou erro.
- Fila local offline limitada a operações que possam ser guardadas com segurança; reenvio automático sem duplicar operações.
- Não permitir que uma alteração de polo no ecrã mude o centro de um movimento já criado.

## Modelo de dados e sincronização

Cada operação sincronizável deve usar, quando aplicável:
- `id` UUID gerado uma única vez no dispositivo;
- `centro_custo_id` validado pelo backend;
- `created_by` / utilizador autenticado;
- `device_id` registado;
- `created_at` e `updated_at`;
- `sync_status` e metadados de erro na fila local, sem substituir o estado contabilístico/fiscal oficial;
- chave de idempotência para impedir duplicação em novas tentativas;
- registo de auditoria para alterações relevantes.

### Fluxo esperado

1. Utilizador autentica-se no Supabase.
2. Backend devolve atribuições e permissões; a aplicação só mostra os centros autorizados.
3. O operador cria uma operação associada ao centro ativo e com ID estável.
4. Online: o servidor valida utilizador, centro, relações pai/filho e regras do módulo antes de gravar.
5. Offline: a aplicação guarda uma fila local protegida e identifica claramente que o registo ainda não foi confirmado pelo servidor.
6. Ao recuperar ligação, a fila sincroniza com idempotência e validações; conflitos ficam em revisão, sem sobrescrever silenciosamente dados.
7. A administração acompanha sucesso, falhas, duplicados bloqueados e operações pendentes.
8. Os relatórios oficiais usam dados confirmados no servidor; pendentes offline são apresentados separadamente.

Não usar uma sincronização genérica que permita a um cliente offline contornar RLS ou inserir movimentos em qualquer centro. A fila offline não deve conter segredos de serviço nem credenciais privilegiadas.

## Fronteira de segurança

- Não incluir chave `service_role` no instalador, no JavaScript ou em ficheiros de configuração distribuídos.
- O cliente usa autenticação individual e a chave pública/anon do projeto; RLS e validações do servidor são obrigatórias.
- RLS deve cobrir SELECT, INSERT, UPDATE e DELETE nas tabelas relevantes e relações indiretas.
- A Direção tem permissões explícitas de acesso consolidado; não assumir que qualquer conta `admin` pode ignorar as políticas sem um desenho validado.
- Exportações devem respeitar permissões e ser auditadas; dados clínicos devem ser minimizados nos relatórios comerciais.
- Backups/exportações não substituem uma cópia de segurança recuperável nem um teste de restauro.

## Catálogos comuns vs dados por polo

**Potencialmente comuns:** clientes, fornecedores e catálogo base de serviços, quando representam a mesma entidade. A partilha do cadastro não concede acesso às operações de todos os polos.

**Por polo ou herdados de uma relação validada:** produção, stock/consumo, vendas/documentos, despesas, pagamentos, caixas, turnos, movimentos, relatórios operacionais e lançamentos analíticos.

**Configuração fiscal:** séries, numeração, emitente, empresa e SAF-T não devem ser duplicados ou separados por polo sem confirmar o modelo fiscal aplicável e a integridade da numeração.

Transferências de stock ou valores entre polos devem ser operações explícitas, com origem, destino, motivo, responsável e trilho de auditoria.

## Fases obrigatórias antes de distribuir os instaladores

### Fase 1 — inventário e desenho
- Mapear todas as tabelas, funções SQL, policies RLS, RPCs e chamadas em `index.html`.
- Confirmar os módulos reais de produtos, inventário e stock; a auditoria inicial não encontrou nomes evidentes, pelo que a pesquisa deve abranger todo o schema e código.
- Definir matriz de permissões e classificação de dados global vs por centro.
- Não reclassificar dados históricos sem confirmação.

### Fase 2 — backend seguro
- Preparar migrações aditivas e reversíveis com colunas/FKs/constraints necessárias.
- Rever políticas permissivas atuais e funções `SECURITY DEFINER`.
- Validar consistência entre documentos/linhas/pagamentos, despesas/pagamentos, caixa/turnos/movimentos e lançamentos/linhas.
- Aplicar apenas após backup, aprovação e testes em ambiente não produtivo.

### Fase 3 — aplicações
- Criar os dois modos de interface a partir da base de código comum.
- Separar menus e capacidades; o backend permanece a autoridade final.
- Implementar atribuição de centro, estado de sincronização, fila offline, idempotência, resolução de conflitos e auditoria.
- Manter a aplicação instalada atual sem substituição até homologação.

### Fase 4 — testes de aceitação
- Conta Talatona não consegue ler, criar, alterar ou eliminar dados de Jardim de Rosas, nem por consultas diretas/RPC.
- Conta Jardim de Rosas não consegue ler, criar, alterar ou eliminar dados de Talatona.
- Direção vê os dois polos apenas com permissões atribuídas.
- Repetir envio offline não duplica faturas, pagamentos, movimentos ou compras.
- Testar perda de ligação, sessão expirada, reautenticação, conflitos, relógios divergentes, falhas parciais e reinício do computador.
- Testar exportações, totais, saldos e reconciliações contra registos no servidor.
- Verificar backups e realizar teste de restauro antes da distribuição.

### Fase 5 — geração dos instaladores
- Gerar dois artefactos identificados, por exemplo `CIADI-ADM-<versão>.exe` e `CIADI-Producao-<versão>.exe`.
- Assinalar hash, versão, commit de origem e data de build.
- Instalar em máquinas de teste distintas e validar atualização/reversão.
- Não declarar o Setup concluído sem artefactos reais, logs de build e testes aprovados.

## Estado atual

- Esta especificação foi criada na branch de desenvolvimento.
- Não altera `index.html`, o Supabase, dados, policies nem a aplicação instalada.
- A migração de centros de acesso continua sem aplicação em produção.
- Os dois instaladores ainda não foram construídos.
