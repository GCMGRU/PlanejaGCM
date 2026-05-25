const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { registrarHistorico, registrarAlteracoes } = require('../services/historico.service');
const {
  MODULO_STATUS,
  PRIORIDADES,
  erro,
  validarEnum,
  textoObrigatorio,
  textoOpcional,
  dataOpcional,
  inteiroOpcional,
  inteiroObrigatorio,
  hojeISO
} = require('./helpers');

const router = express.Router();

async function buscarModulo(id) {
  const result = await dbQuery(
    `SELECT
       m.*,
       p.nome AS projeto_nome,
       responsavel.nome AS responsavel_nome,
       criador.nome AS criado_por_nome,
       (m.data_fim_prevista < CURRENT_DATE AND m.status NOT IN ('CONCLUIDO', 'CANCELADO')) AS atrasado
     FROM modulos m
     INNER JOIN projetos p ON p.id = m.projeto_id
     LEFT JOIN usuarios responsavel ON responsavel.id = m.responsavel_id
     LEFT JOIN usuarios criador ON criador.id = m.criado_por
     WHERE m.id = $1`,
    [id]
  );

  return result.rows[0];
}

router.get('/projetos/:projetoId/modulos', async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const result = await dbQuery(
      `SELECT
         m.*,
         responsavel.nome AS responsavel_nome,
         criador.nome AS criado_por_nome,
         (m.data_fim_prevista < CURRENT_DATE AND m.status NOT IN ('CONCLUIDO', 'CANCELADO')) AS atrasado
       FROM modulos m
       LEFT JOIN usuarios responsavel ON responsavel.id = m.responsavel_id
       LEFT JOIN usuarios criador ON criador.id = m.criado_por
       WHERE m.projeto_id = $1
       ORDER BY
         CASE WHEN m.status = 'CONCLUIDO' THEN 1 ELSE 0 END,
         m.data_fim_prevista ASC NULLS LAST,
         m.criado_em DESC`,
      [projetoId]
    );

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/modulos/:id', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Módulo');
    const modulo = await buscarModulo(id);

    if (!modulo) {
      throw erro(404, 'Módulo não encontrado.');
    }

    res.ok(modulo);
  } catch (err) {
    next(err);
  }
});

router.post('/projetos/:projetoId/modulos', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const projetoId = inteiroObrigatorio(req.params.projetoId, 'Projeto');
    const nome = textoObrigatorio(req.body.nome, 'Nome');
    const status = req.body.status || 'NAO_INICIADO';
    const prioridade = req.body.prioridade || 'MEDIA';

    validarEnum(status, MODULO_STATUS, 'Status');
    validarEnum(prioridade, PRIORIDADES, 'Prioridade');

    let dataConclusao = dataOpcional(req.body.data_conclusao, 'Data de conclusão');

    if (status === 'CONCLUIDO' && !dataConclusao) {
      dataConclusao = hojeISO();
    }

    const result = await dbQuery(
      `INSERT INTO modulos
        (projeto_id, nome, descricao, data_inicio, data_fim_prevista, data_conclusao, status, prioridade, responsavel_id, observacoes, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        projetoId,
        nome,
        textoOpcional(req.body.descricao),
        dataOpcional(req.body.data_inicio, 'Data de início'),
        dataOpcional(req.body.data_fim_prevista, 'Data fim prevista'),
        dataConclusao,
        status,
        prioridade,
        inteiroOpcional(req.body.responsavel_id, 'Responsável'),
        textoOpcional(req.body.observacoes),
        req.user.id
      ]
    );

    const modulo = result.rows[0];

    await registrarHistorico({
      entidade: 'MODULO',
      entidadeId: modulo.id,
      acao: 'CRIACAO_MODULO',
      usuarioId: req.user.id,
      descricao: `${req.user.nome} criou o módulo ${modulo.nome}.`
    });

    res.status(201).json({
      success: true,
      message: 'Módulo criado com sucesso.',
      data: modulo
    });
  } catch (err) {
    next(err);
  }
});

router.put('/modulos/:id', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Módulo');
    const antigo = await buscarModulo(id);

    if (!antigo) {
      throw erro(404, 'Módulo não encontrado.');
    }

    const status = req.body.status !== undefined ? req.body.status : antigo.status;
    const prioridade = req.body.prioridade !== undefined ? req.body.prioridade : antigo.prioridade;

    validarEnum(status, MODULO_STATUS, 'Status');
    validarEnum(prioridade, PRIORIDADES, 'Prioridade');

    let dataConclusao = req.body.data_conclusao !== undefined
      ? dataOpcional(req.body.data_conclusao, 'Data de conclusão')
      : antigo.data_conclusao;

    if (status === 'CONCLUIDO' && !dataConclusao) {
      dataConclusao = hojeISO();
    }

    if (status !== 'CONCLUIDO' && antigo.status === 'CONCLUIDO' && req.body.data_conclusao === undefined) {
      dataConclusao = null;
    }

    const dados = {
      nome: req.body.nome !== undefined ? textoObrigatorio(req.body.nome, 'Nome') : antigo.nome,
      descricao: req.body.descricao !== undefined ? textoOpcional(req.body.descricao) : antigo.descricao,
      data_inicio: req.body.data_inicio !== undefined ? dataOpcional(req.body.data_inicio, 'Data de início') : antigo.data_inicio,
      data_fim_prevista: req.body.data_fim_prevista !== undefined ? dataOpcional(req.body.data_fim_prevista, 'Data fim prevista') : antigo.data_fim_prevista,
      data_conclusao: dataConclusao,
      status,
      prioridade,
      responsavel_id: req.body.responsavel_id !== undefined ? inteiroOpcional(req.body.responsavel_id, 'Responsável') : antigo.responsavel_id,
      observacoes: req.body.observacoes !== undefined ? textoOpcional(req.body.observacoes) : antigo.observacoes
    };

    const result = await dbQuery(
      `UPDATE modulos
       SET nome = $1,
           descricao = $2,
           data_inicio = $3,
           data_fim_prevista = $4,
           data_conclusao = $5,
           status = $6,
           prioridade = $7,
           responsavel_id = $8,
           observacoes = $9
       WHERE id = $10
       RETURNING *`,
      [
        dados.nome,
        dados.descricao,
        dados.data_inicio,
        dados.data_fim_prevista,
        dados.data_conclusao,
        dados.status,
        dados.prioridade,
        dados.responsavel_id,
        dados.observacoes,
        id
      ]
    );

    const atualizado = result.rows[0];

    await registrarAlteracoes({
      entidade: 'MODULO',
      entidadeId: id,
      acao: 'EDICAO_MODULO',
      antigo,
      novo: atualizado,
      usuarioId: req.user.id,
      descricaoBase: `${req.user.nome} editou o módulo ${atualizado.nome}`,
      campos: [
        'nome',
        'descricao',
        'data_inicio',
        'data_fim_prevista',
        'data_conclusao',
        'status',
        'prioridade',
        'responsavel_id',
        'observacoes'
      ]
    });

    res.ok(atualizado, 'Módulo atualizado com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.delete('/modulos/:id', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Módulo');
    const modulo = await buscarModulo(id);

    if (!modulo) {
      throw erro(404, 'Módulo não encontrado.');
    }

    await registrarHistorico({
      entidade: 'MODULO',
      entidadeId: id,
      acao: 'EXCLUSAO_MODULO',
      usuarioId: req.user.id,
      descricao: `${req.user.nome} excluiu o módulo ${modulo.nome}.`
    });

    await dbQuery('DELETE FROM modulos WHERE id = $1', [id]);

    res.ok(null, 'Módulo excluído com sucesso.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
