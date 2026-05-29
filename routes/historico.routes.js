const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { inteiroObrigatorio } = require('./helpers');

const router = express.Router();

router.use(requireRole('DESENVOLVEDOR', 'ADMIN'));

async function listarHistorico({ entidade = null, entidadeId = null, limit = 100 }) {
  const filtros = [];
  const params = [];

  if (entidade) {
    params.push(entidade);
    filtros.push(`h.entidade = $${params.length}`);
  }

  if (entidadeId) {
    params.push(entidadeId);
    filtros.push(`h.entidade_id = $${params.length}`);
  }

  params.push(Math.min(Number(limit) || 100, 200));

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  return dbQuery(
    `SELECT
       h.*,
       u.nome AS usuario_nome,
       u.usuario AS usuario_login
     FROM historico_alteracoes h
     LEFT JOIN usuarios u ON u.id = h.usuario_id
     ${where}
     ORDER BY h.criado_em DESC
     LIMIT $${params.length}`,
    params
  );
}

router.get('/historico', async (req, res, next) => {
  try {
    const result = await listarHistorico({
      entidade: req.query.entidade || null,
      entidadeId: req.query.entidade_id || null,
      limit: req.query.limit
    });

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/projetos/:id/historico', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Projeto');
    const result = await listarHistorico({ entidade: 'PROJETO', entidadeId: id });

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/modulos/:id/historico', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Módulo');
    const result = await listarHistorico({ entidade: 'MODULO', entidadeId: id });

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/ideias/:id/historico', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Ideia');
    const result = await listarHistorico({ entidade: 'IDEIA', entidadeId: id });

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
