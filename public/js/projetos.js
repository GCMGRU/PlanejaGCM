let projetos = [];
let usuarios = [];
let equipeForm = []; // {usuario_id, nome, funcao}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await iniciarPagina("/projetos.html");

    if (usuarioLogado.perfil === "DESENVOLVEDOR") {
      await carregarUsuarios();
    }

    configurarEventos();
    await carregarProjetos();
  } catch (err) {
    mostrarMensagem("projetoMensagem", err.message, "error");
  } finally {
    finalizarCarregamento();
  }
});

function configurarEventos() {
  document
    .getElementById("filtrosProjetos")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      await carregarProjetos();
    });

  document
    .getElementById("limparFiltrosProjetos")
    ?.addEventListener("click", async () => {
      document.getElementById("filtrosProjetos").reset();
      await carregarProjetos();
    });

  document
    .getElementById("novoProjetoBtn")
    ?.addEventListener("click", () =>
      abrirFormProjeto().catch((err) =>
        mostrarMensagem("projetoMensagem", err.message, "error")
      )
    );
  document
    .getElementById("fecharProjetoForm")
    .addEventListener("click", fecharFormProjeto);
  document
    .getElementById("cancelarProjetoForm")
    .addEventListener("click", fecharFormProjeto);

  document.getElementById("adicionarMembroBtn")?.addEventListener("click", adicionarMembroEquipe);

  document
    .getElementById("projetoForm")
    .addEventListener("submit", salvarProjeto);

  document
    .getElementById("projetosTabela")
    .addEventListener("click", async (event) => {
      const botao = event.target.closest("[data-action]");
      if (!botao) return;

      const id = Number(botao.dataset.id);
      const projeto = projetos.find((item) => item.id === id);

      if (botao.dataset.action === "editar" && projeto) {
        abrirFormProjeto(projeto).catch((err) =>
          mostrarMensagem("projetoMensagem", err.message, "error")
        );
      }

      if (botao.dataset.action === "excluir" && projeto) {
        await excluirProjeto(projeto, botao);
      }
    });
}

async function carregarUsuarios() {
  const response = await apiFetch("/api/usuarios");
  usuarios = response.data;
  preencherSelectUsuarios(document.getElementById("responsavel_id"), usuarios);
}

async function carregarProjetos() {
  const filtros = new URLSearchParams(
    new FormData(document.getElementById("filtrosProjetos")),
  );

  for (const [chave, valor] of [...filtros.entries()]) {
    if (!valor) filtros.delete(chave);
  }

  const response = await apiFetch(`/api/projetos?${filtros.toString()}`);
  projetos = response.data;
  renderizarResumoProjetos();
  renderizarTabelaProjetos();
}

function renderizarResumoProjetos() {
  const resumo = document.getElementById("projetosResumo");
  if (!resumo) return;

  const total = projetos.length;
  const emAndamento = projetos.filter((projeto) =>
    ["EM_DESENVOLVIMENTO", "EM_TESTE"].includes(projeto.status),
  ).length;
  const altaPrioridade = projetos.filter((projeto) =>
    ["ALTA", "URGENTE"].includes(projeto.prioridade),
  ).length;
  const atrasados = projetos.filter(estaProjetoAtrasado).length;

  const cards = [
    ["Projetos filtrados", total, "Visível nesta consulta"],
    ["Em andamento", emAndamento, "Desenvolvimento ou teste"],
    ["Alta prioridade", altaPrioridade, "Itens que pedem atenção"],
    ["Prazos vencidos", atrasados, "Projetos não concluídos no prazo"],
  ];

  resumo.innerHTML = cards
    .map(
      ([label, valor, nota]) => `
    <article class="project-metric">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${valor}</strong>
      <span class="metric-note">${escapeHtml(nota)}</span>
    </article>
  `,
    )
    .join("");
}

