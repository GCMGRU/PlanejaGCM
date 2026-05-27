const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { dbQuery } = require('../db/pool');
const { requireRole } = require('../middleware/roles');
const { erro, textoObrigatorio, validarEnum } = require('./helpers');

const PERFIS = ['DESENVOLVEDOR', 'SUPERVISOR', 'ADMIN'];
const SALT_ROUNDS = 12;

function gerarSenhaAleatoria() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

const router = express.Router();

router.get('/', requireRole('DESENVOLVEDOR', 'ADMIN'), async (req, res, next) => {
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

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const nome = textoObrigatorio(req.body.nome, 'Nome');
    const usuario = textoObrigatorio(req.body.usuario, 'Usuário').toLowerCase();
    const perfil = textoObrigatorio(req.body.perfil, 'Perfil');

    validarEnum(perfil, PERFIS, 'Perfil');

    const senhaTemporaria = gerarSenhaAleatoria();
    const senhaHash = await bcrypt.hash(senhaTemporaria, SALT_ROUNDS);

    let result;
    try {
      result = await dbQuery(
        `INSERT INTO usuarios (nome, usuario, senha_hash, perfil)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nome, usuario, perfil, ativo, criado_em`,
        [nome, usuario, senhaHash, perfil]
      );
    } catch (dbErr) {
      if (dbErr.code === '23505') {
        throw erro(409, 'Este nome de usuário já está em uso.');
      }
      throw dbErr;
    }

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso.',
      data: {
        usuario: result.rows[0],
        senha_temporaria: senhaTemporaria
      }
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/desativar', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (id === req.user.id) {
      throw erro(400, 'Você não pode desativar sua própria conta.');
    }

    const result = await dbQuery(
      `UPDATE usuarios SET ativo = FALSE WHERE id = $1 RETURNING id, nome`,
      [id]
    );

    if (!result.rows[0]) throw erro(404, 'Usuário não encontrado.');

    res.ok(result.rows[0], 'Usuário desativado com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/ativar', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const result = await dbQuery(
      `UPDATE usuarios SET ativo = TRUE WHERE id = $1 RETURNING id, nome`,
      [id]
    );

    if (!result.rows[0]) throw erro(404, 'Usuário não encontrado.');

    res.ok(result.rows[0], 'Usuário reativado com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/redefinir-senha', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const senhaTemporaria = gerarSenhaAleatoria();
    const senhaHash = await bcrypt.hash(senhaTemporaria, SALT_ROUNDS);

    const result = await dbQuery(
      `UPDATE usuarios SET senha_hash = $1 WHERE id = $2 RETURNING id, nome`,
      [senhaHash, id]
    );

    if (!result.rows[0]) throw erro(404, 'Usuário não encontrado.');

    res.ok({ senha_temporaria: senhaTemporaria }, 'Senha redefinida com sucesso.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
