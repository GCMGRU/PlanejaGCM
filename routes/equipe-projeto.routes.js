const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { erro, textoObrigatorio, inteiroObrigatorio } = require('./helpers');

const router = express.Router();

async function buscarEquipe(projetoId) {
  const result = await dbQuery(
    `SELECT ep.*, u.nome AS usuario_nome, u.perfil AS usuario_perfil
     FROM equipe_projeto ep
     JOIN usuarios u ON u.id = ep.usuario_id
     WHERE ep.projeto_id = $1
     ORDER BY u.nome`,
    [projetoId]
  );
  return result.rows;
}

router.get('/projetos/:projetoId/equipe', async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    res.ok(await buscarEquipe(projetoId));
  } catch (err) {
    next(err);
  }
});

// Adicionar um membro (usado no detalhe do projeto)
router.post('/projetos/:projetoId/equipe', requireRole('DESENVOLVEDOR', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const usuario_id = inteiroObrigatorio(req.body.usuario_id, 'Usuário');
    const funcao = textoObrigatorio(req.body.funcao, 'Função');

    const result = await dbQuery(
      `INSERT INTO equipe_projeto (projeto_id, usuario_id, funcao)
       VALUES ($1, $2, $3)
       ON CONFLICT (projeto_id, usuario_id) DO UPDATE SET funcao = EXCLUDED.funcao
       RETURNING *`,
      [projetoId, usuario_id, funcao]
    );
    res.status(201).json({ success: true, message: 'Membro adicionado à equipe.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Substituir toda a equipe (usado ao salvar o formulário de projeto)
router.put('/projetos/:projetoId/equipe', requireRole('DESENVOLVEDOR', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const equipe = req.body.equipe;

    if (!Array.isArray(equipe)) throw erro(400, 'Campo "equipe" deve ser um array.');

    await dbQuery('DELETE FROM equipe_projeto WHERE projeto_id = $1', [projetoId]);

    for (const membro of equipe) {
      const usuario_id = inteiroObrigatorio(membro.usuario_id, 'Usuário');
      const funcao = textoObrigatorio(membro.funcao, 'Função');
      await dbQuery(
        `INSERT INTO equipe_projeto (projeto_id, usuario_id, funcao) VALUES ($1, $2, $3)`,
        [projetoId, usuario_id, funcao]
      );
    }

    res.ok(await buscarEquipe(projetoId), 'Equipe atualizada.');
  } catch (err) {
    next(err);
  }
});

// Atualizar a função de um membro (edição inline no detalhe)
router.put('/equipe/:id', requireRole('DESENVOLVEDOR', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Membro');
    const funcao = textoObrigatorio(req.body.funcao, 'Função');

    const result = await dbQuery(
      `UPDATE equipe_projeto SET funcao = $1 WHERE id = $2 RETURNING *`,
      [funcao, id]
    );
    if (!result.rows[0]) throw erro(404, 'Membro não encontrado.');
    res.ok(result.rows[0], 'Função atualizada.');
  } catch (err) {
    next(err);
  }
});

// Remover um membro
router.delete('/equipe/:id', requireRole('DESENVOLVEDOR', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Membro');
    const result = await dbQuery('DELETE FROM equipe_projeto WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw erro(404, 'Membro não encontrado.');
    res.ok(null, 'Membro removido da equipe.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
