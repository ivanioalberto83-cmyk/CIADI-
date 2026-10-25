# Plano de prontidão para conformidade com a APD — 25/10/2026

## Objetivo e limite
Preparar o tratamento de dados pessoais para avaliação face à Lei angolana n.º 22/11, de 17 de Junho, e às orientações oficiais da Agência de Protecção de Dados (APD). Este documento é uma matriz de trabalho técnico-organizacional; não é parecer jurídico, notificação submetida nem certificação de conformidade.

## Princípios de execução
- Trabalhar em branch isolada; sem alterações de produção nesta fase.
- Não usar dados reais de crianças/pacientes em testes; usar dados sintéticos.
- Não publicar dados clínicos, nomes, contactos, diagnósticos, códigos de validação ou tokens em logs, capturas ou relatórios.
- Aplicar acesso mínimo necessário, segregação de funções e isolamento por paciente/família/profissional.
- Não considerar o consentimento como fundamento automático para todos os tratamentos: identificar e documentar a base jurídica por finalidade e confirmar formalidades aplicáveis com a APD.

## Matriz de preparação

| Área | Evidência exigida | Estado inicial / ação |
|---|---|---|
| Responsável pelo tratamento | Identidade legal, endereço, contacto e responsabilidades internas | Recolher e validar com a direção |
| Inventário de tratamentos | Finalidade, titulares, categorias de dados, destinatários, sistemas e fluxos | Elaborar inventário por módulo |
| Dados sensíveis e de menores | Categorias de saúde/desenvolvimento, representante legal, fundamento e autorização aplicável | Prioridade máxima; validar requisitos específicos com a APD |
| Transparência | Avisos de privacidade claros no site, formulários, app e portal | Rever textos, linguagem, versões e momento de apresentação |
| Consentimentos e autorizações | Registo da versão, finalidade, data, representante e retirada quando aplicável | Separar consentimentos clínicos, comunicações, imagens e marketing |
| Direitos dos titulares | Processo para acesso, informação, rectificação, bloqueio/apagamento e oposição, com verificação de identidade | Definir canal, responsáveis, prazos legais e registo de pedidos |
| Minimização e retenção | Prazo e justificação por categoria; bloqueio e eliminação controlada | Definir tabela de retenção com direção clínica/jurídica |
| Acessos e RLS | Matriz de papéis, testes de acesso permitido e negado, segregação entre famílias e profissionais | Auditar tabelas, views, RPCs e Storage; corrigir apenas após homologação |
| Segurança operacional | MFA onde disponível, gestão de credenciais, rotação de segredos, cópias cifradas, restauro testado e logs sem dados excessivos | Produzir procedimento e evidências |
| Subcontratantes e transferências | Lista de fornecedores, localização/região, contrato, subcontratantes, suporte e transferências internacionais | Obter contratos e avaliar a região/transferência antes de concluir |
| Incidentes | Procedimento de deteção, contenção, avaliação, registo e notificação à APD conforme obrigações aplicáveis | Criar plano e simular um incidente |
| Formação e confidencialidade | Compromissos de confidencialidade, formação e registo de acessos por função | Formalizar com a direção |
| Formalidades APD | Determinação documentada de notificação, autorização ou outra formalidade aplicável; comprovativos e correspondência | Consultar o serviço oficial de legalização do tratamento |
| Evidência e auditoria | Registo de alterações, testes, aprovações, cópias de segurança e incidentes | Manter dossier de conformidade com acesso restrito |

## Achados técnicos já identificados para validação
1. Duas views SECURITY DEFINER foram sinalizadas pelo advisor. Verificar se cada consulta revela apenas os dados necessários e se respeita a autorização individual.
2. RPCs privilegiadas expostas a utilizadores anónimos relacionadas com triagem pública e validação documental requerem revisão de finalidade, campos devolvidos, códigos não enumeráveis, limites de entrada e controlo de abuso.
3. As funções SECURITY DEFINER disponíveis a utilizadores autenticados devem ser analisadas individualmente. Não revogar privilégios em lote sem compreender os consumidores e os efeitos operacionais.
4. A triagem pública pode recolher dados de saúde e dados de crianças. Antes de abrir ou ampliar o fluxo, confirmar aviso, fundamento, consentimentos/representação quando exigidos, minimização, acesso restrito e retenção.
5. O estado de proteção contra palavras-passe comprometidas está sinalizado como desativado; avaliar ativação e impacto em homologação.
6. A reconciliação do esquema com as migrações versionadas e a recuperação de um backup restaurável continuam como pré-requisitos para mudanças seguras.

## Plano de trabalho por fases
### Fase A — documental e inventário
- Nomear responsável pelo tratamento e pontos focais.
- Mapear formulários, tabelas, buckets, RPCs, Edge Functions, relatórios, exportações e destinatários.
- Documentar finalidade, fundamento, titulares, categorias, retenção e transferências para cada fluxo.
- Preparar avisos de privacidade e processos de exercício de direitos para revisão institucional.

### Fase B — avaliação técnica
- Recuperar o SQL original das migrações e comparar com o esquema atual.
- Testar acesso por papel, por paciente e por família, incluindo tentativas negativas.
- Testar enumeração de códigos, abuso de endpoints públicos, logs e exposição em PDFs/URLs.
- Verificar backups, encriptação, restauração e procedimento de incidentes.
- Corrigir em branch isolada e homologação; conservar evidências dos testes.

### Fase C — formalização
- Confirmar diretamente com a APD as formalidades aplicáveis ao tratamento, em especial dados sensíveis e de menores, comunicação a terceiros e transferências internacionais.
- Submeter notificações/pedidos exigidos e arquivar comprovativos/respostas.
- Aprovar políticas, contratos, retenção, incidentes e formação.
- Produzir relatório de lacunas fechado apenas quando cada requisito tiver evidência verificável.

## Critérios para declarar “pronto para avaliação”
- Inventário de tratamento completo e aprovado.
- Fundamento e formalidades definidos para cada finalidade.
- Avisos e processos de direitos testados.
- Acesso mínimo e isolamento validados com testes negativos.
- Backups restauráveis e resposta a incidentes testados.
- Contratos e transferências analisados.
- Evidência de notificação/autorização ou confirmação formal da APD, conforme aplicável.
- Aprovação institucional e revisão jurídica local.

## Referências oficiais para validação
- Lei n.º 22/11 — página de legislação da APD: https://apd.ao/ao/legislacao/
- Direitos do cidadão: https://apd.ao/ao/direitos-do-cidadao/
- Legalização do tratamento de dados: https://apd.ao/ao/catalogo/formularios-apd/legalizacao-do-tratamento-de-dados/
- Circular APD n.º 02/APD/2024 sobre incidentes informáticos: https://apd.ao/fotos/frontend_1/editor2/circular_002.pdf

## Limite desta fase
Não foram alteradas tabelas, políticas, permissões, dados, Edge Functions nem configurações de produção. A conformidade legal não pode ser declarada apenas a partir de uma auditoria técnica; depende da documentação, práticas reais, formalidades junto da APD e validação profissional aplicável.
