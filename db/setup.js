/**
 * Setup completo do banco de dados.
 * Executa: init.sql → migrações → seed → admin
 * Uso: node db/setup.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool, dbQuery } = require('./pool');

function gerarSenhaAleatoria() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from(crypto.randomBytes(14)).map((b) => chars[b % chars.length]).join('');
}

async function setup() {
  console.log('=== Setup do banco de dados ===\n');

  // 1. Executar init.sql (todas as tabelas base)
  console.log('1. Criando tabelas (init.sql)...');
  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
  await pool.query(sql);
  console.log('   Tabelas criadas.\n');

  // 2. Migrações adicionais (tabelas criadas após o init inicial)
  console.log('2. Aplicando migrações...');

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS fontes_projeto (
      id SERIAL PRIMARY KEY,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      titulo VARCHAR(200) NOT NULL,
      descricao TEXT,
      link TEXT,
      tipo VARCHAR(30) NOT NULL DEFAULT 'OUTRO' CHECK (tipo IN ('URL','DOCUMENTO','PLANILHA','SISTEMA','CONTATO','OUTRO')),
      criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `);
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
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_equipe_projeto_projeto_id ON equipe_projeto(projeto_id)`);

  // Coluna deve_redefinir_senha (para bancos criados antes desta versão)
  await dbQuery(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS deve_redefinir_senha BOOLEAN DEFAULT FALSE`);

  console.log('   Migrações aplicadas.\n');

  // 3. Seed: usuários padrão
  console.log('3. Criando usuários padrão (seed)...');
  const usuariosIniciais = [
    { nome: 'Guilherme', usuario: 'guilherme', senha: '123456', perfil: 'DESENVOLVEDOR' },
    { nome: 'Duarte',    usuario: 'duarte',    senha: '123456', perfil: 'DESENVOLVEDOR' },
    { nome: 'Domingos',  usuario: 'domingos',  senha: '123456', perfil: 'SUPERVISOR'    },
  ];
  for (const u of usuariosIniciais) {
    const hash = await bcrypt.hash(u.senha, 10);
    await dbQuery(
      `INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (usuario) DO UPDATE SET
         nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash,
         perfil = EXCLUDED.perfil, ativo = TRUE, atualizado_em = NOW()`,
      [u.nome, u.usuario, hash, u.perfil]
    );
    console.log(`   ${u.usuario} (${u.perfil})`);
  }

  // 4. Usuário admin
  console.log('\n4. Criando usuário admin...');
  const adminSenha = process.env.ADMIN_PASSWORD || gerarSenhaAleatoria();
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`   ⚠️  ADMIN_PASSWORD não definida. Senha gerada automaticamente:`);
    console.log(`   ➜  ${adminSenha}  (anote agora, não será exibida novamente)`);
  }
  const adminHash = await bcrypt.hash(adminSenha, 10);
  await dbQuery(
    `INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo)
     VALUES ($1, $2, $3, 'ADMIN', TRUE)
     ON CONFLICT (usuario) DO UPDATE SET
       nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash,
       perfil = EXCLUDED.perfil, ativo = TRUE, atualizado_em = NOW()`,
    ['admin', 'admin', adminHash]
  );
  console.log('   admin (ADMIN) criado.');

  console.log('\n=== Setup concluído com sucesso! ===');
}

setup()
  .catch(err => {
    console.error('\nErro durante o setup:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
