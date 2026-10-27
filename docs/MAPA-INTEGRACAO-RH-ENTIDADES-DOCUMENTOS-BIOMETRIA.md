# Mapa de integração — RH, entidades, documentos, compras e biometria

**Estado:** desenvolvimento e homologação; sem alterações no Supabase remoto.  
**Ramo:** `feature/ciadi-compras-contabilidade-integrada`

## Resultado da auditoria somente de leitura

- O catálogo público contém 129 tabelas; a consulta encontrou RLS ativado nas 129. Isto não substitui testes por perfil.
- RH já possui tabelas `ciadi_funcionarios`, `ciadi_funcionario_assiduidade`, `ciadi_funcionario_contratos`, `ciadi_funcionario_ferias_licencas`, `ciadi_funcionario_documentos`, `ciadi_funcionario_confidencial`, `ciadi_funcionario_historico`, `ciadi_funcionario_avaliacoes`, `ciadi_funcionario_beneficios`, `ciadi_funcionario_competencias` e `ciadi_funcionario_formacoes`.
- Os registos de assiduidade têm funcionário, data, entrada/saída, intervalos, horas trabalhadas, estado e origem. A política observada exige `is_staff()`.
- Dados confidenciais de RH têm uma política mais restrita: `is_staff()` e perfil `admin` ou `gestor`. Não ampliar estes acessos sem revisão e testes.
- Entidades financeiras já usam `finance_clientes` e `finance_empresas`; despesas usam `finance_despesas` e ainda guardam `fornecedor_nome`/NIF como texto.
- Documentos institucionais estão em `ciadi_documentos_institucionais` e documentos de RH em `ciadi_funcionario_documentos`. O bucket `documentos` do Storage é privado.
- Não foi encontrada tabela de compras/ordens nem tabela biométrica dedicada no Supabase remoto. A tabela `ciadi_funcionario_assiduidade` é o destino candidato para eventos de assiduidade após validação do modelo e dos campos; não deve ser escrita automaticamente antes da homologação.

## Integração implementada neste ramo

- Adicionada a entrada **Assiduidade Biométrica** ao menu do Dashboard.
- A entrada abre a ferramenta de homologação do ZKTeco K20 Pro pela ponte IPC restrita do Electron; o contexto isolado continua ativo e Node.js não é exposto ao HTML.
- O Dashboard e `index.html` foram sincronizados.
- O módulo biométrico atual apenas lê ficheiros CSV localmente. Não se afirma ligação TCP/IP, leitura direta do terminal, sincronização realtime ou gravação no Supabase.

## Compras e aprovisionamento

A migração `supabase/migrations/20261027120000_ciadi_compras_contabilidade.sql` é apenas proposta versionada. Cria ordens e linhas, liga fornecedores a despesas e define funções de aprovação/contabilização. Não foi executada remotamente. O cadastro de fornecedores usa inicialmente `finance_clientes`; confirmar a semântica do campo `tipo` e as permissões antes de associar registos históricos. Não fazer correspondências automáticas por nome/NIF.

## Testes necessários antes de produção

1. Rever cada política RLS com contas de teste `admin`, `gestor`, `profissional` e utilizador sem privilégios.
2. Confirmar backup integral e executar um restauro de ensaio.
3. Aplicar a migração apenas numa cópia de homologação e testar rollback, duplicados contabilísticos, período fechado, regra `DESPESA`, diário `COM`, impostos e idempotência.
4. Confirmar modelo exato, firmware, protocolo/SDK oficial do terminal e autorização de rede.
5. Testar CSVs com matrícula desconhecida, eventos duplicados, datas inválidas e fuso horário; mapear matrícula para funcionário sem armazenar imagens/modelos de impressão digital.
6. Validar retenção, acesso, auditoria e minimização dos dados de assiduidade.
7. Compilar o Setup Windows e executar teste funcional real antes de disponibilizar instalador.

**Bloqueios:** não executar DDL/DML, não mudar RLS/chaves, não importar registos de biometria, não publicar release e não declarar conformidade AGT/APD até aprovação e evidência de testes.
