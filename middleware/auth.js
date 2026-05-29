const jwt = require('jsonwebtoken');
const { dbQuery } = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_temporario_desenvolvimento';

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Faça login para continuar.'
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const result = await dbQuery(
      `SELECT id, nome, usuario, perfil, ativo, deve_redefinir_senha, criado_em, atualizado_em
       FROM usuarios
       WHERE id = $1 AND ativo = TRUE`,
      [payload.id]
    );

    if (!result.rows[0]) {
      return res.status(401).json({
        success: false,
        message: 'Sessão inválida. Faça login novamente.'
      });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Sessão expirada ou inválida. Faça login novamente.'
    });
  }
}

module.exports = {
  requireAuth,
  JWT_SECRET
};
