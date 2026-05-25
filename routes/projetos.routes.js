const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { registrarHistorico, registrarAlteracoes } = require('../services/historico.service');
const {
  PROJETO_STATUS,
  PRIORIDADES,
  erro,
  validarEnum,
  textoObrigatorio,
  textoOpcional,
  dataOpcional,
  inteiroOpcional,
  inteiroObrigatorio
} = require('./helpers');

const router = express.Router();

async function buscarProjetoDetalhado(id) {
  const result = await dbQuery(
    `SELECT
       p.*,
       responsavel.nome AS responsavel_nome,
       criador.nome AS criado_por_nome,
       COUNT(m.id)::INT AS total_modulos,
       COUNT(m.id) FILTER (WHERE m.status = 'CONCLUIDO')::INT AS modulos_concluidos,
       CASE
         WHEN COUNT(m.id) = 0 THEN 0
         ELSE ROUND((COUNT(m.id) FILTER (WHERE m.status = 'CONCLUIDO')::NUMERIC / COUNT(m.id)::NUMERIC) * 100)
       END::INT AS progresso
     FROM projetos p
     LEFT JOIN usuarios responsavel ON responsavel.id = p.responsavel_id
     LEFT JOIN usuarios criador ON criador.id = p.criado_por
     LEFT JOIN modulos m ON m.projeto_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, responsavel.nome, criador.nome`,
    [id]
  );

  return result.rows[0];
}

