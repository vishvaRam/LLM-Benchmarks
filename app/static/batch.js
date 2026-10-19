document.addEventListener("DOMContentLoaded", () => {
  const endpointSelect = document.getElementById("endpointSelect");
  const modelInput = document.getElementById("modelInput");
  const modelChips = document.getElementById("modelChips");
  const concurrencyInput = document.getElementById("concurrencyInput");
  const maxTokens = document.getElementById("maxTokens");
  const thinkingToggle = document.getElementById("thinkingToggle");

  const hfDataset = document.getElementById("hfDataset");
  const hfConfig = document.getElementById("hfConfig");
  const hfSplit = document.getElementById("hfSplit");
  const hfColumn = document.getElementById("hfColumn");
  const numSamples = document.getElementById("numSamples");
  const startBatchBtn = document.getElementById("startBatchBtn");

  const progressSection = document.getElementById("progressSection");
  const batchStatusText = document.getElementById("batchStatusText");
  const batchProgressCount = document.getElementById("batchProgressCount");
  const progressBar = document.getElementById("progressBar");

  const summaryCards = document.getElementById("summaryCards");
  const aggTtft = document.getElementById("aggTtft");
  const aggTps = document.getElementById("aggTps");
  const aggClusterTps = document.getElementById("aggClusterTps");
  const aggCounts = document.getElementById("aggCounts");
  const resultsTableBody = document.getElementById("resultsTableBody");

  let endpoints = [];

  // 1. Load endpoints from existing endpoints.json
  async function initEndpoints() {
    const res = await fetch("/endpoints/");
    endpoints = await res.json();
    endpointSelect.innerHTML = "";
    endpoints.forEach((ep) => {
      const opt = document.createElement("option");
      opt.value = ep.id;
      opt.textContent = `${ep.name} (${ep.base_url})`;
      endpointSelect.appendChild(opt);
    });

    if (endpoints.length > 0) {
      endpointSelect.value = endpoints[0].id;
      renderModelChips(endpoints[0]);
    }
  }

  function renderModelChips(ep) {
    modelChips.innerHTML = "";
    if (ep && ep.models && ep.models.length > 0) {
      modelInput.value = ep.models[0].id;
      thinkingToggle.checked = !!ep.models[0].supports_thinking;
      ep.models.forEach((m) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "text-[11px] bg-surface-700 hover:bg-surface-600 text-slate-300 px-2 py-0.5 rounded border border-surface-600 flex items-center gap-1";
        btn.innerHTML = `
          <span>${m.display_name || m.id}</span>
          ${m.supports_thinking ? '<span class="text-[9px] text-purple-400 font-mono bg-purple-950/80 px-1 rounded border border-purple-800/60">think</span>' : ''}
        `;
        btn.onclick = () => {
          modelInput.value = m.id;
          thinkingToggle.checked = !!m.supports_thinking;
        };
        modelChips.appendChild(btn);
      });
    }
  }

  endpointSelect.addEventListener("change", (e) => {
    const ep = endpoints.find((item) => item.id === e.target.value);
    renderModelChips(ep);
  });

  // 2. Dataset Quick Presets
  document.querySelectorAll(".hf-preset").forEach((btn) => {
    btn.onclick = () => {
      hfDataset.value = btn.dataset.ds;
      hfConfig.value = btn.dataset.cfg;
      hfSplit.value = btn.dataset.split;
      hfColumn.value = btn.dataset.col;
    };
  });

  // 3. Run Batch Run
  startBatchBtn.addEventListener("click", async () => {
    const epId = endpointSelect.value;
    const model = modelInput.value.trim();

    if (!epId || !model) return alert("Select endpoint & specify model.");

    startBatchBtn.disabled = true;
    progressSection.classList.remove("hidden");
    summaryCards.classList.add("hidden");
    resultsTableBody.innerHTML = "";
    progressBar.style.width = "0%";
    batchStatusText.textContent = "Connecting...";

    const payload = {
      endpoint_id: epId,
      parameters: {
        model: model,
        stream: true,
        enable_thinking: thinkingToggle.checked,
        max_tokens: parseInt(maxTokens.value),
        temperature: 0.7,
        top_p: 0.95,
      },
      concurrency_limit: parseInt(concurrencyInput.value),
      dataset: {
        dataset_name: hfDataset.value.trim(),
        config: hfConfig.value.trim(),
        split: hfSplit.value.trim(),
        prompt_column: hfColumn.value.trim(),
        num_samples: parseInt(numSamples.value),
      },
    };

    try {
      const response = await fetch("/batch/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === "status") {
              batchStatusText.textContent = data.message;
              if (data.total) batchProgressCount.textContent = `0 / ${data.total}`;
            } else if (data.type === "sample_completed") {
              const res = data.result;
              const pct = (data.completed / data.total) * 100;
              progressBar.style.width = `${pct}%`;
              batchProgressCount.textContent = `${data.completed} / ${data.total}`;
              batchStatusText.textContent = `Processed sample ${res.index}`;

              // Append Table Row
              const row = document.createElement("tr");
              row.className = "hover:bg-surface-700/50 transition";
              row.innerHTML = `
                <td class="p-3 text-slate-400 font-bold">${res.index}</td>
                <td class="p-3 text-slate-300 max-w-xs truncate" title="${escapeHtml(res.prompt)}">${escapeHtml(res.prompt)}</td>
                <td class="p-3 text-slate-200 max-w-sm truncate" title="${escapeHtml(res.output || res.error_message)}">${escapeHtml(res.output || res.error_message)}</td>
                <td class="p-3 text-emerald-400">${res.ttft_ms} ms</td>
                <td class="p-3 text-sky-400">${res.throughput_tokens_per_sec}</td>
                <td class="p-3 text-purple-300">${res.output_tokens}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] ${res.status === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}">${res.status}</span></td>
              `;
              resultsTableBody.appendChild(row);
            } else if (data.type === "batch_finished") {
              const s = data.summary;
              batchStatusText.textContent = `Batch finished in ${s.total_elapsed_sec}s!`;
              summaryCards.classList.remove("hidden");
              aggTtft.textContent = `${s.avg_ttft_ms} ms`;
              aggTps.textContent = `${s.avg_throughput_tok_per_sec} tok/s`;
              aggClusterTps.textContent = `${s.overall_throughput_tok_per_sec} tok/s`;
              aggCounts.textContent = `${s.successful_samples} / ${s.failed_samples}`;
            } else if (data.type === "error") {
              alert(data.message);
              batchStatusText.textContent = `Error: ${data.message}`;
            }
          } catch (e) {
            console.error("Batch SSE parse error", e);
          }
        }
      }
    } catch (err) {
      alert("Batch execution failed: " + err.message);
    } finally {
      startBatchBtn.disabled = false;
    }
  });

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  initEndpoints();
});