function renderizarTabelaProjetos() {
  const tbody = document.getElementById("projetosTabela");
  const contador = document.getElementById("projetosContador");

  if (contador) {
    contador.textContent = `${projetos.length} ${projetos.length === 1 ? "projeto" : "projetos"}`;
  }

  if (!projetos.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty">Nenhum projeto encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = projetos.map(renderizarLinhaProjeto).join("");
}

function renderizarLinhaProjeto(projeto) {
  const progresso = limitarProgresso(projeto.progresso);
  const atrasado = estaProjetoAtrasado(projeto);

  return `
    <tr>
      <td class="project-cell">
        <div class="project-name">
          <a href="/projeto-detalhe.html?id=${projeto.id}">${escapeHtml(projeto.nome)}</a>
        </div>
        <div class="project-description">${escapeHtml(projeto.descricao || "Sem descrição cadastrada.")}</div>
      </td>
      <td>
        <div class="stack-sm">
          ${badgeStatus(projeto.status)}
          ${atrasado ? '<span class="badge badge-danger">Atrasado</span>' : ""}
        </div>
      </td>
      <td>${badgePrioridade(projeto.prioridade)}</td>
      <td>${escapeHtml(projeto.responsavel_nome || "Sem responsável")}</td>
      <td class="${atrasado ? "due-overdue" : ""}">
        <strong>${formatarData(projeto.data_fim_prevista)}</strong>
        <div class="muted">${atrasado ? "Prazo vencido" : "Prazo previsto"}</div>
      </td>
      <td class="progress-cell">
        <div class="progress-label">
          <span>Progresso</span>
          <span>${progresso}%</span>
        </div>
        <div class="progress"><div class="progress-bar" style="width: ${progresso}%"></div></div>
      </td>
      <td>
        <div class="actions">
          <a class="btn btn-secondary btn-small" href="/projeto-detalhe.html?id=${projeto.id}">Abrir</a>
          ${
            usuarioLogado.perfil === "DESENVOLVEDOR"
              ? `
            <button class="btn btn-secondary btn-small" type="button" data-action="editar" data-id="${projeto.id}">Editar</button>
            <button class="btn btn-danger btn-small" type="button" data-action="excluir" data-id="${projeto.id}">Excluir</button>
          `
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

async function abrirFormProjeto(projeto = null) {
  limparMensagem("projetoMensagem");
  equipeForm = [];

  const form = document.getElementById("projetoForm");
  form.reset();
  const panel = document.getElementById("projetoFormPanel");
  panel.classList.remove("hidden");
  document.getElementById("projetoFormTitulo").textContent = projeto
    ? "Editar projeto"
    : "Novo projeto";
  preencherSelectUsuarios(
    document.getElementById("responsavel_id"),
    usuarios,
    projeto?.responsavel_id,
  );

  // Preencher select de membros (exclui quem já está na equipe depois de carregar)
  preencherSelectEquipeUsuarios();

  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("nome").focus();

  if (!projeto) {
    document.getElementById("prioridade").value = "MEDIA";
    document.getElementById("status").value = "PLANEJADO";
    renderizarEquipeForm();
    return;
  }

  document.getElementById("projetoId").value = projeto.id;
  document.getElementById("nome").value = projeto.nome || "";
  document.getElementById("descricao").value = projeto.descricao || "";
  document.getElementById("data_inicio").value = valorDataInput(projeto.data_inicio);
  document.getElementById("data_fim_prevista").value = valorDataInput(projeto.data_fim_prevista);
  document.getElementById("data_conclusao").value = valorDataInput(projeto.data_conclusao);
  document.getElementById("status").value = projeto.status;
  document.getElementById("prioridade").value = projeto.prioridade;

  // Carregar equipe existente no formulário de edição
  const equipeResponse = await apiFetch(`/api/projetos/${projeto.id}/equipe`);
  equipeForm = equipeResponse.data.map((m) => ({
    usuario_id: m.usuario_id,
    nome: m.usuario_nome,
    funcao: m.funcao,
  }));
  preencherSelectEquipeUsuarios();
  renderizarEquipeForm();
}

function preencherSelectEquipeUsuarios() {
  const select = document.getElementById("equipeUsuarioSelect");
  if (!select) return;
  const idsNaEquipe = new Set(equipeForm.map((m) => m.usuario_id));
  select.innerHTML =
    '<option value="">Selecionar membro...</option>' +
    usuarios
      .filter((u) => !idsNaEquipe.has(u.id))
      .map(
        (u) =>
          `<option value="${u.id}">${escapeHtml(u.nome)} (${escapeHtml(formatarPerfil(u.perfil))})</option>`,
      )
      .join("");
}

function renderizarEquipeForm() {
  const lista = document.getElementById("equipeFormLista");
  if (!lista) return;

  if (!equipeForm.length) {
    lista.innerHTML =
      '<p class="muted" style="margin:0 0 4px;font-size:0.85em;">Nenhum membro adicionado.</p>';
    return;
  }

  lista.innerHTML = equipeForm
    .map(
      (m) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface-soft);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:4px;">
      <span style="flex:1;font-weight:600;">${escapeHtml(m.nome)}</span>
      <span class="badge badge-neutral">${escapeHtml(m.funcao)}</span>
      <button type="button" class="btn btn-danger btn-small" data-action="remover-membro-form" data-id="${m.usuario_id}">Remover</button>
    </div>
  `,
    )
    .join("");

  lista.querySelectorAll("[data-action='remover-membro-form']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      equipeForm = equipeForm.filter((m) => m.usuario_id !== id);
      preencherSelectEquipeUsuarios();
      renderizarEquipeForm();
    });
  });
}

