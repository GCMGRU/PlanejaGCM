require('dotenv').config();

const { pool, dbQuery } = require('./pool');

async function migrate() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS pre_analise (
      id SERIAL PRIMARY KEY,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      titulo VARCHAR(200) NOT NULL,
      conteudo TEXT NOT NULL,
      criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Tabela pre_analise: OK');

  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_pre_analise_projeto_id ON pre_analise(projeto_id)`);

  await dbQuery(`
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
    )
  `);
  console.log('Tabela reunioes: OK');

  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_reunioes_data ON reunioes(data_reuniao DESC)`);
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_reunioes_status ON reunioes(status)`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS fontes_projeto (
      id SERIAL PRIMARY KEY,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      titulo VARCHAR(200) NOT NULL,
      descricao TEXT,
      link TEXT,
      tipo VARCHAR(30) NOT NULL DEFAULT 'OUTRO' CHECK (tipo IN ('URL', 'DOCUMENTO', 'PLANILHA', 'SISTEMA', 'CONTATO', 'OUTRO')),
      criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Tabela fontes_projeto: OK');

  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_fontes_projeto_projeto_id ON fontes_projeto(projeto_id)`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS equipe_projeto (
      id SERIAL PRIMARY KEY,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      funcao VARCHAR(120) NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(projeto_id, usuario_id)
    )
  `);
  console.log('Tabela equipe_projeto: OK');

  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_equipe_projeto_projeto_id ON equipe_projeto(projeto_id)`);

  await dbQuery(`
    DROP TRIGGER IF EXISTS trg_pre_analise_atualizado_em ON pre_analise;
    CREATE TRIGGER trg_pre_analise_atualizado_em
    BEFORE UPDATE ON pre_analise
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  `);

  await dbQuery(`
    DROP TRIGGER IF EXISTS trg_reunioes_atualizado_em ON reunioes;
    CREATE TRIGGER trg_reunioes_atualizado_em
    BEFORE UPDATE ON reunioes
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  `);

  console.log('Triggers: OK');
  console.log('Migração concluída.');
}

migrate()
  .catch(err => {
    console.error('Erro na migração:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
