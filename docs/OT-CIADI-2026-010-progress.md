# OT-CIADI-2026-010 — Registo de execução

Data da última atualização: 2026-10-28
Branch: `feat/ciadi-payroll-engine-20261028`
Ambiente: desenvolvimento/homologação. Nenhuma alteração de esquema ou dados foi executada na base de dados de produção.

## Fase 1 — Motor salarial e RH
- [x] Motor JavaScript de cálculo com IRT Grupo A 2026, INSS padrão parametrizado, subsídios com incidências configuráveis, horas extraordinárias, faltas e descontos.
- [x] Testes unitários do motor presentes em `ciadi-windows/test/payroll-engine.test.cjs`.
- [x] Recibo de vencimento imprimível/PDF já implementado no Dashboard como fluxo dependente da folha aprovada.
- [x] Inclusão dos motores JavaScript na lista de ficheiros do empacotamento Windows.
- [ ] Bloqueado para homologação integrada: a inspeção read-only ao esquema atual não encontrou `ciadi_folhas_salariais` nem `ciadi_folha_salarial_linhas` na base de dados consultada. Não criar nem aplicar migração sem validação do esquema, cópia de segurança e autorização explícita.
- [ ] Confirmar funções RPC de criação/aprovação/pagamento/recibo e campos contra uma migração aprovada.
- [ ] Validar cálculos, incidências dos subsídios e política de faltas com a Contabilidade.
- [ ] Mapas mensais por polo/colaborador e mapas de IRT/INSS ainda pendentes.

## Fase 2 — Motor documental de aprovisionamento
- [x] Base isolada do motor documental em `ciadi-windows/procurement-document-engine.js` e cópia raiz.
- [x] Testes unitários do motor documental presentes.
- [ ] Integração na interface de aprovisionamento pendente; manter esta fase subordinada à conclusão e validação da fase salarial.
- [ ] Confirmar fluxo real de ordem de compra, linhas, receção e permissões; não alterar o esquema de produção.

## Fase 3 — Calendário Inteligente
- [x] Adicionado módulo administrativo `calendario` ao Dashboard, incluindo consulta de `ciadi_efemerides`, filtros, criação e ativação/desativação de eventos.
- [x] Consulta de aniversários limitada a colaboradores com visibilidade `equipa`; não consulta a data completa de nascimento.
- [x] Formulário alinhado com os valores de tipo e público existentes nas constraints da base de dados.
- [x] `index.html` e `CIADI_DASHBOARD_FINANCEIRO.html` sincronizados e verificados idênticos na branch.
- [ ] Testar CRUD com conta admin/gestor em homologação e confirmar permissões RLS na interface.
- [ ] Validar e completar o calendário anual de feriados/efemérides com fontes oficiais.\n- [x] Auditoria read-only: 37 efemérides ativas já existem na tabela.\n- [ ] Auditoria read-only: existem 0 registos em `ciadi_aniversarios`, 0 lembretes em `ciadi_aniversario_lembretes` e 0 notificações em `notificacoes`; é necessário cadastrar aniversários de colaboradores com autorização antes de testar esse fluxo.

## Fase 4 — Emails e notificações
- [x] Confirmada a existência de tabelas `notificacoes`, `ciadi_aniversario_lembretes`, `ciadi_aniversario_preferencias` e regras de lembrete.
- [x] Confirmada a existência de uma Edge Function de envio Resend para campanhas de marketing; não reutilizada para avisos transacionais sem revisão.
- [ ] Não existe ainda um fluxo agendado de notificações de calendário validado nesta branch.
- [ ] Confirmar secrets `RESEND_API_KEY` e `RESEND_FROM` sem expor os seus valores; implementar e testar envio transacional idempotente.
- [ ] Não enviar emails reais nem ativar agendamento automático antes dos testes e da autorização.

## Fases 5–7
- [ ] Sincronização administrativa/financeira: auditoria e testes pendentes.
- [ ] Segurança e recuperação: revisão read-only iniciada; restauro ainda carece de teste documentado.
- [ ] Setup.exe: não gerado nesta execução; exige validação das dependências e aprovação de homologação.

## Verificação observada
- Workflow GitHub `Validate CIADI dashboard integration` executado para a branch, run 135, conclusão `success`.
- Esse resultado não comprova, por si só, um build Windows nem o funcionamento integrado contra a base de dados.
- Nenhuma alteração foi aplicada à base de dados de produção e nenhuma versão foi publicada.
