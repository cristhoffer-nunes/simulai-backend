# simulai-backend

API do Simulai, a plataforma de questões e simulados. Um deployable NestJS, organizado em módulos
por contexto (hoje só `identity`: login, sessões, senhas e a área administrativa de usuários).

Este repositório segue as regras de `CLAUDE.md` e `.claude/ADR/*`, as mesmas do
`lawsuits-management-backend` (copiadas do `backend-engineering-template`). Leia antes de mudar a
estrutura.

## Stack

NestJS 10 + Fastify · Prisma 5 (multiSchema) · PostgreSQL (instância compartilhada) · JWT RS256 · Resend para e-mails · Pino · Jest.

## Como o Simulai convive com o lawsuits na mesma infraestrutura

| Recurso | lawsuits-management-backend | simulai-backend |
|---|---|---|
| Postgres | databases `dev`, `tst`, `prd` | os mesmos databases |
| Schema | `public` / `auth_service` | `simulai_service` (só ele) |
| Tabela de migrations | `public._prisma_migrations` | `simulai_service._prisma_migrations` |
| Role Postgres | `lawsuits_backend_<env>` | `simulai_backend_<env>` (recomendado) |
| Sessões e limites de tentativa | Redis | Tabelas no próprio schema (sem Redis) |
| Chaves JWT | par RS256 próprio | par RS256 próprio, `aud=simulai`, `iss=simulai-backend` |

O Simulai não usa Redis (o Redis compartilhado só é acessível de dentro da VPS). Sessões
(`auth_sessions`, só o hash do token), links de senha (`password_reset_links`) e contadores de
tentativas (`rate_limit_buckets`) ficam no Postgres; um job interno apaga os registros expirados a
cada hora.

O `DATABASE_URL` **precisa** terminar em `?schema=simulai_service`; a aplicação recusa subir sem
isso (`src/config/env.schema.ts`). É esse parâmetro que mantém as migrations do Simulai separadas
das do lawsuits. Um token emitido por um sistema nunca é aceito pelo outro.

## Estrutura

```
src/
  config/        Configuração validada com Zod (ADR-013)
  shared/        Prisma, logger, Result, erros RFC 9457
  health/        GET /health (Postgres)
  modules/
    identity/
      domain/          User, Role, Email, DisplayName, política de senha e de acesso
      application/     Casos de uso + portas (hasher, tokens, e-mail, rate limit...)
      infrastructure/  Prisma, bcrypt, JWT, Resend, templates de e-mail, limpeza de sessões expiradas
      presentation/    Controllers, DTOs, guards
prisma/
  schema.prisma        Modelo completo do MVP (usuários, taxonomia, questões, simulados, tentativas)
  migrations/          Migration inicial (inclui constraints que o Prisma não expressa, ver abaixo)
  seed.ts              Papéis, permissões, taxonomia base e o primeiro admin
  provisioning.sql     Criação do role e do schema por ambiente
tests/                 Testes unitários (espelham src/)
```

## Papéis

| Papel | Permissões | O que acessa |
|---|---|---|
| `admin` | `users.manage` | Área administrativa (`/v1/admin/*`) |
| `student` | `study.access` | Área de estudo; **nunca** acessa rotas admin (403) |

Contas não se cadastram sozinhas. O admin cria a conta, que nasce sem senha utilizável e com
`mustChangePassword=true`. O aluno recebe um link de primeiro acesso por e-mail (válido por 72 h),
e o mesmo link volta na resposta para o admin, que pode repassá-lo se o e-mail não estiver
configurado. Ao definir a senha, a sessão já é aberta. Links de recuperação valem 1 h e são de uso
único.

## Primeira configuração

### 1. Provisionar o banco (uma vez por ambiente)

Rode `prisma/provisioning.sql` na instância compartilhada, dentro de cada database (`dev`, `tst`,
`prd`), trocando o sufixo do role e a senha. Ele cria o role `simulai_backend_<env>` e o schema
`simulai_service`, sem tocar em nada do lawsuits.

### 2. Dependências e cliente Prisma

```bash
npm install
npm run prisma:generate
```

### 3. Chaves RS256 (uma vez por ambiente, nunca commitadas)

```bash
npm run keys:generate
```

### 4. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. `.env` e `keys/` estão no `.gitignore`.

### 5. Migrations e seed

