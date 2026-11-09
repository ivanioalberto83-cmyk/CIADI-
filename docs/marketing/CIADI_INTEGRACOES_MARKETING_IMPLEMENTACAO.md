# CIADI — Implementação segura de custos e integrações de marketing

**Estado:** proposta técnica para revisão — não aplicada à base de dados  
**Data:** 28-10-2026  
**Responsável operacional:** Suporte Informático  
**Aprovação necessária:** Direcção CIADI para orçamento, contas sociais e permissões de integração

## Objectivo

Ligar o calendário de marketing às campanhas executadas e a métricas verificáveis por canal, permitindo acompanhar planeado vs. executado, custos aprovados vs. realizados e resultados atribuíveis. Nenhuma métrica social será simulada.

## Modelo de dados proposto

1. `ciadi_marketing_custos`: campanha, fornecedor, plataforma, categoria de custo, valor planeado, valor realizado, moeda, referência de factura/comprovativo, estado de aprovação, aprovador, data de aprovação e período.
2. `ciadi_marketing_integracoes`: plataforma, identificador da conta institucional, estado da ligação, escopos concedidos, última sincronização, estado/erro da última sincronização e metadados não secretos. Nunca guardar access tokens, refresh tokens, client secrets ou service-role keys nesta tabela.
3. `ciadi_marketing_publicacoes`: campanha, canal, identificador externo, URL, conteúdo aprovado/referência, estado planeado/publicado/falhado, datas planeada e real, responsável e ligação ao registo de aprovação.
4. `ciadi_marketing_metricas`: integração, publicação/campanha, janela temporal, métrica, valor, unidade, moeda quando aplicável, origem, data recolhida, identificador externo do registo e chave de idempotência.
5. `ciadi_marketing_sync_logs`: integração, início/fim, estado, número de registos processados, cursor de paginação não secreto e código de erro sanitizado.

Os nomes e colunas finais devem ser alinhados com as tabelas reais antes de gerar uma migração executável. Não criar duplicados de tabelas já existentes.

## Regras de acesso

- RLS activa em todas as novas tabelas expostas.
- Suporte Informático: leitura operacional e diagnóstico; escrita limitada às funções autorizadas. Não aprova o próprio orçamento nem ganha automaticamente privilégios de administrador global.
- Direcção: aprova orçamento, campanhas pagas e permissões de conta institucional.
- Outros perfis: sem acesso por defeito; acesso mínimo concedido por função e necessidade.
- Auditoria de criação, edição, aprovação, publicação, sincronização e cancelamento.
- Nunca usar dados de pacientes, diagnósticos ou contactos clínicos para criar públicos de marketing por defeito.

## Fluxo de integração

1. Direcção autoriza a conta institucional e os escopos mínimos.
2. Suporte Informático configura credenciais na gestão de segredos do backend, nunca no HTML, repositório ou tabela pública.
3. Edge Function/serviço server-side executa OAuth e renova tokens quando necessário.
4. O backend consulta APIs oficiais, respeita limites de taxa e valida assinatura de webhooks quando suportados.
5. Eventos são deduplicados, associados à campanha/publicação e registados com timestamp da fonte.
6. O painel lê apenas métricas autorizadas e actualiza via Supabase Realtime; quando a plataforma não suporta eventos em tempo real, usa sincronização agendada e mostra a data da última recolha.
7. Relatório apresenta fonte, período, estado de sincronização, valores em falta e limitações de atribuição.

## Indicadores

- Execução: publicações planeadas, publicadas, falhadas e atrasadas.
- Distribuição: alcance, impressões, visualizações e interacções, quando fornecidos pela API autorizada.
- Conversão: cliques, contactos e resultados apenas quando houver mecanismo de atribuição validado.
- Financeiro: orçamento aprovado, custo realizado, diferença orçamental e custo por resultado apenas quando numerador e denominador tiverem fonte fiável.
- Saúde da integração: última sincronização, atraso, falhas, rate limit e token expirado.

## Plano de homologação

- [ ] Confirmar o esquema actual e reutilizar tabelas existentes.
- [ ] Desenhar migração SQL e políticas RLS para revisão; não aplicar em produção nesta fase.
- [ ] Implementar e testar endpoints server-side com segredos de teste.
- [ ] Testar utilizador sem permissões, token expirado, webhook inválido, evento duplicado, API indisponível, limite de taxa e sincronização parcial.
- [ ] Confirmar que valores ausentes são apresentados como indisponíveis e não como zero.
- [ ] Validar relatório com uma campanha fictícia e depois com conta institucional autorizada.
- [ ] Rever segurança e advisors antes de qualquer aplicação da migração.
- [ ] Obter aprovação explícita para deploy e alteração de produção.

## Limitações actuais conhecidas

O painel já consulta campanhas, envios e eventos de email existentes e tenta subscrever Supabase Realtime. A configuração real de Realtime, webhooks do fornecedor, custos e APIs sociais ainda precisa de implementação e testes. Nenhuma conta externa foi ligada por este trabalho.
