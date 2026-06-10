# HelpDesk Pro

Sistema de HelpDesk com API REST para integração com Power BI.

---

## Deploy no Railway (passo a passo)

### 1. Crie uma conta no Railway
Acesse https://railway.app e faça login com sua conta GitHub.

### 2. Suba o projeto para o GitHub
```bash
git init
git add .
git commit -m "HelpDesk Pro - primeira versão"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/helpdesk-pro.git
git push -u origin main
```

### 3. Crie o projeto no Railway
- Clique em **New Project**
- Selecione **Deploy from GitHub repo**
- Escolha o repositório `helpdesk-pro`

### 4. Adicione o banco de dados PostgreSQL
- Dentro do projeto, clique em **+ New**
- Selecione **Database → PostgreSQL**
- O Railway adiciona automaticamente a variável `DATABASE_URL`

### 5. Configure as variáveis de ambiente
No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `JWT_SECRET` | uma string longa e aleatória |
| `API_KEY` | hd_live_suachavepersonalizada |
| `NODE_ENV` | production |
| `ADMIN_EMAIL` | seu@email.com |
| `ADMIN_PASSWORD` | sua_senha_segura |

### 6. Deploy automático
O Railway detecta o `package.json` e executa `npm start` automaticamente.
Aguarde ~2 minutos e acesse a URL gerada (ex: `helpdesk-pro.up.railway.app`).

---

## Integração com Power BI

### Via API REST
1. Abra o Power BI Desktop
2. **Obter Dados → Web** (modo Avançado)
3. URL: `https://SEU_DOMINIO.up.railway.app/api/v1/tickets/export?format=json`
4. Cabeçalho HTTP:
   - Parâmetro: `x-api-key`
   - Valor: o valor da sua `API_KEY`
5. Clique em OK e transforme os dados no Power Query

### Endpoints disponíveis

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/v1/tickets` | Lista todos os chamados |
| GET | `/api/v1/tickets/metrics` | Métricas resumidas |
| GET | `/api/v1/tickets/export?format=csv` | Exportar CSV |
| GET | `/api/v1/tickets/export?format=json` | Exportar JSON |
| GET | `/api/v1/tickets/:id` | Detalhes de um chamado |
| POST | `/api/v1/tickets` | Criar chamado |
| PATCH | `/api/v1/tickets/:id` | Atualizar chamado |
| GET | `/api/v1/metrics` | Métricas para Power BI |
| GET | `/api/v1/agents` | Lista agentes |
| GET | `/api/v1/categories` | Lista categorias |
| POST | `/auth/login` | Autenticação |

### Autenticação
Todas as rotas aceitam autenticação via:
- **API Key** (recomendado para Power BI): header `x-api-key: SUA_API_KEY`
- **JWT** (para o app web): header `Authorization: Bearer TOKEN`

---

## Executar localmente

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações locais

# Iniciar em modo desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

---

## Estrutura do projeto

```
helpdesk-pro/
├── src/
│   ├── server.js          # Servidor Express principal
│   ├── db.js              # Conexão PostgreSQL
│   ├── auth.js            # Middleware de autenticação
│   ├── routes.auth.js     # Rota de login
│   ├── routes.tickets.js  # API de chamados
│   └── database.sql       # Schema e dados iniciais
├── public/
│   └── index.html         # Frontend (HelpDesk Pro)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
