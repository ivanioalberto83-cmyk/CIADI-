# CIADI — Suporte Informática: oito motores documentais

## Estado desta entrega

Esta fase cria o catálogo funcional central e a sua apresentação no módulo Suporte Informática. O catálogo contém 116 tipos, distribuídos por oito motores. Não significa que os 116 formulários, fluxos de aprovação, integrações, PDFs, QR codes ou relatórios dinâmicos estejam concluídos.

## Motores e contagens

| Motor | Tipos |
|---|---:|
| Compras e Aprovisionamento | 16 |
| Armazém e Stock | 15 |
| Quebras, Avarias e Abates | 11 |
| Equipamentos e Património | 13 |
| Assistência Técnica e Operações | 14 |
| Sistemas, Segurança e Continuidade | 10 |
| Gestão Administrativa do Suporte | 16 |
| Relatórios, Gráficos e Análises | 21 |
| **Total** | **116** |

## Estado dos modelos

- 10 tipos estão associados aos modelos-base de rascunho existentes na fase documental anterior.
- Os restantes 106 estão catalogados, mas ainda precisam dos seus formulários próprios, validações, fluxos e integração de dados.
- Os relatórios e dashboards são definições de saída analítica; não devem gerar valores fictícios nem apresentar gráficos como dados reais sem consulta validada.

## Fontes de dados identificadas na auditoria

O esquema `ciadi_ti` já contém as tabelas de fornecedores, artigos, armazéns, pedidos de compra, linhas de pedidos, movimentos de stock, activos, contagens e linhas de contagem, bem como eventos de auditoria.

O bucket `documentos` existe e está configurado como privado. Foram encontradas políticas de Storage para esse bucket. A sua presença não prova, por si só, que todos os fluxos do motor documental tenham acesso correcto ou que o arquivo esteja pronto para utilização.

Também existem no esquema `public` tabelas documentais institucionais e de modelos, incluindo `ciadi_documentos_institucionais`, `ciadi_modelos_documentos`, `ciadi_campos_modelos_documentos` e `ciadi_documentos_validacao`. A integração futura deve avaliar a reutilização destas estruturas antes de propor tabelas novas.

## Regras de arquitectura

1. O catálogo é código de referência; não insere modelos nem documentos na base de dados.
2. A emissão e numeração oficial devem ser atómicas e executadas no servidor.
3. Documentos emitidos devem preservar snapshot, versão, autoria e histórico.
4. QR codes devem apontar para verificação HTTPS e não expor dados pessoais ou conteúdo confidencial.
5. PDFs e anexos devem ficar em Storage privado, com hash e registo de arquivo.
6. Movimentos de stock devem continuar a usar as operações controladas existentes; relatórios devem reflectir movimentos confirmados.
7. Os relatórios analíticos devem identificar fonte, período, filtros, data de geração e limitações dos dados.
8. Nenhuma alteração de esquema, dados, Storage, RLS, permissões ou produção faz parte desta fase.

## Próximas etapas técnicas

1. Criar formulários e validações específicas por tipo documental, começando por compras, stock e quebras.
2. Ligar as guias de entrada, saída e transferência aos movimentos reais de stock, sem duplicar lançamentos.
3. Integrar os modelos e documentos existentes do esquema `public` após avaliação de compatibilidade.
4. Implementar o repositório documental e operações de emissão/arquivo no ambiente de desenvolvimento.
5. Implementar os relatórios e gráficos com dados reais e testes de consistência.
6. Só depois de os motores funcionais estarem estabilizados, preparar a matriz de permissões e a respectiva revisão de segurança.

