const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { erro, textoObrigatorio, textoOpcional, inteiroObrigatorio, validarEnum } = require('./helpers');

const FONTE_TIPOS = ['URL', 'DOCUMENTO', 'PLANILHA', 'SISTEMA', 'CONTATO', 'OUTRO'];

const router = express.Router();

router.get('/projetos/:projetoId/fontes', async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const result = await dbQuery(
      `SELECT f.*, u.nome AS criado_por_nome
       FROM fontes_projeto f
       LEFT JOIN usuarios u ON u.id = f.criado_por
       WHERE f.projeto_id = $1
       ORDER BY f.tipo, f.titulo`,
      [projetoId]
    );
    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/projetos/:projetoId/fontes', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const titulo    = textoObrigatorio(req.body.titulo, 'Título');
    const descricao = textoOpcional(req.body.descricao);
    const link      = textoOpcional(req.body.link);
    const tipo      = textoObrigatorio(req.body.tipo || 'OUTRO', 'Tipo');
    validarEnum(tipo, FONTE_TIPOS, 'Tipo');

    const result = await dbQuery(
      `INSERT INTO fontes_projeto (projeto_id, titulo, descricao, link, tipo, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [projetoId, titulo, descricao, link, tipo, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Fonte adicionada com sucesso.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/fontes-projeto/:id', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const id        = inteiroObrigatorio(req.params.id, 'Fonte');
    const titulo    = textoObrigatorio(req.body.titulo, 'Título');
    const descricao = textoOpcional(req.body.descricao);
    const link      = textoOpcional(req.body.link);
    const tipo      = textoObrigatorio(req.body.tipo || 'OUTRO', 'Tipo');
    validarEnum(tipo, FONTE_TIPOS, 'Tipo');

    const result = await dbQuery(
      `UPDATE fontes_projeto SET titulo=$1, descricao=$2, link=$3, tipo=$4 WHERE id=$5 RETURNING *`,
      [titulo, descricao, link, tipo, id]
    );
    if (!result.rows[0]) throw erro(404, 'Fonte não encontrada.');
    res.ok(result.rows[0], 'Fonte atualizada com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.delete('/fontes-projeto/:id', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Fonte');
    const result = await dbQuery('DELETE FROM fontes_projeto WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw erro(404, 'Fonte não encontrada.');
    res.ok(null, 'Fonte removida com sucesso.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