```bash
npm run prisma:migrate:deploy
npm run prisma:seed
```

O seed é idempotente. Ele cria o admin definido em `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(senha forte: 8+ caracteres com minúscula, maiúscula, número e símbolo).

### 6. Rodar

```bash
npm run start:dev           # processo local, porta 3002
docker compose up --build   # container na rede shared-postgres-net
```

Swagger (fora de produção): `/simulai-backend/docs`.

## Endpoints

Todos sob `/simulai-backend/v1`, exceto `/simulai-backend/health`.

| Método | Rota | Acesso | Observação |
|---|---|---|---|
| POST | `/auth/login` | público | Rate limit por e-mail+IP. Se a senha precisar ser trocada, responde `passwordResetRequired` com um token de troca |
| POST | `/auth/refresh` | público | Rotaciona o refresh token |
| POST | `/auth/logout` | público | Revoga o refresh token (204) |
| POST | `/auth/forgot-password` | público | Sempre 202, não revela se o e-mail existe |
| GET | `/auth/reset-password/validate?token=` | público | `{ valid, email, type }` |
| POST | `/auth/reset-password` | público | Define a senha e abre a sessão |
| GET | `/auth/public-key` | público | Chave pública PEM |
| GET / PATCH | `/me` | autenticado | Perfil (nome de exibição) |
| GET | `/admin/users` | `users.manage` | Busca, filtro por papel e status, paginação |
| POST | `/admin/users` | `users.manage` | Cria a conta e devolve `accessLink` |
| PATCH | `/admin/users/:id` | `users.manage` | Nome, papel, ativar/desativar (não pode em si mesmo) |
| POST | `/admin/users/:id/access-link` | `users.manage` | Gera um novo link de acesso |
| GET | `/taxonomy` | `study.access` | Áreas → disciplinas → assuntos (catálogo + os do aluno), com contagem de questões ativas |
| POST | `/subjects` | `study.access` | Cria disciplina privada; se já existir uma com o mesmo nome (sem diferenciar maiúsculas e acentos), devolve a existente com 200 |
| POST | `/subjects/:id/topics` | `study.access` | Cria assunto privado, com a mesma regra de reaproveitamento |
| GET | `/questions` | `study.access` | Banco do aluno. Filtros `status` (padrão `active`), `subjectId`, `topicId`, `difficulty`, `q` (enunciado), `collectionId`; paginação `cursor` + `limit` (até 100). Responde `{ items, nextCursor, total }` |
| POST | `/questions` | `study.access` | Cria questão: 2 a 6 alternativas, exatamente uma correta, enunciado e explicação obrigatórios. Erros por campo em `errors` (ex.: `options[2].text` / `DUPLICATE_OPTION`) |
| GET | `/questions/:id` | `study.access` | Detalhe com gabarito (editor). Questão de outra pessoa responde 404 |
| PATCH | `/questions/:id` | `study.access` | Atualização parcial; `options` substitui todas; `status` arquiva ou reativa |
| DELETE | `/questions/:id` | `study.access` | Arquiva (remoção lógica). Provas já feitas não mudam |

Erros seguem RFC 9457 (`application/problem+json`), com `title` igual ao código do erro
(`INVALID_CREDENTIALS`, `USER_NOT_FOUND`...), o mesmo formato do lawsuits.

## Migrations: constraints fora do Prisma

A migration inicial foi escrita à mão e tem regras que o `schema.prisma` não consegue expressar:

- índices únicos parciais (uma alternativa correta por questão, uma tentativa em andamento por
  simulado);
- unicidade de nomes sem diferenciar maiúsculas (`lower(name)`) na taxonomia;
- `CHECK` de enums, faixas e consistência (status, dificuldade, `question_count` de 1 a 200,
  pontuação de 0 a 100...).

O Prisma ignora `CHECK`, mas **tenta remover índices parciais e de expressão** ao gerar uma nova
migration. Por isso, gere novas migrations sempre com:

```bash
npx prisma migrate dev --create-only --name <nome>
```

revise o SQL e apague qualquer `DROP INDEX` desses índices antes de aplicar. O workflow de PR roda
`migrate deploy` e o seed duas vezes num Postgres limpo para pegar regressões.

## Testes

```bash
npm test           # unitários
npm run test:cov   # com cobertura (mínimo de 80% em todas as métricas)
npm run lint:check
npm run typecheck
```
