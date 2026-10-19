document.addEventListener("DOMContentLoaded", () => {
  const endpointSelect = document.getElementById("endpointSelect");
  const modelInput = document.getElementById("modelInput");
  const modelChips = document.getElementById("modelChips");
  const templateChips = document.getElementById("templateChips");
  const promptInput = document.getElementById("promptInput");
  const systemPrompt = document.getElementById("systemPrompt");
  const imageUrl = document.getElementById("imageUrl");
  const imageFileInput = document.getElementById("imageFileInput");
  const uploadLabel = document.getElementById("uploadLabel");
  const clearImageBtn = document.getElementById("clearImageBtn");
  const imagePreviewContainer = document.getElementById("imagePreviewContainer");
  const imagePreview = document.getElementById("imagePreview");
  const imageMeta = document.getElementById("imageMeta");
  const templateBadge = document.getElementById("templateBadge");

  const temperature = document.getElementById("temperature");
  const topP = document.getElementById("topP");
  const maxTokens = document.getElementById("maxTokens");
  const thinkingBudget = document.getElementById("thinkingBudget");
  const streamToggle = document.getElementById("streamToggle");
  const thinkingToggle = document.getElementById("thinkingToggle");

  const runBtn = document.getElementById("runBtn");
  const btnSpinner = document.getElementById("btnSpinner");
  const btnText = document.getElementById("btnText");

  const statTtft = document.getElementById("statTtft");
  const statThroughput = document.getElementById("statThroughput");
  const statLatency = document.getElementById("statLatency");
  const statItlAvg = document.getElementById("statItlAvg");
  const statItlPercentiles = document.getElementById("statItlPercentiles");
  const statTokens = document.getElementById("statTokens");

  const thinkingContainer = document.getElementById("thinkingContainer");
  const thinkingOutput = document.getElementById("thinkingOutput");
  const thinkingTokenCount = document.getElementById("thinkingTokenCount");
  const responseOutput = document.getElementById("responseOutput");
  const finishBadge = document.getElementById("finishBadge");
  // Modal elements
  const configModal = document.getElementById("configModal");
  const openConfigModalBtn = document.getElementById("openConfigModalBtn");
  const closeConfigModalBtn = document.getElementById("closeConfigModalBtn");
  const saveEndpointBtn = document.getElementById("saveEndpointBtn");

  // 2. Wire up the Delete Button next to the Select Dropdown
  const deleteBtn = document.getElementById('deleteEndpointBtn');

  let activeEndpoints = [];
  let selectedTemplateId = null;

  async function loadEndpoints() {
    try {
      const res = await fetch("/endpoints/");
      activeEndpoints = await res.json();
      endpointSelect.innerHTML = '<option value="" disabled selected>Select an endpoint...</option>';

      activeEndpoints.forEach((ep) => {
        const opt = document.createElement("option");
        opt.value = ep.id;
        opt.textContent = `${ep.name} (${ep.base_url})`;
        endpointSelect.appendChild(opt);
      });

      // ---> ADD THIS: Sync the modal list whenever endpoints are fetched
      renderModalEndpointList(activeEndpoints);

      if (activeEndpoints.length > 0) {
        endpointSelect.value = activeEndpoints[0].id;
        onEndpointSelected(activeEndpoints[0].id);
      } else {
        // ---> ADD THIS: Clear inputs if all endpoints were deleted
        modelInput.value = "";
        modelChips.innerHTML = "";
      }
    } catch (err) {
      console.error("Failed to load endpoints:", err);
    }
  }

  endpointSelect.addEventListener("change", (e) => {
    onEndpointSelected(e.target.value);
  });

  function onEndpointSelected(endpointId) {
    const ep = activeEndpoints.find((item) => item.id === endpointId);
    modelChips.innerHTML = "";
    if (ep && ep.models && ep.models.length > 0) {
      modelInput.value = ep.models[0].id;
      thinkingToggle.checked = !!ep.models[0].supports_thinking;
      ep.models.forEach((m) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "text-[11px] bg-surface-700 hover:bg-surface-600 text-slate-300 px-2 py-0.5 rounded border border-surface-600 flex items-center gap-1";
        chip.innerHTML = `
          <span>${m.display_name || m.id}</span>
          ${m.supports_thinking ? '<span class="text-[9px] text-purple-400 font-mono bg-purple-950/80 px-1 rounded border border-purple-800/60">think</span>' : ''}
          ${m.is_vlm ? '<span class="text-[9px] text-emerald-400 font-mono bg-emerald-950/80 px-1 rounded border border-emerald-800/60">vlm</span>' : ''}
        `;
        chip.onclick = () => {
          modelInput.value = m.id;
          thinkingToggle.checked = !!m.supports_thinking;
        };
        modelChips.appendChild(chip);
      });
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/templates/");
      const templates = await res.json();
      templateChips.innerHTML = "";

      templates.forEach((t) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "text-xs bg-surface-700 hover:bg-surface-600 border border-surface-600 px-2.5 py-1 rounded text-slate-300 transition";
        btn.textContent = t.name;
        btn.onclick = () => selectTemplate(t);
        templateChips.appendChild(btn);
      });
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }

  function selectTemplate(t) {
    selectedTemplateId = t.id;
    systemPrompt.value = t.system_prompt || "";

    let text = t.template;
    for (const [key, val] of Object.entries(t.default_variables || {})) {
      text = text.replace(new RegExp(`{${key}}`, "g"), val);
    }
    promptInput.value = text;
    
    // Only overwrite image if the preset explicitly defines a sample image
    if (t.sample_image_url) {
      imageUrl.value = t.sample_image_url;
      imagePreview.src = t.sample_image_url;
      imageMeta.textContent = "Template preset image";
      imagePreviewContainer.classList.remove("hidden");
      imagePreviewContainer.classList.add("flex");
      clearImageBtn.classList.remove("hidden");
    } else {
      resetImageInputs();
    }

    templateBadge.classList.remove("hidden");
  }

  promptInput.addEventListener("input", () => {
    selectedTemplateId = null;
    templateBadge.classList.add("hidden");
  });
  // Handle local image file upload & convert to Base64 data URI
  imageFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      imageUrl.value = base64Data;
      
      // Update preview
      imagePreview.src = base64Data;
      imageMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      imagePreviewContainer.classList.remove("hidden");
      imagePreviewContainer.classList.add("flex");
      clearImageBtn.classList.remove("hidden");
      uploadLabel.textContent = "Change Image";
    };
    reader.readAsDataURL(file);
  });

  // Handle manual typing/pasting into URL field
  imageUrl.addEventListener("input", () => {
    const val = imageUrl.value.trim();
    if (val) {
      imagePreview.src = val;
      imageMeta.textContent = "Image URL linked";
      imagePreviewContainer.classList.remove("hidden");
      imagePreviewContainer.classList.add("flex");
      clearImageBtn.classList.remove("hidden");
    } else {
      resetImageInputs();
    }
  });

  // Clear button logic
  clearImageBtn.addEventListener("click", () => {
    resetImageInputs();
  });

  function resetImageInputs() {
    imageFileInput.value = "";
    imageUrl.value = "";
    imagePreview.src = "";
    imagePreviewContainer.classList.add("hidden");
    imagePreviewContainer.classList.remove("flex");
    clearImageBtn.classList.add("hidden");
    uploadLabel.textContent = "Upload Image";
  }

  // Modal actions
  openConfigModalBtn.onclick = () => configModal.classList.remove("hidden");
  closeConfigModalBtn.onclick = () => configModal.classList.add("hidden");

  saveEndpointBtn.onclick = async () => {
    const supportsThinking = document.getElementById("epSupportsThinking")?.checked ?? true;
    const isVlm = document.getElementById("epIsVlm")?.checked ?? false;
    const contextWindow = parseInt(document.getElementById("epContextWindow")?.value) || 32768;

    const modelsList = document.getElementById("epModels").value
      .split(",")
      .map(m => m.trim())
      .filter(Boolean)
      .map(m => ({
        id: m,
        display_name: m,
        supports_thinking: supportsThinking,
        is_vlm: isVlm,
        context_window: contextWindow
      }));

    let rawBaseUrl = document.getElementById("epBaseUrl").value.trim().replace(/\/+$/, "");
    if (rawBaseUrl && !rawBaseUrl.endsWith("/v1")) {
      rawBaseUrl += "/v1";
    }

    const payload = {
      id: document.getElementById("epId").value.trim(),
      name: document.getElementById("epName").value.trim(),
      base_url: rawBaseUrl,
      api_key: document.getElementById("epApiKey").value.trim() || "none",
      models: modelsList
    };

    if (!payload.id || !payload.base_url) {
      return alert("ID and Base URL are required.");
    }

    const res = await fetch("/endpoints/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      configModal.classList.add("hidden");
      await loadEndpoints();
    } else {
      alert("Failed to save endpoint to JSON file.");
    }
  };

  async function deleteEndpoint(endpointId) {
    if (!confirm(`Are you sure you want to delete endpoint "${endpointId}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/endpoints/${encodeURIComponent(endpointId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete endpoint');
      }

      // If we just deleted the currently selected one, clear dependent fields
      if (endpointSelect.value === endpointId) {
        modelInput.value = "";
        modelChips.innerHTML = "";
      }

      // Reload dropdown and modal listing
      await loadEndpoints();
    } catch (error) {
      alert(`Error deleting endpoint: ${error.message}`);
    }
  }



if (deleteBtn && endpointSelect) {
  deleteBtn.addEventListener('click', () => {
    const selectedId = endpointSelect.value;
    if (!selectedId) {
      alert('Please select an endpoint to delete.');
      return;
    }
    deleteEndpoint(selectedId);
  });
}

// 3. (Optional) Populate Existing Endpoints inside Modal with Delete buttons
function renderModalEndpointList(endpoints) {
  const container = document.getElementById('modalEndpointsList');
  if (!container) return;

  container.innerHTML = '';
  if (endpoints.length === 0) {
    container.innerHTML = '<span class="text-xs text-slate-500">No endpoints found.</span>';
    return;
  }

  endpoints.forEach((ep) => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between bg-surface-900 border border-surface-700 px-2.5 py-1.5 rounded text-xs';
    
    const modelsBadges = (ep.models || []).map(m => `
      <span class="inline-flex items-center gap-1 bg-surface-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] border border-surface-700">
        <span>${m.display_name || m.id}</span>
        ${m.supports_thinking ? '<span class="text-purple-400 font-mono text-[9px]">think</span>' : ''}
        ${m.is_vlm ? '<span class="text-emerald-400 font-mono text-[9px]">vlm</span>' : ''}
      </span>
    `).join(' ');

    row.innerHTML = `
      <div class="truncate mr-2 flex flex-col gap-0.5">
        <div>
          <span class="text-slate-200 font-medium">${ep.name || ep.id}</span>
          <span class="text-slate-500 font-mono text-[10px]">(${ep.id})</span>
        </div>
        <div class="flex flex-wrap gap-1 mt-0.5">${modelsBadges}</div>
      </div>
      <button 
        data-id="${ep.id}" 
        class="delete-ep-btn text-slate-400 hover:text-red-400 transition px-1"
        title="Delete"
      >
        &times;
      </button>
    `;
    container.appendChild(row);
  });

  // Attach delete handlers to modal buttons
  container.querySelectorAll('.delete-ep-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      deleteEndpoint(e.currentTarget.getAttribute('data-id'));
    });
  });
}

  // Run benchmark
  runBtn.addEventListener("click", async () => {
    const endpointId = endpointSelect.value;
    const model = modelInput.value.trim();

    if (!endpointId) return alert("Please select an endpoint.");
    if (!model) return alert("Please specify a model.");

    runBtn.disabled = true;
    btnSpinner.classList.remove("hidden");
    btnText.textContent = "Benchmarking...";
    responseOutput.textContent = "";
    thinkingContainer.classList.add("hidden");
    thinkingOutput.textContent = "";
    thinkingTokenCount.textContent = "0";

    // Reset metric tiles
    statTtft.textContent = "--";
    statThroughput.textContent = "--";
    statLatency.textContent = "--";
    statItlAvg.textContent = "--";
    statItlPercentiles.textContent = "-- / --";
    statTokens.textContent = "-- / --";
    finishBadge.textContent = "";

    const activeImage = imageUrl.value.trim() || null;

    const payload = {
      endpoint_id: endpointId,
      image_url: activeImage, // <-- Pass image directly at top-level
      parameters: {
        model: model,
        stream: streamToggle.checked,
        enable_thinking: thinkingToggle.checked,
        thinking_budget_tokens: thinkingBudget.value ? parseInt(thinkingBudget.value) : null,
        temperature: parseFloat(temperature.value),
        top_p: parseFloat(topP.value),
        max_tokens: parseInt(maxTokens.value),
      },
    };

    if (selectedTemplateId) {
      payload.template_id = selectedTemplateId;
    } else {
      payload.prompt_payload = {
        system_prompt: systemPrompt.value.trim() || null,
        prompt: promptInput.value.trim(),
        image_url: activeImage,
      };
    }

    try {
      const response = await fetch("/benchmark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop(); // Retain incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === "thinking") {
              thinkingContainer.classList.remove("hidden");
              thinkingContainer.open = true;
              thinkingOutput.textContent += data.delta;
              thinkingTokenCount.textContent = (parseInt(thinkingTokenCount.textContent) || 0) + 1;
            } else if (data.type === "content") {
              responseOutput.textContent += data.delta;
            } else if (data.type === "metrics") {
              const m = data.metrics;
              statTtft.textContent = `${m.ttft_ms} ms`;
              statThroughput.textContent = `${m.throughput_tokens_per_sec}`;
              statLatency.textContent = `${(m.total_latency_ms / 1000).toFixed(2)} s`;
              statItlAvg.textContent = `${m.inter_token_latency_avg_ms} ms`;
              statItlPercentiles.textContent = `${m.inter_token_latency_p50_ms} / ${m.inter_token_latency_p95_ms}`;
              statTokens.textContent = `${m.output_tokens} / ${m.thinking_tokens}`;
              finishBadge.textContent = `finish_reason: ${m.finish_reason || "completed"}`;
              thinkingTokenCount.textContent = m.thinking_tokens;
            } else if (data.type === "error") {
              responseOutput.textContent = `Error: ${data.message}`;
            }
          } catch (parseErr) {
            console.error("SSE parse error:", parseErr, jsonStr);
          }
        }
      }
    } catch (err) {
      responseOutput.textContent = `Error: ${err.message}`;
    } finally {
      runBtn.disabled = false;
      btnSpinner.classList.add("hidden");
      btnText.textContent = "Execute Benchmark";
    }
  });

  loadEndpoints();
  loadTemplates();
});