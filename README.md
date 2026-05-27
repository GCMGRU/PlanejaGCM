# PlannoDev

Sistema interno para planejamento e acompanhamento do desenvolvimento de softwares.

## Tecnologias

- Node.js
- Express
- PostgreSQL
- HTML, CSS e JavaScript puro
- JWT em cookie HttpOnly
- bcrypt para hash de senhas

## Requisitos

- Node.js 18 ou superior
- PostgreSQL 14 ou superior
- npm

## Instalação local

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Ajuste a variável `DATABASE_URL` no `.env`:

```env
PORT=3000
DATABASE_URL=postgres://usuario:senha@localhost:5432/plannodev
JWT_SECRET=troque_este_segredo
NODE_ENV=development
DB_SSL=false
```

Para rodar localmente usando o PostgreSQL do Railway, copie a `DATABASE_PUBLIC_URL`
do serviço Postgres no Railway e use no `.env` como `DATABASE_URL`. Nesse caso,
ative SSL:

```env
PORT=3000
DATABASE_URL=<DATABASE_PUBLIC_URL do Railway>
JWT_SECRET=<um segredo forte>
NODE_ENV=development
DB_SSL=true
```

4. Crie o banco no PostgreSQL local, caso não esteja usando Railway:

```sql
CREATE DATABASE plannodev;
```

5. Rode o script de criação das tabelas:

```bash
psql "postgres://usuario:senha@localhost:5432/plannodev" -f db/init.sql
```

6. Rode o seed dos usuários iniciais:

```bash
npm run seed
```

7. Inicie o servidor:

```bash
npm run dev
```

Ou:

```bash
npm start
```

8. Acesse:

```text
http://localhost:3000/login.html
```

## Usuários iniciais

| Nome | Usuário | Senha | Perfil |
| --- | --- | --- | --- |
| Guilherme | guilherme | 123456 | DESENVOLVEDOR |
| Duarte | duarte | 123456 | DESENVOLVEDOR |
| Domingos | domingos | 123456 | SUPERVISOR |

As senhas são temporárias para desenvolvimento e devem ser trocadas diretamente no banco depois.

## Scripts npm

```bash
npm start
npm run dev
npm run seed
```

## Estrutura

```text
server.js
db/
  pool.js
  init.sql
  seed.js
middleware/
  auth.js
  roles.js
routes/
  auth.routes.js
  dashboard.routes.js
  projetos.routes.js
  modulos.routes.js
  ideias.routes.js
  usuarios.routes.js
  historico.routes.js
services/
  historico.service.js
public/
  login.html
  dashboard.html
  projetos.html
  projeto-detalhe.html
  ideias.html
  usuarios.html
  historico.html
  css/style.css
  js/
```

## Deploy no Railway

1. Publique o repositório no GitHub.
2. Crie um projeto no Railway a partir do repositório.
3. Adicione um banco PostgreSQL no Railway.
4. Configure as variáveis:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<um segredo forte>
NODE_ENV=production
```

Use a variável privada `DATABASE_URL` no app hospedado dentro do Railway. Para
acessar o banco pelo seu computador, DBeaver ou app local, use a
`DATABASE_PUBLIC_URL` do serviço PostgreSQL.

5. Rode o SQL `db/init.sql` no banco do Railway.
6. Rode o seed uma vez com:

```bash
npm run seed
```

7. O comando de start do Railway deve usar:

```bash
npm start
```

O backend serve a API e também os arquivos estáticos da pasta `public`, então não é necessário hospedar o frontend separadamente.

## Permissões

DESENVOLVEDOR:

- cria, edita e exclui projetos;
- cria, edita, conclui e exclui módulos;
- altera prazos, responsáveis e status;
- visualiza e responde ideias;
- transforma ideias em módulos;
- acessa usuários e histórico.

SUPERVISOR:

- acessa dashboard;
- visualiza projetos, módulos e andamento;
- cria ideias;
- visualiza as próprias ideias e respostas;
- edita as próprias ideias enquanto estiverem com status `NOVA`.

## Observações

- Não existe cadastro público de usuários.
- O campo `senha_hash` nunca é retornado pelas rotas.
- Rotas internas exigem login.
- Rotas administrativas exigem perfil `DESENVOLVEDOR`.
- O histórico é registrado automaticamente nas ações principais.

