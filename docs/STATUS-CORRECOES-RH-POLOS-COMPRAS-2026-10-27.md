# CIADI — Estado das correções RH, compras e polos
**Data:** 2026-10-27  
**Branch:** `fix/ciadi-rh-polos-compras-20261027`  
**Pull request:** #15 (rascunho)  
**Produção:** sem alterações de DDL/DML nesta execução.

## Alterações preparadas no código
- O RH tem ações para gerar uma declaração de serviço e uma declaração de remuneração a partir do cadastro e do contrato registado. A declaração de remuneração identifica-se expressamente como valor de referência contratual e não como recibo de vencimento.
- Foi acrescentada a área Folha Salarial. Quando a estrutura ainda não existe, a interface informa que o módulo está pendente e não simula folhas.
- O fluxo de compras deteta se os campos de aprovação/contabilização estão presentes. Se faltarem, continua a permitir consultar e registar despesas apenas com campos existentes, e bloqueia os controlos que exigem migração/RPC.
- O Setup Windows solicita o polo predefinido da estação no primeiro arranque e permite alterá-lo no menu. O texto deixa explícito que a seleção local não concede permissões.
- Foi acrescentada uma página de administração para atribuir/revogar acessos aos polos, reservada ao perfil `admin`; a migração proposta também restringe a gestão dessas atribuições a administradores ativos.
- O workflow Windows deixou de compilar artefactos automaticamente nesta branch; a compilação manual exige uma opção explícita, desligada por omissão.
- O HTML de entrada e a fonte canónica foram sincronizados.

## Folha salarial proposta para homologação
A migração `20261027193000_ciadi_rh_folha_salarial.sql` cria folhas, linhas salariais, totais com restrições, aprovação, registo de pagamento e numeração idempotente de recibos. As políticas exigem utilizador financeiro autorizado e associação ativa ao centro de custo/polo.

**Não aplicar esta migração isoladamente.** Depende da preparação das associações por polo e de uma revisão conjunta com as migrações de compras/contabilidade. O conjunto ainda não foi aplicado ao Supabase de produção.

O sistema soma valores introduzidos e validados. Não calcula IRT/INSS com taxas presumidas. A automatização fiscal só poderá ser ativada depois de confirmar regras vigentes com a Contabilidade e validar testes de cálculo.

## Pendências antes de gerar qualquer Setup distribuível
1. Confirmar que a validação CI executa todos os testes estáticos, incluindo sintaxe do Dashboard, main/preload Windows, RH, folha salarial, gestão de polos, compras e contabilidade. A execução atual da validação CI terminou com sucesso.
2. Homologar o fluxo de cadastro RH e emissão dos documentos com dados fictícios.
3. Aplicar as migrações apenas após backup recuperável, revisão de RLS e autorização explícita; confirmar as dependências e o plano de reversão.
4. Criar/validar as atribuições de utilizadores a polos e testar dois perfis em dois computadores, incluindo chamadas diretas ao Supabase.
5. Validar o cálculo e a aprovação de folha, emissão do recibo e controlo de acesso aos documentos.
6. Só então executar o workflow de Setup de teste com a opção manual habilitada. Não criar uma release de produção sem homologação.

## Estado de aceitação
- **Código de desenvolvimento:** em correção/homologação.
- **Migrações:** propostas no repositório, não aplicadas à produção.
- **Setup de distribuição:** bloqueado até os testes e a autorização de homologação.
