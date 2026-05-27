require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const projetosRoutes = require('./routes/projetos.routes');
const modulosRoutes = require('./routes/modulos.routes');
const ideiasRoutes = require('./routes/ideias.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const historicoRoutes = require('./routes/historico.routes');
const preAnaliseRoutes = require('./routes/pre-analise.routes');
const reunioesRoutes = require('./routes/reunioes.routes');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", 'data:'],
      "connect-src": ["'self'"]
    }
  }
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas requisições em pouco tempo. Tente novamente em alguns minutos.'
  }
}));

app.use((req, res, next) => {
  res.ok = (data = null, message = 'OK') => res.json({ success: true, message, data });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/projetos', requireAuth, projetosRoutes);
app.use('/api', requireAuth, modulosRoutes);
app.use('/api/ideias', requireAuth, ideiasRoutes);
app.use('/api/usuarios', requireAuth, usuariosRoutes);
app.use('/api', requireAuth, historicoRoutes);
app.use('/api', requireAuth, preAnaliseRoutes);
app.use('/api/reunioes', requireAuth, reunioesRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada.'
  });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error(err);
  }

  res.status(status).json({
    success: false,
    message: err.message || 'Erro interno no servidor.',
    error: isProduction ? undefined : err.code || err.stack
  });
});

app.listen(PORT, () => {
  console.log(`PlannoDev rodando na porta ${PORT}`);
});

