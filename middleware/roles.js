function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.perfil)) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para executar esta ação.'
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};
