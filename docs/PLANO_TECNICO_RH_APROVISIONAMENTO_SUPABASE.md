# CIADI — Plano técnico de RH e Aprovisionamento (Fase Supabase)

## Estado e limites

- Trabalho preparado numa branch de desenvolvimento; não altera a base de dados de produção.
- Não inserir dados pessoais reais; testes devem usar dados fictícios.
- Não aplicar DDL em produção até existir backup verificado, revisão das políticas RLS e aprovação explícita.
- Preservar as tabelas, relações e fluxos existentes. Alterações novas devem ser aditivas e reversíveis.

## Diagnóstico confirmado em leitura

- O projeto Supabase contém tabelas de RH já criadas: `ciadi_funcionarios`, `ciadi_funcionario_contratos`, `ciadi_funcionario_documentos`, `ciadi_funcionario_assiduidade`, `ciadi_funcionario_ferias_licencas`, `ciadi_funcionario_avaliacoes`, `ciadi_funcionario_beneficios`, `ciadi_funcionario_competencias`, `ciadi_funcionario_confidencial`, `ciadi_funcionario_formacoes` e `ciadi_funcionario_historico`.
- O catálogo de materiais e o fluxo de solicitações já existem em `ciadi_materiais_apoio`, `ciadi_solicitacoes_materiais` e `ciadi_solicitacoes_materiais_historico`.
- A política `is_staff()` permite acesso a utilizadores ativos admin/gestor e a profissionais ativos com `eh_at = true`. Em várias tabelas de RH essa política está aplicada a todas as operações. Isto deve ser revisto para evitar que permissões clínicas de AT impliquem acesso a salários, NIF, IBAN, contratos ou documentos de RH.
- As tabelas de RH e de materiais consultadas tinham RLS ativo. RLS ativo, por si só, não garante que as permissões estejam adequadas.
- Não foi confirmado um módulo completo de compras/fornecedores/receções/stock; a implementação deve complementar, não substituir, o catálogo e as solicitações atuais.

## Módulo RH — sequência de trabalho

1. Mapear colunas, chaves estrangeiras, triggers, índices, storage paths e todas as políticas das tabelas existentes.
2. Definir matriz de acesso por função: admin/gestor de RH; profissional/colaborador (apenas dados próprios explicitamente autorizados); acesso separado a dados confidenciais; sem acesso para pacientes/responsáveis.
3. Não confiar em `user_metadata` para autorização. Validar identidade e função usando a tabela de perfis e políticas RLS.
4. Rever e corrigir políticas uma tabela de cada vez; garantir `USING` e `WITH CHECK` em UPDATE e políticas SELECT necessárias.
5. Implementar testes RLS com utilizadores fictícios: admin, gestor, profissional AT, profissional não-AT, paciente e responsável.
6. Manter documentos pessoais em Storage privado, com caminhos autorizados e URLs assinadas temporárias; nunca expor NIF, IBAN ou salário em listagens gerais.
7. Só depois integrar formulários, filtros, exportações e impressão no Dashboard Windows.

## Módulo Aprovisionamento — modelo aditivo proposto

Criar, após inspeção de nomes e dependências já existentes, tabelas novas com UUID, timestamps, autor e estado controlado:

- `ciadi_fornecedores`: identificação, contactos, NIF opcional, endereço, condições comerciais e estado.
- `ciadi_categorias_artigos`: categorias de consumíveis, materiais terapêuticos, escritório e equipamentos.
- `ciadi_armazens`: localizações de armazenamento e estado.
- `ciadi_artigos_stock`: SKU/código interno, descrição, unidade, categoria, stock mínimo, controlo por lote/validade quando aplicável.
- `ciadi_pedidos_compra`: fornecedor, número interno, datas, solicitante, centro de custo, moeda AOA por omissão e estados de aprovação.
- `ciadi_pedidos_compra_itens`: artigo/descrição, quantidade, preço unitário, IVA configurável e totais calculados de forma consistente.
- `ciadi_rececoes_compra` e `ciadi_rececoes_compra_itens`: receção parcial/total, quantidades recebidas, lote e validade.
- `ciadi_stock_movimentos`: entradas, saídas, ajustes e transferências; cada movimento deve referenciar documento de origem e autor.
- `ciadi_aprovisionamento_historico`: registo append-only de transições de estado, aprovação e rejeição.

### Regras de negócio

- Não permitir stock negativo por omissão; ajustes excecionais exigem permissão e justificação.
- Não alterar o stock ao criar um pedido; apenas após receção confirmada ou movimento autorizado.
- Impedir aprovação pelo próprio solicitante quando a matriz de segregação de funções assim o exigir.
- Guardar histórico de estados e movimentos; não apagar movimentos contabilísticos/logísticos, corrigir com movimento inverso.
- Evitar totais enviados pelo cliente como fonte de verdade; calcular/validar valores no servidor.
- Moeda de trabalho AOA; impostos e tratamento fiscal devem ser configuráveis e validados com a contabilidade, sem afirmar conformidade AGT automaticamente.
- Usar políticas RLS específicas para funções de gestão autorizadas; não reutilizar automaticamente `is_staff()` nas tabelas de compras e stock.
- Criar índices em FKs, código SKU, número do pedido, estado, data e fornecedor após validar os padrões de consulta.

## Entrega técnica e validação

1. Obter/confirmar backup SQL e Storage restaurável, incluindo prova de que o backup não está vazio.
2. Criar migrações com o Supabase CLI no repositório (usar `supabase migration new <nome>`, conforme a versão instalada) e manter SQL versionado; não aplicar migrações diretamente à produção nesta fase.
3. Validar migrações numa base de homologação sem dados reais; testar constraints, triggers, RLS, índices e reversão.
4. Rever os avisos de segurança do Supabase, sobretudo funções `SECURITY DEFINER`, vistas que possam ignorar RLS e permissões de execução.
5. Abrir PR para revisão; só depois de aprovação, backup verificado e plano de rollback, considerar homologação e posterior produção.
6. No Dashboard Windows, implementar ecrãs ligados ao schema aprovado: RH, fornecedores, artigos, pedidos, aprovações, receções, stock, pesquisa, histórico e relatórios; aplicar logotipo oficial CIADI nos documentos impressos.

## Critérios de aceitação

- Nenhum perfil não autorizado lê dados de RH confidenciais.
- Nenhum profissional AT ganha acesso a RH apenas por ter permissão clínica.
- Paciente/responsável não consegue consultar fornecedores, compras ou inventário.
- Stock e histórico são coerentes após receção, saída, ajuste e reversão.
- Todos os formulários têm validação, estados claros, pesquisa e exportação testada.
- Produção permanece sem alterações até aprovação expressa.
