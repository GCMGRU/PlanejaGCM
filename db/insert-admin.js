require('dotenv').config();

const bcrypt = require('bcrypt');
const { pool, dbQuery } = require('./pool');

async function main() {
  const senhaHash = await bcrypt.hash('Admin@GCM76988', 10);

  await dbQuery(
    `INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo)
     VALUES ($1, $2, $3, 'ADMIN', TRUE)
     ON CONFLICT (usuario)
     DO UPDATE SET
       nome       = EXCLUDED.nome,
       senha_hash = EXCLUDED.senha_hash,
       perfil     = EXCLUDED.perfil,
       ativo      = TRUE,
       atualizado_em = NOW()`,
    ['admin', 'admin', senhaHash]
  );

  console.log('Usuário admin inserido/atualizado com sucesso.');
}

main()
  .catch((err) => {
    console.error('Erro:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