router.get('/', async (req, res, next) => {
  try {
    const filtros = [];
    const params = [];

    if (req.query.status) {
      validarEnum(req.query.status, PROJETO_STATUS, 'Status');
      params.push(req.query.status);
      filtros.push(`p.status = $${params.length}`);
    }

    if (req.query.prioridade) {
      validarEnum(req.query.prioridade, PRIORIDADES, 'Prioridade');
      params.push(req.query.prioridade);
      filtros.push(`p.prioridade = $${params.length}`);
    }

    if (req.query.busca) {
      params.push(`%${String(req.query.busca).trim()}%`);
      filtros.push(`p.nome ILIKE $${params.length}`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

    const result = await dbQuery(
      `SELECT
         p.*,
         responsavel.nome AS responsavel_nome,
         criador.nome AS criado_por_nome,
         COUNT(m.id)::INT AS total_modulos,
         COUNT(m.id) FILTER (WHERE m.status = 'CONCLUIDO')::INT AS modulos_concluidos,
         CASE
           WHEN COUNT(m.id) = 0 THEN 0
           ELSE ROUND((COUNT(m.id) FILTER (WHERE m.status = 'CONCLUIDO')::NUMERIC / COUNT(m.id)::NUMERIC) * 100)
         END::INT AS progresso
       FROM projetos p
       LEFT JOIN usuarios responsavel ON responsavel.id = p.responsavel_id
       LEFT JOIN usuarios criador ON criador.id = p.criado_por
       LEFT JOIN modulos m ON m.projeto_id = p.id
       ${where}
       GROUP BY p.id, responsavel.nome, criador.nome
       ORDER BY p.criado_em DESC`,
      params
    );

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/resumo', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Projeto');
    const projeto = await buscarProjetoDetalhado(id);

    if (!projeto) {
      throw erro(404, 'Projeto não encontrado.');
    }

    res.ok(projeto);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Projeto');
    const projeto = await buscarProjetoDetalhado(id);

    if (!projeto) {
      throw erro(404, 'Projeto não encontrado.');
    }

    res.ok(projeto);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const nome = textoObrigatorio(req.body.nome, 'Nome');
    const status = req.body.status || 'PLANEJADO';
    const prioridade = req.body.prioridade || 'MEDIA';

    validarEnum(status, PROJETO_STATUS, 'Status');
    validarEnum(prioridade, PRIORIDADES, 'Prioridade');

    const result = await dbQuery(
      `INSERT INTO projetos
        (nome, descricao, data_inicio, data_fim_prevista, data_conclusao, status, prioridade, responsavel_id, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        nome,
        textoOpcional(req.body.descricao),
        dataOpcional(req.body.data_inicio, 'Data de início'),
        dataOpcional(req.body.data_fim_prevista, 'Data fim prevista'),
        dataOpcional(req.body.data_conclusao, 'Data de conclusão'),
        status,
        prioridade,
        inteiroOpcional(req.body.responsavel_id, 'Responsável'),
        req.user.id
      ]
    );

    const projeto = result.rows[0];

    await registrarHistorico({
      entidade: 'PROJETO',
      entidadeId: projeto.id,
      acao: 'CRIACAO_PROJETO',
      usuarioId: req.user.id,
      descricao: `${req.user.nome} criou o projeto ${projeto.nome}.`
    });

    res.status(201).json({
      success: true,
      message: 'Projeto criado com sucesso.',
      data: projeto
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Projeto');
    const antigo = await buscarProjetoDetalhado(id);

    if (!antigo) {
      throw erro(404, 'Projeto não encontrado.');
    }

    const dados = {
      nome: req.body.nome !== undefined ? textoObrigatorio(req.body.nome, 'Nome') : antigo.nome,
      descricao: req.body.descricao !== undefined ? textoOpcional(req.body.descricao) : antigo.descricao,
      data_inicio: req.body.data_inicio !== undefined ? dataOpcional(req.body.data_inicio, 'Data de início') : antigo.data_inicio,
      data_fim_prevista: req.body.data_fim_prevista !== undefined ? dataOpcional(req.body.data_fim_prevista, 'Data fim prevista') : antigo.data_fim_prevista,
      data_conclusao: req.body.data_conclusao !== undefined ? dataOpcional(req.body.data_conclusao, 'Data de conclusão') : antigo.data_conclusao,
      status: req.body.status !== undefined ? req.body.status : antigo.status,
      prioridade: req.body.prioridade !== undefined ? req.body.prioridade : antigo.prioridade,
      responsavel_id: req.body.responsavel_id !== undefined ? inteiroOpcional(req.body.responsavel_id, 'Responsável') : antigo.responsavel_id
    };

    validarEnum(dados.status, PROJETO_STATUS, 'Status');
    validarEnum(dados.prioridade, PRIORIDADES, 'Prioridade');

    const result = await dbQuery(
      `UPDATE projetos
       SET nome = $1,
           descricao = $2,
           data_inicio = $3,
           data_fim_prevista = $4,
           data_conclusao = $5,
           status = $6,
           prioridade = $7,
           responsavel_id = $8
       WHERE id = $9
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
        id
      ]
    );

    const atualizado = result.rows[0];

    await registrarAlteracoes({
      entidade: 'PROJETO',
      entidadeId: id,
      acao: 'EDICAO_PROJETO',
      antigo,
      novo: atualizado,
      usuarioId: req.user.id,
      descricaoBase: `${req.user.nome} editou o projeto ${atualizado.nome}`,
      campos: [
        'nome',
        'descricao',
        'data_inicio',
        'data_fim_prevista',
        'data_conclusao',
        'status',
        'prioridade',
        'responsavel_id'
      ]
    });

    res.ok(atualizado, 'Projeto atualizado com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Projeto');
    const projeto = await buscarProjetoDetalhado(id);

    if (!projeto) {
      throw erro(404, 'Projeto não encontrado.');
    }

    await registrarHistorico({
      entidade: 'PROJETO',
      entidadeId: id,
      acao: 'EXCLUSAO_PROJETO',
      usuarioId: req.user.id,
      descricao: `${req.user.nome} excluiu o projeto ${projeto.nome}.`
    });

    await dbQuery('DELETE FROM projetos WHERE id = $1', [id]);

    res.ok(null, 'Projeto excluído com sucesso.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
