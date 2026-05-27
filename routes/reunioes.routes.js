const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const {
  erro,
  textoObrigatorio,
  textoOpcional,
  dataOpcional,
  inteiroOpcional,
  inteiroObrigatorio,
  validarEnum
} = require('./helpers');

const REUNIAO_STATUS = ['AGENDADA', 'CANCELADA', 'REAGENDADA', 'CONCLUIDA'];

const router = express.Router();

const SELECT_REUNIAO = `
  SELECT r.*,
    p.nome  AS projeto_nome,
    m.nome  AS modulo_nome,
    i.titulo AS ideia_titulo,
    u.nome  AS criado_por_nome
  FROM reunioes r
  LEFT JOIN projetos  p ON p.id = r.projeto_id
  LEFT JOIN modulos   m ON m.id = r.modulo_id
  LEFT JOIN ideias    i ON i.id = r.ideia_id
  LEFT JOIN usuarios  u ON u.id = r.criado_por
`;

router.get('/', async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`r.status = $${params.length}`);
    }

    if (req.query.projeto_id) {
      params.push(Number(req.query.projeto_id));
      conditions.push(`r.projeto_id = $${params.length}`);
    }

    if (req.query.mes) {
      params.push(req.query.mes);
      conditions.push(`TO_CHAR(r.data_reuniao, 'YYYY-MM') = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await dbQuery(
      `${SELECT_REUNIAO} ${where} ORDER BY r.data_reuniao ASC, r.horario ASC`,
      params
    );
    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Reunião');
    const result = await dbQuery(`${SELECT_REUNIAO} WHERE r.id = $1`, [id]);
    if (!result.rows[0]) throw erro(404, 'Reunião não encontrada.');
    res.ok(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const titulo    = textoObrigatorio(req.body.titulo, 'Título');
    const setor     = textoObrigatorio(req.body.setor, 'Setor');
    const assunto   = textoObrigatorio(req.body.assunto, 'Assunto');
    const dataReu   = textoObrigatorio(req.body.data_reuniao, 'Data');
    const horario   = textoObrigatorio(req.body.horario, 'Horário');
    const projetoId = inteiroOpcional(req.body.projeto_id, 'Projeto');
    const moduloId  = inteiroOpcional(req.body.modulo_id, 'Módulo');
    const ideiaId   = inteiroOpcional(req.body.ideia_id, 'Ideia');

    const result = await dbQuery(
      `INSERT INTO reunioes (titulo, setor, assunto, data_reuniao, horario, projeto_id, modulo_id, ideia_id, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [titulo, setor, assunto, dataReu, horario, projetoId, moduloId, ideiaId, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Reunião agendada com sucesso.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Reunião');

    const atual = await dbQuery('SELECT * FROM reunioes WHERE id = $1', [id]);
    if (!atual.rows[0]) throw erro(404, 'Reunião não encontrada.');

    const r = atual.rows[0];
    const titulo    = req.body.titulo    !== undefined ? textoObrigatorio(req.body.titulo, 'Título')   : r.titulo;
    const setor     = req.body.setor     !== undefined ? textoObrigatorio(req.body.setor, 'Setor')     : r.setor;
    const assunto   = req.body.assunto   !== undefined ? textoObrigatorio(req.body.assunto, 'Assunto') : r.assunto;
    const dataReu   = req.body.data_reuniao !== undefined ? textoObrigatorio(req.body.data_reuniao, 'Data') : r.data_reuniao;
    const horario   = req.body.horario   !== undefined ? textoObrigatorio(req.body.horario, 'Horário') : r.horario;
    const projetoId = req.body.projeto_id !== undefined ? inteiroOpcional(req.body.projeto_id, 'Projeto') : r.projeto_id;
    const moduloId  = req.body.modulo_id  !== undefined ? inteiroOpcional(req.body.modulo_id, 'Módulo')  : r.modulo_id;
    const ideiaId   = req.body.ideia_id   !== undefined ? inteiroOpcional(req.body.ideia_id, 'Ideia')    : r.ideia_id;

    const result = await dbQuery(
      `UPDATE reunioes SET titulo=$1, setor=$2, assunto=$3, data_reuniao=$4, horario=$5,
         projeto_id=$6, modulo_id=$7, ideia_id=$8 WHERE id=$9 RETURNING *`,
      [titulo, setor, assunto, dataReu, horario, projetoId, moduloId, ideiaId, id]
    );

    res.ok(result.rows[0], 'Reunião atualizada com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireRole('DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Reunião');
    const status = textoObrigatorio(req.body.status, 'Status');
    validarEnum(status, REUNIAO_STATUS, 'Status');

    if (status === 'CONCLUIDA') {
      const relato = textoObrigatorio(req.body.relato, 'Relato da reunião');
      const result = await dbQuery(
        `UPDATE reunioes SET status = $1, relato = $2 WHERE id = $3 RETURNING *`,
        [status, relato, id]
      );
      if (!result.rows[0]) throw erro(404, 'Reunião não encontrada.');
      return res.ok(result.rows[0], 'Reunião concluída.');
    }

    const result = await dbQuery(
      `UPDATE reunioes SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!result.rows[0]) throw erro(404, 'Reunião não encontrada.');
    res.ok(result.rows[0], 'Status atualizado com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('DESENVOLVEDOR', 'ADMIN'), async (req, res, next) => {
  try {
    const id = inteiroObrigatorio(req.params.id, 'Reunião');
    const result = await dbQuery('DELETE FROM reunioes WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw erro(404, 'Reunião não encontrada.');
    res.ok(null, 'Reunião excluída com sucesso.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
