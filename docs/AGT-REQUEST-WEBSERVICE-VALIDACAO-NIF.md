# CIADI — Pedido de informação à AGT sobre consulta/validação de NIF por integração

**Estado:** minuta preparatória; não enviada.  
**Objectivo:** solicitar orientação oficial sobre a possibilidade de o CIADI consultar/validar NIF de clientes, entidades e fornecedores através de integração autorizada.

## Canal oficial de contacto

- Central de Apoio ao Contribuinte: **apoio.agt@minfin.gov.ao**
- Telefone: **+244 923 167 010**
- Correspondência AGT: **correspondencia.agt@minfin.gov.ao**
- Portal do Contribuinte: https://portaldocontribuinte.minfin.gov.ao/contactos

Confirmar com a AGT qual canal/departamento deve receber pedidos técnicos de integração. Não presumir que o endereço de apoio atribui credenciais de WebService.

## Minuta de e-mail

**Assunto:** Pedido de orientação técnica e requisitos para consulta autorizada de NIF — sistema CIADI

Exmos. Senhores da Administração Geral Tributária,

O Centro Integrado de Apoio e Desenvolvimento Individual (CIADI), com sede no Condomínio Jardim de Rosas, Talatona, Luanda, está a preparar o seu sistema administrativo para o cadastro comercial e a emissão de documentos, procurando assegurar que a consulta de dados fiscais seja realizada apenas por meios oficiais e autorizados.

Solicitamos, por favor, orientação sobre a possibilidade de integrar no sistema CIADI um serviço oficial de consulta/validação de NIF para clientes, entidades e fornecedores.

Agradecemos esclarecimento sobre os seguintes pontos:

1. Existe WebService/API oficial autorizado para consulta de NIF por sistemas de software de entidades privadas?
2. Qual é o procedimento formal para solicitar acesso, credenciais e eventual autorização?
3. Que documentação institucional, fiscal, técnica ou contratual deve ser apresentada pelo CIADI?
4. Existe ambiente de testes/homologação, documentação técnica, especificação de endpoints, esquema de autenticação e exemplos de resposta?
5. Quais os campos que podem ser devolvidos (por exemplo, denominação/nome, tipo, estado e regime de IVA), e quais são as condições de utilização, conservação e apresentação desses dados?
6. Existem custos, requisitos de certificação, limites de chamadas, níveis de serviço ou medidas de segurança obrigatórias?
7. Caso não exista API disponível para este caso de uso, qual é o procedimento oficial recomendado para consulta manual e confirmação dos dados?

O CIADI não pretende contornar autenticação, automatizar acessos não autorizados ao Portal do Contribuinte ou recolher dados fora dos canais permitidos. Até existir autorização e documentação oficial, a aplicação limitar-se-á à validação local de formato, deteção de duplicados e registo de que a verificação oficial está pendente.

Agradecemos a indicação do departamento responsável e dos passos seguintes.

Com os melhores cumprimentos,  
**CIADI — Administração**  
geral@ciadi.ao  
Condomínio Jardim de Rosas, Talatona, Luanda, Angola

## Checklist antes do envio

- [ ] Confirmar a denominação legal completa e o NIF institucional que devem constar no pedido.
- [ ] Confirmar quem está autorizado a representar a entidade.
- [ ] Enviar a partir do e-mail institucional.
- [ ] Guardar cópia do pedido e número de protocolo/resposta.
- [ ] Não anexar palavras-passe, chaves privadas, dados de pacientes ou informação clínica.
- [ ] Não implementar chamadas de produção até receber e validar documentação e autorização oficiais.

## Comportamento do CIADI enquanto aguarda resposta

- Distinguir visualmente **Formato plausível**, **Duplicado no CIADI**, **Consulta oficial pendente**, **Confirmado pela AGT** e **Consulta indisponível**.
- Nunca converter uma falha de ligação ou ausência de credenciais em “NIF inválido”.
- Não preencher automaticamente nome/estado fiscal como se viessem da AGT sem resposta oficial rastreável.
- Guardar apenas os dados comerciais necessários e, quando houver integração autorizada, registar data/hora, resultado e referência técnica da consulta sem expor credenciais.
- Manter credenciais no servidor/segredo gerido, nunca no HTML, JavaScript distribuído ou instalador.

## Fontes oficiais consultadas

- Contactos do Portal do Contribuinte: https://portaldocontribuinte.minfin.gov.ao/contactos
- Perguntas frequentes — registo/acesso ao Portal: https://portaldocontribuinte.minfin.gov.ao/perguntas-frequentes/utilizacao-do-portal
- Portal oficial da AGT: https://agt.minfin.gov.ao/

**Nota:** a existência de consulta de NIF no Portal não prova, por si só, que exista uma API pública disponível para o CIADI. A modalidade de integração e a autorização devem ser confirmadas diretamente pela AGT.
