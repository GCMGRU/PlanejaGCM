const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { registrarHistorico, registrarAlteracoes } = require('../services/historico.service');
const {
  IDEIA_STATUS,
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

async function buscarIdeia(id) {
  const result = await dbQuery(
    `SELECT
       i.*,
       p.nome AS projeto_nome,
       m.nome AS modulo_nome,
       criador.nome AS criado_por_nome,
       respondente.nome AS respondido_por_nome
     FROM ideias i
     LEFT JOIN projetos p ON p.id = i.projeto_id
     LEFT JOIN modulos m ON m.id = i.modulo_id
     LEFT JOIN usuarios criador ON criador.id = i.criado_por
     LEFT JOIN usuarios respondente ON respondente.id = i.respondido_por
     WHERE i.id = $1`,
    [id]
  );

  return result.rows[0];
}

function validarAcessoSupervisor(req, ideia) {
  if (req.user.perfil === 'SUPERVISOR' && ideia.criado_por !== req.user.id) {
    throw erro(403, 'Você só pode visualizar as suas próprias ideias.');
  }
}

router.get('/', async (req, res, next) => {
  try {
    const filtros = [];
    const params = [];

    if (req.user.perfil === 'SUPERVISOR') {
      params.push(req.user.id);
      filtros.push(`i.criado_por = $${params.length}`);
    }

    if (req.query.status) {
      validarEnum(req.query.status, IDEIA_STATUS, 'Status');
      params.push(req.query.status);
      filtros.push(`i.status = $${params.length}`);
    }

    if (req.query.projeto_id) {
      params.push(inteiroObrigatorio(req.query.projeto_id, 'Projeto'));
      filtros.push(`i.projeto_id = $${params.length}`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

    const result = await dbQuery(
      `SELECT
         i.*,
         p.nome AS projeto_nome,
         m.nome AS modulo_nome,
         criador.nome AS criado_por_nome,
         respondente.nome AS respondido_por_nome
       FROM ideias i
       LEFT JOIN projetos p ON p.id = i.projeto_id
       LEFT JOIN modulos m ON m.id = i.modulo_id
       LEFT JOIN usuarios criador ON criador.id = i.criado_por
       LEFT JOIN usuarios respondente ON respondente.id = i.respondido_por
       ${where}
       ORDER BY i.criado_em DESC`,
      params
    );

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Ideia');
    const ideia = await buscarIdeia(id);

    if (!ideia) {
      throw erro(404, 'Ideia não encontrada.');
    }

    validarAcessoSupervisor(req, ideia);
    res.ok(ideia);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const titulo = textoObrigatorio(req.body.titulo, 'Título');
    const descricao = textoObrigatorio(req.body.descricao, 'Descrição');
    const prioridade = req.body.prioridade || 'MEDIA';
    const status = req.user.perfil === 'DESENVOLVEDOR'
      ? (req.body.status || 'NOVA')
      : 'NOVA';

    validarEnum(prioridade, PRIORIDADES, 'Prioridade');
    validarEnum(status, IDEIA_STATUS, 'Status');

    const result = await dbQuery(
      `INSERT INTO ideias
        (titulo, descricao, projeto_id, modulo_id, prioridade, status, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        titulo,
        descricao,
        inteiroOpcional(req.body.projeto_id, 'Projeto'),
        inteiroOpcional(req.body.modulo_id, 'Módulo'),
        prioridade,
        status,
        req.user.id
      ]
    );

    const ideia = result.rows[0];

    await registrarHistorico({
      entidade: 'IDEIA',
      entidadeId: ideia.id,
      acao: 'CRIACAO_IDEIA',
      usuarioId: req.user.id,
      descricao: `${req.user.nome} criou a ideia ${ideia.titulo}.`
    });

    res.status(201).json({
      success: true,
      message: 'Ideia criada com sucesso.',
      data: ideia
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/responder', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Ideia');
    const ideia = await buscarIdeia(id);

    if (!ideia) {
      throw erro(404, 'Ideia não encontrada.');
    }

    const resposta = textoObrigatorio(req.body.resposta_dev, 'Resposta');
    const result = await dbQuery(
      `UPDATE ideias
       SET resposta_dev = $1,
           respondido_por = $2,
           respondido_em = NOW()
       WHERE id = $3
       RETURNING *`,
      [resposta, req.user.id, id]
    );

    await registrarHistorico({
      entidade: 'IDEIA',
      entidadeId: id,
      acao: 'RESPOSTA_IDEIA',
      campoAlterado: 'resposta_dev',
      valorAntigo: ideia.resposta_dev,
      valorNovo: resposta,
      usuarioId: req.user.id,
      descricao: `${req.user.nome} respondeu a ideia ${ideia.titulo}.`
    });

    res.ok(result.rows[0], 'Ideia respondida com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Ideia');
    const ideia = await buscarIdeia(id);

    if (!ideia) {
      throw erro(404, 'Ideia não encontrada.');
    }

    const status = textoObrigatorio(req.body.status, 'Status');
    validarEnum(status, IDEIA_STATUS, 'Status');

    const result = await dbQuery(
      `UPDATE ideias
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    await registrarHistorico({
      entidade: 'IDEIA',
      entidadeId: id,
      acao: 'ALTERACAO_STATUS_IDEIA',
      campoAlterado: 'status',
      valorAntigo: ideia.status,
      valorNovo: status,
      usuarioId: req.user.id,
      descricao: `${req.user.nome} alterou o status da ideia de ${ideia.status} para ${status}.`
    });

    res.ok(result.rows[0], 'Status da ideia atualizado.');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/transformar-em-modulo', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Ideia');
    const ideia = await buscarIdeia(id);

    if (!ideia) {
      throw erro(404, 'Ideia não encontrada.');
    }

    if (ideia.status === 'TRANSFORMADA_EM_MODULO' && ideia.modulo_id) {
      throw erro(400, 'Esta ideia já foi transformada em módulo.');
    }

    const projetoId = inteiroOpcional(req.body.projeto_id, 'Projeto') || ideia.projeto_id;

    if (!projetoId) {
      throw erro(400, 'Informe um projeto para transformar a ideia em módulo.');
    }

    const statusModulo = req.body.status || 'NAO_INICIADO';
    const prioridade = req.body.prioridade || ideia.prioridade || 'MEDIA';

    validarEnum(statusModulo, MODULO_STATUS, 'Status do módulo');
    validarEnum(prioridade, PRIORIDADES, 'Prioridade');

    let dataConclusao = dataOpcional(req.body.data_conclusao, 'Data de conclusão');

    if (statusModulo === 'CONCLUIDO' && !dataConclusao) {
      dataConclusao = hojeISO();
    }

    const moduloResult = await dbQuery(
      `INSERT INTO modulos
        (projeto_id, nome, descricao, data_inicio, data_fim_prevista, data_conclusao, status, prioridade, responsavel_id, observacoes, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        projetoId,
        textoOpcional(req.body.nome) || ideia.titulo,
        textoOpcional(req.body.descricao) || ideia.descricao,
        dataOpcional(req.body.data_inicio, 'Data de início'),
        dataOpcional(req.body.data_fim_prevista, 'Data fim prevista'),
        dataConclusao,
        statusModulo,
        prioridade,
        inteiroOpcional(req.body.responsavel_id, 'Responsável'),
        textoOpcional(req.body.observacoes),
        req.user.id
      ]
    );

    const modulo = moduloResult.rows[0];

    const ideiaResult = await dbQuery(
      `UPDATE ideias
       SET status = 'TRANSFORMADA_EM_MODULO',
           projeto_id = $1,
           modulo_id = $2
       WHERE id = $3
       RETURNING *`,
      [projetoId, modulo.id, id]
    );

    await registrarHistorico({
      entidade: 'MODULO',
      entidadeId: modulo.id,
      acao: 'CRIACAO_MODULO',
      usuarioId: req.user.id,
      descricao: `${req.user.nome} transformou a ideia ${ideia.titulo} no módulo ${modulo.nome}.`
    });

    await registrarHistorico({
      entidade: 'IDEIA',
      entidadeId: id,
      acao: 'ALTERACAO_STATUS_IDEIA',
      campoAlterado: 'status',
      valorAntigo: ideia.status,
      valorNovo: 'TRANSFORMADA_EM_MODULO',
      usuarioId: req.user.id,
      descricao: `${req.user.nome} transformou a ideia ${ideia.titulo} em módulo.`
    });

    res.status(201).json({
      success: true,
      message: 'Ideia transformada em módulo com sucesso.',
      data: {
        ideia: ideiaResult.rows[0],
        modulo
      }
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Ideia');
    const antigo = await buscarIdeia(id);

    if (!antigo) {
      throw erro(404, 'Ideia não encontrada.');
    }

    if (req.user.perfil === 'SUPERVISOR') {
      validarAcessoSupervisor(req, antigo);

      if (antigo.status !== 'NOVA') {
        throw erro(403, 'A ideia só pode ser editada enquanto estiver com status NOVA.');
      }
    }

    const prioridade = req.body.prioridade !== undefined ? req.body.prioridade : antigo.prioridade;
    validarEnum(prioridade, PRIORIDADES, 'Prioridade');

    const dados = {
      titulo: req.body.titulo !== undefined ? textoObrigatorio(req.body.titulo, 'Título') : antigo.titulo,
      descricao: req.body.descricao !== undefined ? textoObrigatorio(req.body.descricao, 'Descrição') : antigo.descricao,
      projeto_id: req.body.projeto_id !== undefined ? inteiroOpcional(req.body.projeto_id, 'Projeto') : antigo.projeto_id,
      modulo_id: req.body.modulo_id !== undefined ? inteiroOpcional(req.body.modulo_id, 'Módulo') : antigo.modulo_id,
      prioridade
    };

    const result = await dbQuery(
      `UPDATE ideias
       SET titulo = $1,
           descricao = $2,
           projeto_id = $3,
           modulo_id = $4,
           prioridade = $5
       WHERE id = $6
       RETURNING *`,
      [
        dados.titulo,
        dados.descricao,
        dados.projeto_id,
        dados.modulo_id,
        dados.prioridade,
        id
      ]
    );

    const atualizada = result.rows[0];

    await registrarAlteracoes({
      entidade: 'IDEIA',
      entidadeId: id,
      acao: 'EDICAO_IDEIA',
      antigo,
      novo: atualizada,
      usuarioId: req.user.id,
      descricaoBase: `${req.user.nome} editou a ideia ${atualizada.titulo}`,
      campos: [
        'titulo',
        'descricao',
        'projeto_id',
        'modulo_id',
        'prioridade'
      ]
    });

    res.ok(atualizada, 'Ideia atualizada com sucesso.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
