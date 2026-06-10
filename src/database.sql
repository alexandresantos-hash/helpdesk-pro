-- Criação das tabelas do HelpDesk Pro
-- Executado automaticamente na primeira inicialização

CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'agent', -- 'admin' ou 'agent'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  requester_name VARCHAR(100) NOT NULL,
  requester_email VARCHAR(150),
  priority VARCHAR(20) DEFAULT 'Média' CHECK (priority IN ('Baixa','Média','Alta','Crítica')),
  status VARCHAR(20) DEFAULT 'Aberto' CHECK (status IN ('Aberto','Pendente','Resolvido','Fechado')),
  category_id INTEGER REFERENCES categories(id),
  agent_id INTEGER REFERENCES agents(id),
  sla_first_response TIMESTAMP,
  sla_resolve_by TIMESTAMP,
  sla_first_breached BOOLEAN DEFAULT false,
  sla_resolve_breached BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id),
  agent_name VARCHAR(100),
  action VARCHAR(50), -- 'created','updated','commented','status_changed','assigned'
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(30), -- 'sla_breach','sla_warn','new_ticket','assigned','resolved'
  message TEXT NOT NULL,
  ticket_id INTEGER REFERENCES tickets(id),
  agent_id INTEGER REFERENCES agents(id),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dados iniciais
INSERT INTO categories (name) VALUES
  ('Hardware'),('Software'),('Rede/VPN'),('E-mail'),
  ('Acesso/Senha'),('Impressora'),('Outros')
ON CONFLICT (name) DO NOTHING;

-- Tickets de exemplo
INSERT INTO tickets (subject, description, requester_name, requester_email, priority, status, category_id, created_at)
VALUES
  ('Impressora não funciona no 2º andar','HP LaserJet parou de imprimir.','Maria Silva','maria@empresa.com','Alta','Aberto',6, NOW() - INTERVAL '5 hours'),
  ('Acesso ao sistema ERP bloqueado','Usuário não consegue logar no ERP.','João Oliveira','joao@empresa.com','Crítica','Aberto',5, NOW() - INTERVAL '2 hours'),
  ('E-mail corporativo com erro de envio','Erros ao enviar e-mails externos.','Fernanda Ramos','fernanda@empresa.com','Média','Pendente',4, NOW() - INTERVAL '28 hours'),
  ('Notebook lento após atualização','Desempenho degradado após Windows Update.','Roberto Alves','roberto@empresa.com','Baixa','Resolvido',1, NOW() - INTERVAL '72 hours'),
  ('VPN não conecta em home office','Erro de autenticação na VPN.','Patricia Costa','patricia@empresa.com','Alta','Aberto',3, NOW() - INTERVAL '26 hours')
ON CONFLICT DO NOTHING;
