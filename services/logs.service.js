const { dbQuery } = require('../db/pool');

/**
 * Registra uma entrada no log do sistema.
 * Operação não-bloqueante — erros de log nunca afetam a requisição principal.
 */
function registrarLog({ req, usuario, acao, entidade = null, entidadeId = null, descricao = null }) {
  const u = usuario || req?.user;
  const ip = (req?.headers?.['x-forwarded-for'] || req?.ip || '')
    .split(',')[0].trim().slice(0, 45) || null;
  const ua = (req?.headers?.['user-agent'] || '').slice(0, 300) || null;

  dbQuery(
    `INSERT INTO logs_sistema
       (usuario_id, usuario_nome, usuario_login, acao, entidade, entidade_id, descricao, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      u?.id    ?? null,
      u?.nome  ?? null,
      u?.usuario ?? null,
      acao,
      entidade,
      entidadeId ?? null,
      descricao,
      ip,
      ua
    ]
  ).catch(err => console.error('[log]', err.message));
}

module.exports = { registrarLog };
