require('dotenv').config();

console.log('[boot] processo iniciado, NODE_ENV=' + process.env.NODE_ENV);
console.log('[boot] JWT_SECRET definido:', !!process.env.JWT_SECRET);
console.log('[boot] DATABASE_URL definido:', !!process.env.DATABASE_URL);
console.log('[boot] PORT:', process.env.PORT);

// Validações de inicialização — falha rápida antes de qualquer require
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não está definido. Configure a variável de ambiente e reinicie.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL não está definido. Configure a variável de ambiente e reinicie.');
  process.exit(1);
}

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
const fontesProjetoRoutes = require('./routes/fontes-projeto.routes');
const equipeProjetoRoutes = require('./routes/equipe-projeto.routes');
const { requireAuth } = require('./middleware/auth');
const { registrarLog } = require('./services/logs.service');

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

// Rate limit geral da API
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas requisições em pouco tempo. Tente novamente em alguns minutos.' }
}));

// Rate limit restrito para login — máximo 10 tentativas por IP a cada 15 min
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // não conta tentativas bem-sucedidas
  message: { success: false, message: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' }
}));

app.use((req, res, next) => {
  res.ok = (data = null, message = 'OK') => res.json({ success: true, message, data });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Interceptor de logs — registra todas as operações mutantes bem-sucedidas
function extrairEntidade(url) {
  const p = url.replace(/^\/api/, '').split('?')[0];
  const regras = [
    [/\/projetos\/\d+\/modulos/,    'MODULO'],
    [/\/projetos\/\d+\/equipe/,     'EQUIPE'],
    [/\/projetos\/\d+\/pre-analise/,'RELATORIO'],
    [/\/projetos\/\d+\/fontes/,     'FONTE'],
    [/\/projetos/,                   'PROJETO'],
    [/\/modulos\/\d+\/commits/,     'COMMIT'],
    [/\/modulos/,                   'MODULO'],
    [/\/ideias/,                    'IDEIA'],
    [/\/reunioes/,                  'REUNIAO'],
    [/\/usuarios/,                  'USUARIO'],
    [/\/equipe/,                    'EQUIPE'],
    [/\/pre-analise/,               'RELATORIO'],
    [/\/fontes-projeto/,            'FONTE'],
  ];
  const entidade = (regras.find(([rx]) => rx.test(p)) || [])[1] || null;
  const idMatch  = p.match(/\/(\d+)/);
  return { entidade, entidadeId: idMatch ? Number(idMatch[1]) : null };
}

const ACAO_LABEL = { POST: 'CRIAR', PUT: 'EDITAR', PATCH: 'EDITAR', DELETE: 'EXCLUIR' };
const VERBO      = { CRIAR: 'criou', EDITAR: 'editou', EXCLUIR: 'excluiu' };

app.use('/api', (req, res, next) => {
  const acao = ACAO_LABEL[req.method];
  if (!acao) return next();

  const origJson = res.json.bind(res);
  res.json = function (body) {
    if (body?.success !== false && req.user) {
      const { entidade, entidadeId } = extrairEntidade(req.originalUrl);
      const id = entidadeId || body?.data?.id || null;
      const verbo = VERBO[acao] || acao.toLowerCase();
      registrarLog({
        req,
        acao,
        entidade,
        entidadeId: id,
        descricao: `${req.user.nome} ${verbo}${entidade ? ' ' + entidade.toLowerCase() : ''}${id ? ' #' + id : ''}`
      });
    }
    return origJson(body);
  };
  next();
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
app.use('/api', requireAuth, fontesProjetoRoutes);
app.use('/api', requireAuth, equipeProjetoRoutes);

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

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`PlannoDev rodando na porta ${PORT}`);
});

