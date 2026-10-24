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
  const imagePreviewContainer = document.getElementById(
    "imagePreviewContainer",
  );
  const previewThumbs = document.getElementById("previewThumbs");
  const imageMeta = document.getElementById("imageMeta");
  const templateBadge = document.getElementById("templateBadge");
  const pageCountBadge = document.getElementById("pageCountBadge");

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
  const deleteBtn = document.getElementById("deleteEndpointBtn");

  // PDF controls & State
  let currentImages = []; // Array of base64 data URIs
  let activePdfFile = null;
  const pdfOptionsContainer = document.getElementById("pdfOptionsContainer");
  const pdfLimitWrapper = document.getElementById("pdfLimitWrapper");
  const pdfPageLimit = document.getElementById("pdfPageLimit");
  const pdfModeRadios = document.querySelectorAll('input[name="pdfMode"]');

  // Template Modal Elements
  const templateModal = document.getElementById("templateModal");
  const openTemplateModalBtn = document.getElementById("openTemplateModalBtn");
  const closeTemplateModalBtn = document.getElementById(
    "closeTemplateModalBtn",
  );
  const saveTemplateBtn = document.getElementById("saveTemplateBtn");
  const modalTemplatesList = document.getElementById("modalTemplatesList");

  let activeEndpoints = [];
  let selectedTemplateId = null;

  // Template Sample Media Attachment Elements
  let tplAttachedImages = [];
  const tplFileInput = document.getElementById("tplFileInput");
  const tplImageUrl = document.getElementById("tplImageUrl");
  const tplUploadLabel = document.getElementById("tplUploadLabel");
  const tplClearMediaBtn = document.getElementById("tplClearMediaBtn");
  const tplMediaPreview = document.getElementById("tplMediaPreview");
  const tplMediaMeta = document.getElementById("tplMediaMeta");

  const pdfDpiSelect = document.getElementById("pdfDpiSelect");

  // --- Image & PDF Thumbnail Renderer ---
  function renderThumbnails(images) {
    const container = document.getElementById("previewThumbs");
    if (!container) return;
    container.innerHTML = "";

    if (!images || images.length === 0) {
      imagePreviewContainer.classList.add("hidden");
      imagePreviewContainer.classList.remove("flex");
      return;
    }

    images.forEach((imgSrc, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "flex flex-col items-center gap-1 shrink-0";
      wrapper.innerHTML = `
        <img src="${imgSrc}" alt="Page ${idx + 1}" class="h-20 w-auto max-w-[120px] object-contain rounded border border-surface-600 bg-surface-950 shadow-sm" />
        ${images.length > 1 ? `<span class="text-[9px] text-slate-400 font-mono">P. ${idx + 1}</span>` : ""}
      `;
      container.appendChild(wrapper);
    });

    imagePreviewContainer.classList.remove("hidden");
    imagePreviewContainer.classList.add("flex");
  }

  // --- PDF Segmented Radio & Limits ---
  pdfModeRadios.forEach((radio) => {
    radio.addEventListener("change", async (e) => {
      if (e.target.value === "limit") {
        if (pdfLimitWrapper) {
          pdfLimitWrapper.classList.remove("hidden");
          pdfLimitWrapper.classList.add("flex");
        }
      } else {
        if (pdfLimitWrapper) {
          pdfLimitWrapper.classList.add("hidden");
          pdfLimitWrapper.classList.remove("flex");
        }
      }
      if (activePdfFile) await convertPdf(activePdfFile);
    });
  });

  if (pdfPageLimit) {
    pdfPageLimit.addEventListener("input", async () => {
      if (activePdfFile) await convertPdf(activePdfFile);
    });
  }

  if (pdfDpiSelect) {
    pdfDpiSelect.addEventListener("change", async () => {
      if (activePdfFile) await convertPdf(activePdfFile);
    });
  }

  async function convertPdf(file) {
    const mode =
      document.querySelector('input[name="pdfMode"]:checked')?.value || "first";
    const limit = parseInt(pdfPageLimit?.value) || 1;
    const dpi = parseInt(pdfDpiSelect?.value) || 250;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("page_mode", mode);
    formData.append("page_limit", limit);
    formData.append("dpi", dpi);

    imageMeta.textContent = "Processing PDF pages with PyMuPDF...";
    imagePreviewContainer.classList.remove("hidden");
    imagePreviewContainer.classList.add("flex");

    try {
      const res = await fetch("/benchmark/process-pdf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      currentImages = data.images || [];

      if (currentImages.length > 0) {
        imageMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        if (pageCountBadge) {
          pageCountBadge.textContent = `${currentImages.length} page${currentImages.length > 1 ? "s" : ""} rendered`;
          pageCountBadge.classList.remove("hidden");
        }
        renderThumbnails(currentImages);
      }
    } catch (err) {
      imageMeta.textContent = `PDF error: ${err.message}`;
    }
  }

  // --- Template Modal Open / Close & Fresh Loading ---
  if (openTemplateModalBtn) {
    openTemplateModalBtn.onclick = async () => {
      templateModal.classList.remove("hidden");
      await loadTemplates();
    };
  }
  if (closeTemplateModalBtn) {
    closeTemplateModalBtn.onclick = () => templateModal.classList.add("hidden");
  }

  // --- Template Attachment Handling ---
  if (tplFileInput) {
    tplFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("page_mode", "first");
        formData.append("page_limit", 1);

        tplMediaMeta.textContent = "Processing PDF sample...";
        tplMediaPreview.classList.remove("hidden");

        try {
          const res = await fetch("/benchmark/process-pdf", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          tplAttachedImages = data.images || [];
          tplMediaMeta.textContent = `PDF attached: ${file.name} (${tplAttachedImages.length} page)`;
          tplClearMediaBtn.classList.remove("hidden");
        } catch (err) {
          tplMediaMeta.textContent = `PDF error: ${err.message}`;
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          tplAttachedImages = [event.target.result];
          tplMediaMeta.textContent = `Image attached: ${file.name}`;
          tplMediaPreview.classList.remove("hidden");
          tplClearMediaBtn.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (tplImageUrl) {
    tplImageUrl.addEventListener("input", () => {
      const val = tplImageUrl.value.trim();
      if (val) {
        tplAttachedImages = [val];
        tplMediaMeta.textContent = "Image URL linked";
        tplMediaPreview.classList.remove("hidden");
        tplClearMediaBtn.classList.remove("hidden");
      } else {
        resetTplMedia();
      }
    });
  }

  if (tplClearMediaBtn) {
    tplClearMediaBtn.addEventListener("click", resetTplMedia);
  }

  function resetTplMedia() {
    if (tplFileInput) tplFileInput.value = "";
    if (tplImageUrl) tplImageUrl.value = "";
    tplAttachedImages = [];
    if (tplMediaPreview) tplMediaPreview.classList.add("hidden");
    if (tplClearMediaBtn) tplClearMediaBtn.classList.add("hidden");
  }

  // --- Load Templates & Render Chips ---
  async function loadTemplates() {
    try {
      const res = await fetch("/templates/");
      const templates = await res.json();
      templateChips.innerHTML = "";

      templates.forEach((t) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "text-xs bg-surface-700 hover:bg-surface-600 border border-surface-600 px-2.5 py-1 rounded text-slate-300 transition";
        btn.textContent = t.name;
        btn.onclick = () => selectTemplate(t);
        templateChips.appendChild(btn);
      });

      renderModalTemplateList(templates);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }

  // --- Render Modal Template List (Delete Button Only For User Presets) ---
  function renderModalTemplateList(templates) {
    if (!modalTemplatesList) return;
    modalTemplatesList.innerHTML = "";

    if (!templates || templates.length === 0) {
      modalTemplatesList.innerHTML =
        '<span class="text-xs text-slate-500">No presets found.</span>';
      return;
    }

    const BUILTIN_IDS = [
      "vlm_cat_detection",
      "vlm_spatial_reasoning",
      "vlm_multilingual_ocr",
      "vlm_document_summary",
      "vlm_data_extraction",
      "vlm_security_audit",
      "hard_math",
      "html_page",
      "system_design",
      "long_form_guide",
    ];

    templates.forEach((t) => {
      const isUserPreset = !BUILTIN_IDS.includes(t.id);
      const row = document.createElement("div");
      row.className =
        "flex items-center justify-between bg-surface-900 border border-surface-700 px-3 py-2 rounded text-xs";

      row.innerHTML = `
        <div class="truncate mr-2 flex items-center gap-2">
          <span class="text-slate-200 font-medium">${t.name}</span>
          <span class="text-slate-500 font-mono text-[10px]">(${t.category || "Custom"})</span>
          ${t.sample_images?.length || t.sample_image_url ? '<span class="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded">media</span>' : ""}
        </div>
        ${
          isUserPreset
            ? `
          <button data-id="${t.id}" class="delete-tpl-btn text-slate-400 hover:text-red-400 transition font-bold text-base px-1.5 leading-none" title="Delete custom preset">&times;</button>
        `
            : `
          <span class="text-[10px] text-slate-600 font-mono">default</span>
        `
        }
      `;
      modalTemplatesList.appendChild(row);
    });

    modalTemplatesList.querySelectorAll(".delete-tpl-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute("data-id");
        if (!confirm(`Are you sure you want to delete custom preset "${id}"?`))
          return;

        try {
          const res = await fetch(`/templates/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          if (res.ok) {
            await loadTemplates();
          } else {
            const err = await res.json();
            alert(`Error: ${err.detail || "Failed to delete preset"}`);
          }
        } catch (err) {
          alert(`Network error: ${err.message}`);
        }
      });
    });
  }

  // --- Save Preset to data/templates.json ---
  if (saveTemplateBtn) {
    saveTemplateBtn.onclick = async () => {
      const id = document
        .getElementById("tplId")
        .value.trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
      const name = document.getElementById("tplName").value.trim();
      const category =
        document.getElementById("tplCategory").value.trim() || "Custom";
      const system_prompt =
        document.getElementById("tplSystemPrompt").value.trim() || null;
      const template = document.getElementById("tplTemplate").value.trim();

      if (!id || !name || !template) {
        return alert("ID, Name, and Template prompt are required.");
      }

      const payload = {
        id,
        name,
        category,
        system_prompt,
        template,
        sample_image_url: tplAttachedImages[0] || null,
        sample_images: tplAttachedImages.length > 0 ? tplAttachedImages : null,
        default_variables: {},
      };

      const res = await fetch("/templates/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        document.getElementById("tplId").value = "";
        document.getElementById("tplName").value = "";
        document.getElementById("tplCategory").value = "";
        document.getElementById("tplSystemPrompt").value = "";
        document.getElementById("tplTemplate").value = "";
        resetTplMedia();
        templateModal.classList.add("hidden");
        await loadTemplates();
      } else {
        alert("Failed to save preset to JSON.");
      }
    };
  }

  // --- Select Preset ---
  function selectTemplate(t) {
    selectedTemplateId = t.id;
    systemPrompt.value = t.system_prompt || "";

    let text = t.template;
    for (const [key, val] of Object.entries(t.default_variables || {})) {
      text = text.replace(new RegExp(`{${key}}`, "g"), val);
    }
    promptInput.value = text;

    const mediaList =
      t.sample_images || (t.sample_image_url ? [t.sample_image_url] : []);
    if (mediaList.length > 0) {
      currentImages = mediaList;
      imageUrl.value = mediaList[0];
      imageMeta.textContent = `Preset media: ${t.name}`;
      if (pageCountBadge) {
        pageCountBadge.textContent = `${mediaList.length} page(s)`;
        pageCountBadge.classList.remove("hidden");
      }
      renderThumbnails(currentImages);
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

  // --- Main Playground File Input (Image / PDF) ---
  imageFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      activePdfFile = file;
      imageUrl.value = "";
      if (pdfOptionsContainer) pdfOptionsContainer.classList.remove("hidden");
      uploadLabel.textContent = "Change PDF";
      clearImageBtn.classList.remove("hidden");
      convertPdf(file);
    } else {
      activePdfFile = null;
      if (pdfOptionsContainer) pdfOptionsContainer.classList.add("hidden");
      if (pageCountBadge) pageCountBadge.classList.add("hidden");
      uploadLabel.textContent = "Change Image";

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        imageUrl.value = base64Data;
        currentImages = [base64Data];
        imageMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        renderThumbnails(currentImages);
        clearImageBtn.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    }
  });

  imageUrl.addEventListener("input", () => {
    const val = imageUrl.value.trim();
    if (val) {
      activePdfFile = null;
      if (pdfOptionsContainer) pdfOptionsContainer.classList.add("hidden");
      if (pageCountBadge) pageCountBadge.classList.add("hidden");
      currentImages = [val];
      imageMeta.textContent = "Image URL linked";
      renderThumbnails(currentImages);
      clearImageBtn.classList.remove("hidden");
    } else {
      resetImageInputs();
    }
  });

  clearImageBtn.addEventListener("click", () => {
    resetImageInputs();
  });

  function resetImageInputs() {
    imageFileInput.value = "";
    imageUrl.value = "";
    currentImages = [];
    activePdfFile = null;

    if (pdfOptionsContainer) pdfOptionsContainer.classList.add("hidden");
    if (pdfLimitWrapper) {
      pdfLimitWrapper.classList.add("hidden");
      pdfLimitWrapper.classList.remove("flex");
    }
    if (pageCountBadge) pageCountBadge.classList.add("hidden");

    renderThumbnails([]);
    clearImageBtn.classList.add("hidden");
    uploadLabel.textContent = "Upload Image or PDF";
  }

  // --- Endpoints Configuration Modal ---
  async function loadEndpoints() {
    try {
      const res = await fetch("/endpoints/");
      activeEndpoints = await res.json();
      endpointSelect.innerHTML =
        '<option value="" disabled selected>Select an endpoint...</option>';

      activeEndpoints.forEach((ep) => {
        const opt = document.createElement("option");
        opt.value = ep.id;
        opt.textContent = `${ep.name} (${ep.base_url})`;
        endpointSelect.appendChild(opt);
      });

      renderModalEndpointList(activeEndpoints);

      if (activeEndpoints.length > 0) {
        endpointSelect.value = activeEndpoints[0].id;
        onEndpointSelected(activeEndpoints[0].id);
      } else {
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
        chip.className =
          "text-[11px] bg-surface-700 hover:bg-surface-600 text-slate-300 px-2 py-0.5 rounded border border-surface-600 flex items-center gap-1";
        chip.innerHTML = `
          <span>${m.display_name || m.id}</span>
          ${m.supports_thinking ? '<span class="text-[9px] text-purple-400 font-mono bg-purple-950/80 px-1 rounded border border-purple-800/60">think</span>' : ""}
          ${m.is_vlm ? '<span class="text-[9px] text-emerald-400 font-mono bg-emerald-950/80 px-1 rounded border border-emerald-800/60">vlm</span>' : ""}
        `;
        chip.onclick = () => {
          modelInput.value = m.id;
          thinkingToggle.checked = !!m.supports_thinking;
        };
        modelChips.appendChild(chip);
      });
    }
  }

  openConfigModalBtn.onclick = () => configModal.classList.remove("hidden");
  closeConfigModalBtn.onclick = () => configModal.classList.add("hidden");

  saveEndpointBtn.onclick = async () => {
    const supportsThinking =
      document.getElementById("epSupportsThinking")?.checked ?? true;
    const isVlm = document.getElementById("epIsVlm")?.checked ?? false;
    const contextWindow =
      parseInt(document.getElementById("epContextWindow")?.value) || 32768;

    const modelsList = document
      .getElementById("epModels")
      .value.split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .map((m) => ({
        id: m,
        display_name: m,
        supports_thinking: supportsThinking,
        is_vlm: isVlm,
        context_window: contextWindow,
      }));

    let rawBaseUrl = document
      .getElementById("epBaseUrl")
      .value.trim()
      .replace(/\/+$/, "");
    if (rawBaseUrl && !rawBaseUrl.endsWith("/v1")) {
      rawBaseUrl += "/v1";
    }

    const payload = {
      id: document.getElementById("epId").value.trim(),
      name: document.getElementById("epName").value.trim(),
      base_url: rawBaseUrl,
      api_key: document.getElementById("epApiKey").value.trim() || "none",
      models: modelsList,
    };

    if (!payload.id || !payload.base_url) {
      return alert("ID and Base URL are required.");
    }

    const res = await fetch("/endpoints/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete endpoint");
      }

      if (endpointSelect.value === endpointId) {
        modelInput.value = "";
        modelChips.innerHTML = "";
      }

      await loadEndpoints();
    } catch (error) {
      alert(`Error deleting endpoint: ${error.message}`);
    }
  }

  if (deleteBtn && endpointSelect) {
    deleteBtn.addEventListener("click", () => {
      const selectedId = endpointSelect.value;
      if (!selectedId) {
        alert("Please select an endpoint to delete.");
        return;
      }
      deleteEndpoint(selectedId);
    });
  }

  function renderModalEndpointList(endpoints) {
    const container = document.getElementById("modalEndpointsList");
    if (!container) return;

    container.innerHTML = "";
    if (endpoints.length === 0) {
      container.innerHTML =
        '<span class="text-xs text-slate-500">No endpoints found.</span>';
      return;
    }

    endpoints.forEach((ep) => {
      const row = document.createElement("div");
      row.className =
        "flex items-center justify-between bg-surface-900 border border-surface-700 px-2.5 py-1.5 rounded text-xs";

      const modelsBadges = (ep.models || [])
        .map(
          (m) => `
        <span class="inline-flex items-center gap-1 bg-surface-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] border border-surface-700">
          <span>${m.display_name || m.id}</span>
          ${m.supports_thinking ? '<span class="text-purple-400 font-mono text-[9px]">think</span>' : ""}
          ${m.is_vlm ? '<span class="text-emerald-400 font-mono text-[9px]">vlm</span>' : ""}
        </span>
      `,
        )
        .join(" ");

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

    container.querySelectorAll(".delete-ep-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        deleteEndpoint(e.currentTarget.getAttribute("data-id"));
      });
    });
  }

  // --- Execute Benchmark ---
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
      image_url: currentImages[0] || activeImage || null,
      image_urls:
        currentImages.length > 0
          ? currentImages
          : activeImage
            ? [activeImage]
            : [],
      parameters: {
        model: model,
        stream: streamToggle.checked,
        enable_thinking: thinkingToggle.checked,
        thinking_budget_tokens: thinkingBudget.value
          ? parseInt(thinkingBudget.value)
          : null,
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
        image_url: payload.image_url,
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
        buffer = lines.pop();

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
              thinkingTokenCount.textContent =
                (parseInt(thinkingTokenCount.textContent) || 0) + 1;
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

  // Initial loads
  loadEndpoints();
  loadTemplates();
});
