require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool, dbQuery } = require('./pool');

async function main() {
  const senha = process.env.ADMIN_PASSWORD || (() => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    const gerada = Array.from(crypto.randomBytes(14)).map((b) => chars[b % chars.length]).join('');
    console.log('⚠️  ADMIN_PASSWORD não definida. Senha gerada:');
    console.log(`➜  ${gerada}  (anote agora, não será exibida novamente)`);
    return gerada;
  })();

  const senhaHash = await bcrypt.hash(senha, 10);

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
