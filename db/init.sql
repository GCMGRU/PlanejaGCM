CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  usuario VARCHAR(80) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil VARCHAR(30) NOT NULL CHECK (perfil IN ('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN')),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projetos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  descricao TEXT,
  data_inicio DATE,
  data_fim_prevista DATE,
  data_conclusao DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'PLANEJADO' CHECK (status IN (
    'PLANEJADO',
    'EM_DESENVOLVIMENTO',
    'EM_TESTE',
    'PAUSADO',
    'CONCLUIDO',
    'CANCELADO'
  )),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN (
    'BAIXA',
    'MEDIA',
    'ALTA',
    'URGENTE'
  )),
  responsavel_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modulos (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  nome VARCHAR(160) NOT NULL,
  descricao TEXT,
  data_inicio DATE,
  data_fim_prevista DATE,
  data_conclusao DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'NAO_INICIADO' CHECK (status IN (
    'NAO_INICIADO',
    'EM_DESENVOLVIMENTO',
    'AGUARDANDO_VALIDACAO',
    'EM_AJUSTE',
    'CONCLUIDO',
    'PAUSADO',
    'CANCELADO'
  )),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN (
    'BAIXA',
    'MEDIA',
    'ALTA',
    'URGENTE'
  )),
  responsavel_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  observacoes TEXT,
  criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ideias (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT NOT NULL,
  projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL,
  modulo_id INTEGER REFERENCES modulos(id) ON DELETE SET NULL,
  prioridade VARCHAR(20) NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN (
    'BAIXA',
    'MEDIA',
    'ALTA',
    'URGENTE'
  )),
  status VARCHAR(40) NOT NULL DEFAULT 'NOVA' CHECK (status IN (
    'NOVA',
    'EM_ANALISE',
    'ACEITA',
    'RECUSADA',
    'TRANSFORMADA_EM_MODULO',
    'IMPLEMENTADA'
  )),
  criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  resposta_dev TEXT,
  respondido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  respondido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historico_alteracoes (
  id SERIAL PRIMARY KEY,
  entidade VARCHAR(60) NOT NULL,
  entidade_id INTEGER,
  acao VARCHAR(80) NOT NULL,
  campo_alterado VARCHAR(100),
  valor_antigo TEXT,
  valor_novo TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  descricao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comentarios_modulo (
  id SERIAL PRIMARY KEY,
  modulo_id INTEGER NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  comentario TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commits_modulo (
  id SERIAL PRIMARY KEY,
  modulo_id INTEGER NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  hash VARCHAR(40),
  branch VARCHAR(100),
  data_commit DATE,
  registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commits_modulo_id ON commits_modulo(modulo_id);

CREATE TABLE IF NOT EXISTS pre_analise (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  conteudo TEXT NOT NULL,
  criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reunioes (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  setor VARCHAR(120) NOT NULL,
  assunto TEXT NOT NULL,
  data_reuniao DATE NOT NULL,
  horario TIME NOT NULL,
  projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL,
  modulo_id INTEGER REFERENCES modulos(id) ON DELETE SET NULL,
  ideia_id INTEGER REFERENCES ideias(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'AGENDADA' CHECK (status IN ('AGENDADA', 'CANCELADA', 'REAGENDADA', 'CONCLUIDA')),
  relato TEXT,
  criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_pre_analise_atualizado_em ON pre_analise;
CREATE TRIGGER trg_pre_analise_atualizado_em
BEFORE UPDATE ON pre_analise
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_reunioes_atualizado_em ON reunioes;
CREATE TRIGGER trg_reunioes_atualizado_em
BEFORE UPDATE ON reunioes
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_pre_analise_projeto_id ON pre_analise(projeto_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_data ON reunioes(data_reuniao DESC);
CREATE INDEX IF NOT EXISTS idx_reunioes_status ON reunioes(status);

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_atualizado_em ON usuarios;
CREATE TRIGGER trg_usuarios_atualizado_em
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_projetos_atualizado_em ON projetos;
CREATE TRIGGER trg_projetos_atualizado_em
BEFORE UPDATE ON projetos
FOR EACH ROW
EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_modulos_atualizado_em ON modulos;
CREATE TRIGGER trg_modulos_atualizado_em
BEFORE UPDATE ON modulos
FOR EACH ROW
EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_ideias_atualizado_em ON ideias;
CREATE TRIGGER trg_ideias_atualizado_em
BEFORE UPDATE ON ideias
FOR EACH ROW
EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);
CREATE INDEX IF NOT EXISTS idx_projetos_prioridade ON projetos(prioridade);
CREATE INDEX IF NOT EXISTS idx_modulos_projeto_id ON modulos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_modulos_status ON modulos(status);
CREATE INDEX IF NOT EXISTS idx_modulos_prazo ON modulos(data_fim_prevista);
CREATE INDEX IF NOT EXISTS idx_ideias_status ON ideias(status);
CREATE INDEX IF NOT EXISTS idx_ideias_criado_por ON ideias(criado_por);
CREATE INDEX IF NOT EXISTS idx_historico_entidade ON historico_alteracoes(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_historico_criado_em ON historico_alteracoes(criado_em DESC);
