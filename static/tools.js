document.addEventListener("DOMContentLoaded", () => {
  const endpointSelect = document.getElementById("endpointSelect");
  const modelInput = document.getElementById("modelInput");
  const modelChips = document.getElementById("modelChips");
  const concurrencyInput = document.getElementById("concurrencyInput");
  const maxTokens = document.getElementById("maxTokens");

  const datasetName = document.getElementById("datasetName");
  const datasetConfig = document.getElementById("datasetConfig");
  const datasetSplit = document.getElementById("datasetSplit");
  const numSamples = document.getElementById("numSamples");
  const evalSeed = document.getElementById("evalSeed");
  const shuffleToggle = document.getElementById("shuffleToggle");
  const startBenchmarkBtn = document.getElementById("startBenchmarkBtn");

  const gridContainer = document.getElementById("gridContainer");
  const statAccuracy = document.getElementById("statAccuracy");
  const statFraction = document.getElementById("statFraction");
  const statTtft = document.getElementById("statTtft");
  const statThroughput = document.getElementById("statThroughput");
  const statStatus = document.getElementById("statStatus");
  const statElapsed = document.getElementById("statElapsed");

  // Inspector Elements
  let currentInspectIndex = 1;
  const inspectModal = document.getElementById("inspectModal");
  const closeInspectBtn = document.getElementById("closeInspectBtn");
  const inspectPrevBtn = document.getElementById("inspectPrevBtn");
  const inspectNextBtn = document.getElementById("inspectNextBtn");

  const inspectTitle = document.getElementById("inspectTitle");
  const inspectBadge = document.getElementById("inspectBadge");
  const inspectPrompt = document.getElementById("inspectPrompt");
  const inspectExpected = document.getElementById("inspectExpected");
  const inspectActual = document.getElementById("inspectActual");
  const inspectArgs = document.getElementById("inspectArgs");
  const inspectRaw = document.getElementById("inspectRaw");

  const inspectMetrics = document.getElementById("inspectMetrics");
  const inspectTtft = document.getElementById("inspectTtft");
  const inspectLatency = document.getElementById("inspectLatency");
  const inspectTokens = document.getElementById("inspectTokens");

  const copyArgsBtn = document.getElementById("copyArgsBtn");
  const copyRawBtn = document.getElementById("copyRawBtn");

  let endpoints = [];
  let evaluatedResults = {};

  // Preset Selection
  const presetButtons = document.querySelectorAll(".preset-btn");
  presetButtons.forEach((btn) => {
    btn.onclick = () => {
      presetButtons.forEach((b) => {
        b.className = "preset-btn text-[11px] bg-surface-700 hover:bg-surface-600 border border-surface-600 px-2.5 py-1 rounded text-amber-300 transition";
      });
      btn.className = "preset-btn text-[11px] bg-amber-600 text-white font-medium border border-amber-500 px-2.5 py-1 rounded transition";

      datasetName.value = btn.dataset.ds;
      datasetSplit.value = btn.dataset.split;
      datasetConfig.value = btn.dataset.cfg || "default";
    };
  });

  // Load Endpoints
  async function loadEndpoints() {
    try {
      const res = await fetch("/endpoints/");
      endpoints = await res.json();
      endpointSelect.innerHTML = '<option value="" disabled selected>Select an endpoint...</option>';
      endpoints.forEach((ep) => {
        const opt = document.createElement("option");
        opt.value = ep.id;
        opt.textContent = ep.name || ep.id;
        endpointSelect.appendChild(opt);
      });
      if (endpoints.length > 0) {
        endpointSelect.value = endpoints[0].id;
        renderModelChips(endpoints[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderModelChips(ep) {
    modelChips.innerHTML = "";
    if (ep && ep.models && ep.models.length > 0) {
      modelInput.value = ep.models[0].id;
      ep.models.forEach((m) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "text-[11px] bg-surface-700 hover:bg-surface-600 text-slate-300 px-2 py-0.5 rounded border border-surface-600 flex items-center gap-1 cursor-pointer";
        btn.textContent = m.display_name || m.id;
        btn.onclick = () => { modelInput.value = m.id; };
        modelChips.appendChild(btn);
      });
    }
  }

  endpointSelect.addEventListener("change", (e) => {
    const ep = endpoints.find((it) => it.id === e.target.value);
    renderModelChips(ep);
  });

  // Modal navigation
  closeInspectBtn.onclick = () => inspectModal.classList.add("hidden");

  window.addEventListener("keydown", (e) => {
    if (inspectModal.classList.contains("hidden")) return;
    if (e.key === "Escape") inspectModal.classList.add("hidden");
    if (e.key === "ArrowLeft") navigateInspect(-1);
    if (e.key === "ArrowRight") navigateInspect(1);
  });

  inspectPrevBtn.onclick = () => navigateInspect(-1);
  inspectNextBtn.onclick = () => navigateInspect(1);

  function navigateInspect(direction) {
    const totalCount = Object.keys(evaluatedResults).length;
    if (totalCount === 0) return;

    let target = currentInspectIndex + direction;
    if (target < 1) target = totalCount;
    if (target > totalCount) target = 1;

    openInspect(target);
  }

  function setupCopyBtn(btn, targetEl) {
    if (!btn || !targetEl) return;
    btn.onclick = async () => {
      const text = targetEl.textContent;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = original; }, 1200);
      } catch (err) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = original; }, 1200);
      }
    };
  }

  setupCopyBtn(copyArgsBtn, inspectArgs);
  setupCopyBtn(copyRawBtn, inspectRaw);

  function openInspect(index) {
    const res = evaluatedResults[index];
    if (!res) return;

    currentInspectIndex = index;
    inspectTitle.textContent = `Scenario #${res.index}`;
    inspectPrompt.textContent = res.prompt;

    // Expected Function
    inspectExpected.textContent = res.expected_tool || "(Any Function)";

    // Actual Invocation
    if (res.actual_tool) {
      inspectActual.textContent = res.actual_tool;
      inspectActual.className = res.is_correct
        ? "font-bold text-emerald-400 text-sm truncate"
        : "font-bold text-red-400 text-sm truncate";
    } else {
      inspectActual.textContent = "No tool called (Text response)";
      inspectActual.className = "font-bold text-slate-500 text-sm italic truncate";
    }

    // Arguments Display
    if (res.actual_args && Object.keys(res.actual_args).length > 0) {
      inspectArgs.textContent = JSON.stringify(res.actual_args, null, 2);
    } else {
      inspectArgs.textContent = "{\n  // No arguments emitted by model\n}";
    }

    // Raw Output / Error Trace
    let rawText = res.error_message || res.raw_response || "";
    try {
      const parsed = JSON.parse(rawText);
      inspectRaw.textContent = JSON.stringify(parsed, null, 2);
    } catch {
      inspectRaw.textContent = rawText || "(None)";
    }

    // Telemetry Badges
    if (inspectMetrics) {
      inspectMetrics.classList.remove("hidden");
      inspectTtft.textContent = `TTFT: ${res.ttft_ms} ms`;
      inspectLatency.textContent = `Total: ${(res.total_latency_ms / 1000).toFixed(2)} s`;
      inspectTokens.textContent = `Tokens: ${res.output_tokens}`;
    }

    // Status Badges
    if (res.status === "correct") {
      inspectBadge.textContent = "CORRECT CALL";
      inspectBadge.className = "text-xs font-mono px-2.5 py-0.5 rounded font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800";
    } else if (res.status === "incorrect") {
      inspectBadge.textContent = res.called_tool ? "WRONG ARGUMENTS / NAME" : "NO TOOL CALLED";
      inspectBadge.className = "text-xs font-mono px-2.5 py-0.5 rounded font-bold uppercase bg-red-950 text-red-400 border border-red-800";
    } else {
      inspectBadge.textContent = "EXECUTION ERROR";
      inspectBadge.className = "text-xs font-mono px-2.5 py-0.5 rounded font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800";
    }

    inspectModal.classList.remove("hidden");
  }

  // Run Benchmark
  startBenchmarkBtn.addEventListener("click", async () => {
    const epId = endpointSelect.value;
    const model = modelInput.value.trim();
    const count = parseInt(numSamples.value) || 24;

    if (!epId || !model) return alert("Select an endpoint & model.");

    startBenchmarkBtn.disabled = true;
    statStatus.textContent = "Running...";
    statStatus.className = "text-2xl font-mono font-bold text-amber-400 mt-1";
    statAccuracy.textContent = "--%";
    statFraction.textContent = `0 / ${count} correct`;
    statTtft.textContent = "-- ms";
    statThroughput.textContent = "--";

    evaluatedResults = {};
    gridContainer.innerHTML = "";

    // Generate Initial Pending Boxes
    for (let i = 1; i <= count; i++) {
      const box = document.createElement("button");
      box.id = `box-${i}`;
      box.type = "button";
      box.className = "h-11 w-full rounded flex items-center justify-center font-mono font-bold text-xs bg-surface-700 border border-surface-600 text-slate-400 transition transform hover:scale-105 cursor-pointer";
      box.textContent = i;
      box.onclick = () => openInspect(i);
      gridContainer.appendChild(box);
    }

    const rawSeed = evalSeed.value.trim();
    const parsedSeed = rawSeed !== "" && !isNaN(parseInt(rawSeed)) ? parseInt(rawSeed) : null;

    const payload = {
      endpoint_id: epId,
      parameters: {
        model: model,
        max_tokens: parseInt(maxTokens.value),
      },
      concurrency_limit: parseInt(concurrencyInput.value),
      dataset: {
        dataset_name: datasetName.value.trim(),
        config: datasetConfig.value.trim() || "default",
        split: datasetSplit.value.trim(),
        num_samples: count,
        shuffle: shuffleToggle.checked,
        seed: parsedSeed,
      },
    };

    const startTime = performance.now();
    let timer = setInterval(() => {
      statElapsed.textContent = `${((performance.now() - startTime) / 1000).toFixed(1)}s elapsed`;
    }, 100);

    try {
      const response = await fetch("/tools-benchmark/run", {
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

            if (data.type === "sample_completed") {
              const res = data.result;
              evaluatedResults[res.index] = res;

              const box = document.getElementById(`box-${res.index}`);
              if (box) {
                if (res.status === "correct") {
                  box.className = "h-11 w-full rounded flex items-center justify-center font-mono font-bold text-xs bg-emerald-600 border border-emerald-400 text-white shadow-lg transition transform hover:scale-105 cursor-pointer";
                } else if (res.status === "incorrect") {
                  box.className = "h-11 w-full rounded flex items-center justify-center font-mono font-bold text-xs bg-red-600 border border-red-400 text-white shadow-lg transition transform hover:scale-105 cursor-pointer";
                } else {
                  box.className = "h-11 w-full rounded flex items-center justify-center font-mono font-bold text-xs bg-amber-600 border border-amber-400 text-white shadow-lg transition transform hover:scale-105 cursor-pointer";
                }
              }

              const completedList = Object.values(evaluatedResults);
              const correctSoFar = completedList.filter((r) => r.status === "correct").length;
              statFraction.textContent = `${correctSoFar} / ${completedList.length} correct`;
              statAccuracy.textContent = `${((correctSoFar / completedList.length) * 100).toFixed(1)}%`;

            } else if (data.type === "benchmark_finished") {
              const s = data.summary;
              statStatus.textContent = "Finished";
              statStatus.className = "text-2xl font-mono font-bold text-emerald-400 mt-1";
              statAccuracy.textContent = `${s.accuracy_pct}%`;
              statFraction.textContent = `${s.correct_count} / ${s.total_samples} correct`;
              statTtft.textContent = `${s.avg_ttft_ms} ms`;
              statThroughput.textContent = `${s.avg_throughput_tps} tok/s`;
            } else if (data.type === "error") {
              alert(data.message);
              statStatus.textContent = "Error";
              statStatus.className = "text-2xl font-mono font-bold text-red-400 mt-1";
            }
          } catch (e) {
            console.error("Parse error", e);
          }
        }
      }
    } catch (err) {
      alert("Benchmark failed: " + err.message);
    } finally {
      clearInterval(timer);
      startBenchmarkBtn.disabled = false;
    }
  });

  loadEndpoints();
});