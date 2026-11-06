# CIADI — Motor Documental: desenho de persistência e autenticação (fase 2)

## Âmbito
Especificação técnica para a estação Suporte Informática. Este documento não é uma migração SQL e não foi aplicado ao Supabase. A implementação da persistência só avança depois de inspeccionar o estado real do projecto, aprovar o modelo e rever as políticas de acesso numa fase própria.

## Contratos já preparados no motor de aplicação
- `repository.saveDraft(document)`: persistir apenas rascunhos.
- `repository.issueDraft(documentId)`: operação atómica no servidor; atribui série/número, congela o snapshot, emite o documento e devolve uma URL HTTPS de verificação com token de uso documental.
- `repository.archiveIssued({documentId, artifact})`: arquivar PDF final em armazenamento privado e associar hash SHA-256.
- `repository.verifyToken({documentId, token})`: validar token e estado, devolvendo apenas metadados públicos mínimos.
- Adaptadores separados para QR, PDF, envio e registo de entrega. A ausência de adaptador produz erro explícito; nunca se simula gravação, emissão, envio ou arquivo.

## Modelo lógico proposto (a validar contra a base de dados existente)
### `ciadi_ti.documents`
- `id` UUID, chave primária.
- `template_code`, `template_version`, `template_snapshot` JSONB.
- `document_number` único, nulo enquanto rascunho.
- `status`: draft, pending_validation, approved, issued, revoked, replaced.
- `payload` JSONB com os campos do documento; não inclui segredos de autenticação.
- `created_by`, `created_at`, `issued_by`, `issued_at`.
- `pdf_storage_path`, `pdf_sha256`, `supersedes_document_id`.
- Imutabilidade lógica do snapshot emitido; correcção cria substituição, não actualiza o documento emitido.

### `ciadi_ti.document_sequences`
- Chave composta por série/tipo/ano.
- Contador actualizado exclusivamente numa transacção do servidor com bloqueio de linha.
- A numeração nunca é calculada no cliente.

### `ciadi_ti.document_verification_tokens`
- `document_id`, `token_hash`, `created_at`, `expires_at` opcional, `revoked_at`.
- O token em claro só é apresentado uma vez ao emissor para construir o QR; apenas o hash é persistido.
- O endpoint de validação recebe token e compara hash em ambiente servidor. Não expõe payload, nomes, contactos, dados clínicos, anexos ou utilizadores.

### `ciadi_ti.document_events`
- Histórico append-only: criação, submissão, validação, aprovação, emissão, arquivo, envio, revogação e substituição.
- Actor, data, evento, referência e metadados estritamente necessários.

### `ciadi_ti.document_deliveries`
- Registo de destinatário, canal, estado, identificador externo, data e erro sanitizado.
- Não guardar conteúdo de e-mail ou credenciais do fornecedor no registo.

## Operações de servidor necessárias
1. Criar rascunho validando modelo, versão e campos.
2. Submeter para validação.
3. Aprovar/rejeitar, quando o tipo documental o exigir.
4. Emitir atomicamente: bloquear sequência, atribuir número, congelar snapshot, criar token aleatório, guardar hash, escrever evento e devolver URL de verificação.
5. Revogar/substituir sem apagar o original.
6. Registar envio e arquivo apenas após confirmação do respectivo adaptador.

Nenhuma operação privilegiada deve confiar em `user_metadata` para autorização. A autorização real será definida e auditada na fase posterior de permissões. Não criar funções SECURITY DEFINER públicas sem justificação, controlo de identidade e revisão explícita.

## PDF, QR e arquivo
- PDF A4 gerado a partir do snapshot emitido e do modelo versionado, nunca a partir de campos editáveis no browser.
- O QR contém apenas URL HTTPS com identificador opaco e token aleatório de alta entropia.
- A página de verificação apresenta apenas autenticidade, tipo, número, data, emissor institucional e estado (válido/revogado/substituído), após validação do token.
- PDF no bucket privado `documentos`; caminho sem nomes ou dados pessoais. Verificar as políticas actuais do bucket antes de qualquer integração.
- SHA-256 do artefacto guardado para detecção de alteração.
- Envio por e-mail só depois de identificar e aprovar o fornecedor (Resend/Brevo) e registar resultado.

## Critérios de aceitação
- Concorrência de emissões não duplica números.
- Um rascunho não pode ser autenticado como emitido.
- Token inválido, revogado ou documento substituído não valida como original vigente.
- Verificação não revela dados pessoais nem payload documental.
- PDF arquivado corresponde ao hash registado.
- Documento emitido não pode ser editado nem eliminado pelo fluxo normal.
- Cada transição deixa evento auditável.
- Testes de integração em ambiente não produtivo antes de qualquer proposta de produção.

## Fora desta fase
- Aplicação de migrações, criação/alteração de tabelas, funções, policies, grants ou buckets.
- Alterações a RLS, permissões, contas, Setup, outras estações ou produção.
