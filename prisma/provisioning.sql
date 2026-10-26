-- Provisionamento do Simulai na instância Postgres compartilhada com o lawsuits-management-backend.
-- Rode UMA vez por ambiente, conectado como superusuário (ou como um role com CREATEROLE),
-- dentro do database do ambiente: \c dev  (depois \c tst, \c prd trocando o sufixo e a senha).
--
-- Resultado: um role próprio do Simulai por ambiente, que só enxerga o schema simulai_service.
-- Ele não tem acesso às tabelas do lawsuits (schemas public/auth_service), e o lawsuits não
-- precisa de nenhuma mudança.

-- 1. Role da aplicação (troque a senha; guarde-a só no .env / secrets do deploy).
CREATE ROLE simulai_backend_dev WITH LOGIN PASSWORD 'CHANGE_ME';

-- 2. Pode conectar no database do ambiente. CREATE no database é exigido porque o Prisma e a
--    migration inicial executam "CREATE SCHEMA IF NOT EXISTS simulai_service", e o Postgres checa
--    essa permissão mesmo quando o schema já existe. Isso permite criar schemas novos, mas não dá
--    acesso a nenhum schema existente do lawsuits.
GRANT CONNECT, CREATE ON DATABASE dev TO simulai_backend_dev;

-- 3. Schema do serviço, pertencente ao role do Simulai (as migrations criam as tabelas nele).
CREATE SCHEMA IF NOT EXISTS simulai_service AUTHORIZATION simulai_backend_dev;

-- 4. Evita que o role do Simulai leia o que estiver em public por herança de PUBLIC.
REVOKE ALL ON SCHEMA simulai_service FROM PUBLIC;

-- Alternativa mais simples (menos isolamento): reutilizar o role existente do lawsuits
-- (lawsuits_backend_dev), que já é dono do database. Nesse caso basta:
--   CREATE SCHEMA IF NOT EXISTS simulai_service AUTHORIZATION lawsuits_backend_dev;
-- e usar esse usuário na DATABASE_URL do Simulai.
