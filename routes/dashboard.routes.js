const express = require('express');
const { dbQuery } = require('../db/pool');

const router = express.Router();

async function count(query, params = []) {
  const result = await dbQuery(query, params);
  return Number(result.rows[0].total);
}

async function contarIdeiasPorStatus(status, usuario) {
  if (usuario.perfil === 'SUPERVISOR') {
    return count(
      `SELECT COUNT(*)::INT AS total
       FROM ideias
       WHERE status = $1 AND criado_por = $2`,
      [status, usuario.id]
    );
  }

  return count(
    `SELECT COUNT(*)::INT AS total
     FROM ideias
     WHERE status = $1`,
    [status]
  );
}

router.get('/', async (req, res, next) => {
  try {
    const totalProjetos = await count('SELECT COUNT(*)::INT AS total FROM projetos');
    const projetosEmAndamento = await count(
      `SELECT COUNT(*)::INT AS total
       FROM projetos
       WHERE status IN ('PLANEJADO', 'EM_DESENVOLVIMENTO', 'EM_TESTE', 'PAUSADO')`
    );
    const projetosConcluidos = await count(
      `SELECT COUNT(*)::INT AS total
       FROM projetos
       WHERE status = 'CONCLUIDO'`
    );
    const totalModulos = await count('SELECT COUNT(*)::INT AS total FROM modulos');
    const modulosPendentes = await count(
      `SELECT COUNT(*)::INT AS total
       FROM modulos
       WHERE status NOT IN ('CONCLUIDO', 'CANCELADO')`
    );
    const modulosConcluidos = await count(
      `SELECT COUNT(*)::INT AS total
       FROM modulos
       WHERE status = 'CONCLUIDO'`
    );
    const modulosAtrasados = await count(
      `SELECT COUNT(*)::INT AS total
       FROM modulos
       WHERE data_fim_prevista < CURRENT_DATE
         AND status NOT IN ('CONCLUIDO', 'CANCELADO')`
    );
    const ideiasNovas = await contarIdeiasPorStatus('NOVA', req.user);
    const ideiasEmAnalise = await contarIdeiasPorStatus('EM_ANALISE', req.user);

    const proximosPrazos = await dbQuery(
      `SELECT
         m.id,
         m.nome,
         m.status,
         m.prioridade,
         m.data_fim_prevista,
         p.id AS projeto_id,
         p.nome AS projeto_nome,
         u.nome AS responsavel_nome
       FROM modulos m
       INNER JOIN projetos p ON p.id = m.projeto_id
       LEFT JOIN usuarios u ON u.id = m.responsavel_id
       WHERE m.data_fim_prevista BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
         AND m.status NOT IN ('CONCLUIDO', 'CANCELADO')
       ORDER BY m.data_fim_prevista ASC
       LIMIT 8`
    );

    const modulosAtrasadosLista = await dbQuery(
      `SELECT
         m.id,
         m.nome,
         m.status,
         m.prioridade,
         m.data_fim_prevista,
         p.id AS projeto_id,
         p.nome AS projeto_nome,
         u.nome AS responsavel_nome
       FROM modulos m
       INNER JOIN projetos p ON p.id = m.projeto_id
       LEFT JOIN usuarios u ON u.id = m.responsavel_id
       WHERE m.data_fim_prevista < CURRENT_DATE
         AND m.status NOT IN ('CONCLUIDO', 'CANCELADO')
       ORDER BY m.data_fim_prevista ASC
       LIMIT 8`
    );

    const ultimosProjetos = await dbQuery(
      `SELECT
         p.id,
         p.nome,
         p.status,
         p.prioridade,
         p.criado_em,
         u.nome AS responsavel_nome
       FROM projetos p
       LEFT JOIN usuarios u ON u.id = p.responsavel_id
       ORDER BY p.criado_em DESC
       LIMIT 6`
    );

    const ultimasIdeiasParams = [];
    const ultimasIdeiasWhere = req.user.perfil === 'SUPERVISOR'
      ? 'WHERE i.criado_por = $1'
      : '';

    if (req.user.perfil === 'SUPERVISOR') {
      ultimasIdeiasParams.push(req.user.id);
    }

    const ultimasIdeias = await dbQuery(
      `SELECT
         i.id,
         i.titulo,
         i.status,
         i.prioridade,
         i.criado_em,
         p.nome AS projeto_nome,
         u.nome AS criado_por_nome
       FROM ideias i
       LEFT JOIN projetos p ON p.id = i.projeto_id
       LEFT JOIN usuarios u ON u.id = i.criado_por
       ${ultimasIdeiasWhere}
       ORDER BY i.criado_em DESC
       LIMIT 6`,
      ultimasIdeiasParams
    );

    res.ok({
      totalProjetos,
      projetosEmAndamento,
      projetosConcluidos,
      totalModulos,
      modulosPendentes,
      modulosConcluidos,
      modulosAtrasados,
      ideiasNovas,
      ideiasEmAnalise,
      proximosPrazos: proximosPrazos.rows,
      modulosAtrasadosLista: modulosAtrasadosLista.rows,
      ultimosProjetos: ultimosProjetos.rows,
      ultimasIdeias: ultimasIdeias.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
