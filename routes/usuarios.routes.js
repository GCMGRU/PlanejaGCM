const express = require('express');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireRole('DESENVOLVEDOR'), async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT id, nome, usuario, perfil, ativo, criado_em, atualizado_em
       FROM usuarios
       ORDER BY nome ASC`
    );

    res.ok(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
