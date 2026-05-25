const { dbQuery } = require('../db/pool');

function normalizarValor(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  return String(valor);
}

async function registrarHistorico({
  entidade,
  entidadeId,
  acao,
  campoAlterado = null,
  valorAntigo = null,
  valorNovo = null,
  usuarioId = null,
  descricao = null
}) {
  await dbQuery(
    `INSERT INTO historico_alteracoes
      (entidade, entidade_id, acao, campo_alterado, valor_antigo, valor_novo, usuario_id, descricao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entidade,
      entidadeId,
      acao,
      campoAlterado,
      normalizarValor(valorAntigo),
      normalizarValor(valorNovo),
      usuarioId,
      descricao
    ]
  );
}

async function registrarAlteracoes({
  entidade,
  entidadeId,
  acao,
  antigo,
  novo,
  campos,
  usuarioId,
  descricaoBase
}) {
  const registros = [];

  for (const campo of campos) {
    const valorAntigo = normalizarValor(antigo[campo]);
    const valorNovo = normalizarValor(novo[campo]);

    if (valorAntigo !== valorNovo) {
      registros.push(registrarHistorico({
        entidade,
        entidadeId,
        acao,
        campoAlterado: campo,
        valorAntigo,
        valorNovo,
        usuarioId,
        descricao: `${descricaoBase}: ${campo} alterado de ${valorAntigo || '-'} para ${valorNovo || '-'}.`
      }));
    }
  }

  await Promise.all(registros);
}

module.exports = {
  registrarHistorico,
  registrarAlteracoes
};