function adicionarMembroEquipe() {
  const select = document.getElementById("equipeUsuarioSelect");
  const funcaoInput = document.getElementById("equipeFuncaoInput");

  const usuario_id = Number(select.value);
  const funcao = funcaoInput.value.trim();

  if (!usuario_id) {
    alertar("Selecione um membro antes de adicionar.", { titulo: "Atenção" });
    return;
  }
  if (!funcao) {
    alertar("Informe a função do membro.", { titulo: "Atenção" });
    return;
  }

  const usuario = usuarios.find((u) => u.id === usuario_id);
  if (!usuario) return;

  equipeForm.push({ usuario_id, nome: usuario.nome, funcao });
  funcaoInput.value = "";
  preencherSelectEquipeUsuarios();
  renderizarEquipeForm();
}

function fecharFormProjeto() {
  document.getElementById("projetoFormPanel").classList.add("hidden");
  document.getElementById("projetoForm").reset();
  limparMensagem("projetoMensagem");
  equipeForm = [];
  renderizarEquipeForm();
}

async function salvarProjeto(event) {
  event.preventDefault();
  limparMensagem("projetoMensagem");

  const btn = event.submitter ?? event.target.querySelector('[type="submit"]');
  setBtnLoading(btn, true);

  const form = event.target;
  const dados = formParaObjeto(form);
  const id = dados.id;
  delete dados.id;

  try {
    let projetoId;
    if (id) {
      await apiFetch(`/api/projetos/${id}`, { method: "PUT", body: dados });
      projetoId = id;
      mostrarMensagem("projetoMensagem", "Projeto atualizado com sucesso.");
    } else {
      const criado = await apiFetch("/api/projetos", { method: "POST", body: dados });
      projetoId = criado.data.id;
      mostrarMensagem("projetoMensagem", "Projeto criado com sucesso.");
    }

    // Sincronizar equipe (substitui a equipe completa)
    await apiFetch(`/api/projetos/${projetoId}/equipe`, {
      method: "PUT",
      body: { equipe: equipeForm.map(({ usuario_id, funcao }) => ({ usuario_id, funcao })) },
    });

    await carregarProjetos();
    setTimeout(fecharFormProjeto, 700);
  } catch (err) {
    mostrarMensagem("projetoMensagem", err.message, "error");
  } finally {
    setBtnLoading(btn, false);
  }
}

async function excluirProjeto(projeto, btn) {
  const ok = await confirmar(`Excluir o projeto "${projeto.nome}"?`, {
    titulo: 'Confirmar exclusão',
    descricao: 'Esta ação não pode ser desfeita.',
    confirmar: 'Excluir',
    perigo: true
  });
  if (!ok) return;

  setBtnLoading(btn, true);
  try {
    await apiFetch(`/api/projetos/${projeto.id}`, { method: "DELETE" });
    await carregarProjetos();
  } catch (err) {
    await alertar(err.message, { titulo: 'Erro ao excluir' });
  } finally {
    setBtnLoading(btn, false);
  }
}

function limitarProgresso(valor) {
  const numero = Number(valor) || 0;
  return Math.min(Math.max(numero, 0), 100);
}

function estaProjetoAtrasado(projeto) {
  if (
    !projeto.data_fim_prevista ||
    ["CONCLUIDO", "CANCELADO"].includes(projeto.status)
  ) {
    return false;
  }

  const prazo = valorDataInput(projeto.data_fim_prevista);
  if (!prazo) return false;

  const hoje = new Date(new Date().toDateString());
  const dataPrazo = new Date(`${prazo}T00:00:00`);

  return dataPrazo < hoje;
}
