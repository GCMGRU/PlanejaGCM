const PROJETO_STATUS = [
  'PLANEJADO',
  'EM_DESENVOLVIMENTO',
  'EM_TESTE',
  'PAUSADO',
  'CONCLUIDO',
  'CANCELADO'
];

const MODULO_STATUS = [
  'NAO_INICIADO',
  'EM_DESENVOLVIMENTO',
  'AGUARDANDO_VALIDACAO',
  'EM_AJUSTE',
  'CONCLUIDO',
  'PAUSADO',
  'CANCELADO'
];

const IDEIA_STATUS = [
  'NOVA',
  'EM_ANALISE',
  'ACEITA',
  'RECUSADA',
  'TRANSFORMADA_EM_MODULO',
  'IMPLEMENTADA'
];

const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'];

function erro(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function validarEnum(valor, permitidos, nomeCampo) {
  if (!permitidos.includes(valor)) {
    throw erro(400, `${nomeCampo} inválido.`);
  }
}

function textoObrigatorio(valor, nomeCampo) {
  if (!valor || !String(valor).trim()) {
    throw erro(400, `${nomeCampo} é obrigatório.`);
  }

  return String(valor).trim();
}

function textoOpcional(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }

  return String(valor).trim();
}

function dataOpcional(valor, nomeCampo) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) {
    throw erro(400, `${nomeCampo} deve estar no formato AAAA-MM-DD.`);
  }

  return valor;
}

function inteiroOpcional(valor, nomeCampo) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const numero = Number.parseInt(valor, 10);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw erro(400, `${nomeCampo} inválido.`);
  }

  return numero;
}

function inteiroObrigatorio(valor, nomeCampo) {
  const numero = inteiroOpcional(valor, nomeCampo);

  if (!numero) {
    throw erro(400, `${nomeCampo} é obrigatório.`);
  }

  return numero;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  PROJETO_STATUS,
  MODULO_STATUS,
  IDEIA_STATUS,
  PRIORIDADES,
  erro,
  validarEnum,
  textoObrigatorio,
  textoOpcional,
  dataOpcional,
  inteiroOpcional,
  inteiroObrigatorio,
  hojeISO
};
