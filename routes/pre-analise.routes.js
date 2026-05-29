const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { erro, textoObrigatorio, inteiroObrigatorio } = require('./helpers');

const router = express.Router();

router.get('/projetos/:projetoId/pre-analise', async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const result = await dbQuery(
      `SELECT pa.*, u.nome AS criado_por_nome
       FROM pre_analise pa
       LEFT JOIN usuarios u ON u.id = pa.criado_por
       WHERE pa.projeto_id = $1
       ORDER BY pa.criado_em DESC`,
      [projetoId]
    );
    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/projetos/:projetoId/pre-analise', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const titulo = textoObrigatorio(req.body.titulo, 'Título');
    const conteudo = textoObrigatorio(req.body.conteudo, 'Conteúdo');

    const result = await dbQuery(
      `INSERT INTO pre_analise (projeto_id, titulo, conteudo, criado_por)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [projetoId, titulo, conteudo, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Relatório criado com sucesso.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/pre-analise/:id', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Relatório');
    const titulo = textoObrigatorio(req.body.titulo, 'Título');
    const conteudo = textoObrigatorio(req.body.conteudo, 'Conteúdo');

    const result = await dbQuery(
      `UPDATE pre_analise SET titulo = $1, conteudo = $2 WHERE id = $3 RETURNING *`,
      [titulo, conteudo, id]
    );

    if (!result.rows[0]) throw erro(404, 'Relatório não encontrado.');

    res.ok(result.rows[0], 'Relatório atualizado com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.delete('/pre-analise/:id', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Relatório');
    const result = await dbQuery('DELETE FROM pre_analise WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw erro(404, 'Relatório não encontrado.');
    res.ok(null, 'Relatório excluído com sucesso.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
