require('dotenv').config();

const bcrypt = require('bcrypt');
const { pool, dbQuery } = require('./pool');

const usuariosIniciais = [
  { nome: 'Guilherme', usuario: 'guilherme', senha: '123456', perfil: 'DESENVOLVEDOR' },
  { nome: 'Duarte', usuario: 'duarte', senha: '123456', perfil: 'DESENVOLVEDOR' },
  { nome: 'Domingos', usuario: 'domingos', senha: '123456', perfil: 'SUPERVISOR' }
];

async function seed() {
  for (const usuario of usuariosIniciais) {
    const senhaHash = await bcrypt.hash(usuario.senha, 10);

    await dbQuery(
      `INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (usuario)
       DO UPDATE SET
         nome = EXCLUDED.nome,
         senha_hash = EXCLUDED.senha_hash,
         perfil = EXCLUDED.perfil,
         ativo = TRUE,
         atualizado_em = NOW()`,
      [usuario.nome, usuario.usuario, senhaHash, usuario.perfil]
    );

    console.log(`Usuário pronto: ${usuario.usuario} (${usuario.perfil})`);
  }
}

seed()
  .then(() => {
    console.log('Seed finalizado.');
  })
  .catch((err) => {
    console.error('Erro ao executar seed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
