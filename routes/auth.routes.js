const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../db/pool');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { textoObrigatorio, erro } = require('./helpers');

const router = express.Router();

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const usuario = textoObrigatorio(req.body.usuario, 'Usuário').toLowerCase();
    const senha = textoObrigatorio(req.body.senha, 'Senha');

    const result = await dbQuery(
      `SELECT id, nome, usuario, senha_hash, perfil, ativo
       FROM usuarios
       WHERE usuario = $1 AND ativo = TRUE`,
      [usuario]
    );

    const user = result.rows[0];
    const senhaValida = user ? await bcrypt.compare(senha, user.senha_hash) : false;

    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos.'
      });
    }

    const token = jwt.sign(
      { id: user.id, perfil: user.perfil },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, cookieOptions());

    return res.ok({
      id: user.id,
      nome: user.nome,
      usuario: user.usuario,
      perfil: user.perfil
    }, 'Login realizado com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.ok(req.user);
});

router.post('/trocar-senha', requireAuth, async (req, res, next) => {
  try {
    const novaSenha = textoObrigatorio(req.body.nova_senha, 'Nova senha');
    const confirmar = textoObrigatorio(req.body.confirmar_senha, 'Confirmação de senha');

    if (novaSenha !== confirmar) throw erro(400, 'As senhas não coincidem.');
    if (novaSenha.length < 6) throw erro(400, 'A nova senha deve ter pelo menos 6 caracteres.');

    const hash = await bcrypt.hash(novaSenha, 10);
    await dbQuery(
      `UPDATE usuarios SET senha_hash = $1, deve_redefinir_senha = FALSE WHERE id = $2`,
      [hash, req.user.id]
    );

    res.ok(null, 'Senha alterada com sucesso.');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.ok(null, 'Sessão encerrada.');
});

module.exports = router;
