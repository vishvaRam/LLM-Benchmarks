document.addEventListener("DOMContentLoaded", () => {
  const endpointSelect = document.getElementById("endpointSelect");
  const modelInput = document.getElementById("modelInput");
  const modelChips = document.getElementById("modelChips");
  const templateChips = document.getElementById("templateChips");
  const templateBadge = document.getElementById("templateBadge");

  const stateInput = document.getElementById("stateInput");
  const questionsJsonInput = document.getElementById("questionsJsonInput");
  const runDecisionBtn = document.getElementById("runDecisionBtn");
  const btnSpinner = document.getElementById("btnSpinner");
  const btnText = document.getElementById("btnText");

  // Media Inputs & Options
  const mediaFileInput = document.getElementById("mediaFileInput");
  const imageUrl = document.getElementById("imageUrl");
  const uploadLabel = document.getElementById("uploadLabel");
  const clearImageBtn = document.getElementById("clearImageBtn");
  const pdfOptionsContainer = document.getElementById("pdfOptionsContainer");
  const pdfLimitWrapper = document.getElementById("pdfLimitWrapper");
  const pdfPageLimit = document.getElementById("pdfPageLimit");
  const pdfModeRadios = document.querySelectorAll('input[name="pdfMode"]');
  const imagePreviewContainer = document.getElementById(
    "imagePreviewContainer",
  );
  const previewThumbs = document.getElementById("previewThumbs");
  const imageMeta = document.getElementById("imageMeta");
  const pageCountBadge = document.getElementById("pageCountBadge");

  // Telemetry Tiles
  const statStatus = document.getElementById("statStatus");
  const statLatency = document.getElementById("statLatency");
  const statQuestions = document.getElementById("statQuestions");
  const statTopChoice = document.getElementById("statTopChoice");

  // Output Containers
  const decisionCardsContainer = document.getElementById(
    "decisionCardsContainer",
  );
  const rawResponse = document.getElementById("rawResponse");

  // Template Modal Elements
  const templateModal = document.getElementById("templateModal");
  const openTemplateModalBtn = document.getElementById("openTemplateModalBtn");
  const closeTemplateModalBtn = document.getElementById(
    "closeTemplateModalBtn",
  );
  const saveTemplateBtn = document.getElementById("saveTemplateBtn");
  const modalTemplatesList = document.getElementById("modalTemplatesList");
  const tplFileInput = document.getElementById("tplFileInput");
  const tplImageUrl = document.getElementById("tplImageUrl");
  const tplClearMediaBtn = document.getElementById("tplClearMediaBtn");
  const tplMediaPreview = document.getElementById("tplMediaPreview");
  const tplMediaMeta = document.getElementById("tplMediaMeta");

  let activeEndpoints = [];
  let currentImages = [];
  let activePdfFile = null;
  let tplAttachedImages = [];

  // --- Thumbnail Gallery Rendering ---
  function renderThumbnails(images) {
    if (!previewThumbs) return;
    previewThumbs.innerHTML = "";

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
      previewThumbs.appendChild(wrapper);
    });

    imagePreviewContainer.classList.remove("hidden");
    imagePreviewContainer.classList.add("flex");
  }

  // --- PDF Mode & Limit Handling ---
  pdfModeRadios.forEach((radio) => {
    radio.addEventListener("change", async (e) => {
      if (e.target.value === "limit") {
        pdfLimitWrapper.classList.remove("hidden");
        pdfLimitWrapper.classList.add("flex");
      } else {
        pdfLimitWrapper.classList.add("hidden");
        pdfLimitWrapper.classList.remove("flex");
      }
      if (activePdfFile) await convertPdf(activePdfFile);
    });
  });

  if (pdfPageLimit) {
    pdfPageLimit.addEventListener("input", async () => {
      if (activePdfFile) await convertPdf(activePdfFile);
    });
  }

  async function convertPdf(file) {
    const mode =
      document.querySelector('input[name="pdfMode"]:checked')?.value || "first";
    const limit = parseInt(pdfPageLimit?.value) || 1;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("page_mode", mode);
    formData.append("page_limit", limit);

    imageMeta.textContent = "Processing PDF pages with PyMuPDF...";
    imagePreviewContainer.classList.remove("hidden");
    imagePreviewContainer.classList.add("flex");

    try {
      const res = await fetch("/decision/process-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      currentImages = data.images || [];

      if (currentImages.length > 0) {
        imageMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        pageCountBadge.textContent = `${currentImages.length} page${currentImages.length > 1 ? "s" : ""} rendered`;
        pageCountBadge.classList.remove("hidden");
        renderThumbnails(currentImages);
      }
    } catch (err) {
      imageMeta.textContent = `PDF error: ${err.message}`;
    }
  }

  // --- File & URL Handling ---
  mediaFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      activePdfFile = file;
      imageUrl.value = "";
      pdfOptionsContainer.classList.remove("hidden");
      uploadLabel.textContent = "Change PDF";
      clearImageBtn.classList.remove("hidden");
      convertPdf(file);
    } else {
      activePdfFile = null;
      pdfOptionsContainer.classList.add("hidden");
      pageCountBadge.classList.add("hidden");
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
      pdfOptionsContainer.classList.add("hidden");
      pageCountBadge.classList.add("hidden");
      currentImages = [val];
      imageMeta.textContent = "Image URL linked";
      renderThumbnails(currentImages);
      clearImageBtn.classList.remove("hidden");
    } else {
      resetMedia();
    }
  });

  clearImageBtn.addEventListener("click", resetMedia);

  function resetMedia() {
    mediaFileInput.value = "";
    imageUrl.value = "";
    currentImages = [];
    activePdfFile = null;

    pdfOptionsContainer.classList.add("hidden");
    pdfLimitWrapper.classList.add("hidden");
    pageCountBadge.classList.add("hidden");
    renderThumbnails([]);
    clearImageBtn.classList.add("hidden");
    uploadLabel.textContent = "Upload File";
  }

  // --- Load Endpoints ---
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

      if (activeEndpoints.length > 0) {
        endpointSelect.value = activeEndpoints[0].id;
        onEndpointSelected(activeEndpoints[0].id);
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
      ep.models.forEach((m) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className =
          "text-[11px] bg-surface-700 hover:bg-surface-600 text-slate-300 px-2 py-0.5 rounded border border-surface-600 flex items-center gap-1";
        chip.innerHTML = `
          <span>${m.display_name || m.id}</span>
          ${m.is_vlm ? '<span class="text-[9px] text-purple-400 font-mono bg-purple-950/80 px-1 rounded border border-purple-800/60">vlm</span>' : ""}
        `;
        chip.onclick = () => {
          modelInput.value = m.id;
        };
        modelChips.appendChild(chip);
      });
    }
  }

  // --- Load Presets ---
  async function loadTemplates() {
    try {
      const res = await fetch("/decision/templates");
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

      if (templates.length > 0 && !stateInput.value) {
        selectTemplate(templates[0]);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }

  function selectTemplate(t) {
    stateInput.value = t.state || "";
    questionsJsonInput.value = JSON.stringify(t.questions || {}, null, 2);

    if (t.sample_images && t.sample_images.length > 0) {
      currentImages = [...t.sample_images];
      imageUrl.value = currentImages[0];
      imageMeta.textContent = `Preset evidence: ${t.name}`;
      pageCountBadge.textContent = `${currentImages.length} item(s)`;
      pageCountBadge.classList.remove("hidden");
      renderThumbnails(currentImages);
      clearImageBtn.classList.remove("hidden");
    } else {
      resetMedia();
    }

    templateBadge.classList.remove("hidden");
  }

  // --- Template Modal Management & Deletion ---
  if (openTemplateModalBtn) {
    openTemplateModalBtn.onclick = async () => {
      templateModal.classList.remove("hidden");
      await loadTemplates();
    };
  }
  if (closeTemplateModalBtn) {
    closeTemplateModalBtn.onclick = () => templateModal.classList.add("hidden");
  }

  function renderModalTemplateList(templates) {
    if (!modalTemplatesList) return;
    modalTemplatesList.innerHTML = "";

    const BUILTIN_IDS = [
      "cat_presence_choice",
      "document_clarity_noul",
      "scene_lighting_score",
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
          ${t.sample_images?.length ? '<span class="text-[9px] bg-purple-950 text-purple-400 border border-purple-800 px-1 rounded">media</span>' : ""}
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
        const id = e.currentTarget.getAttribute("data-id");
        if (!confirm(`Delete custom decision preset "${id}"?`)) return;

        const res = await fetch(
          `/decision/templates/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        if (res.ok) {
          await loadTemplates();
        } else {
          const err = await res.json();
          alert(`Error: ${err.detail || "Failed to delete preset"}`);
        }
      });
    });
  }

  // --- Attachment in Modal ---
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

        const res = await fetch("/decision/process-pdf", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        tplAttachedImages = data.images || [];
        tplMediaMeta.textContent = `PDF attached: ${file.name}`;
        tplClearMediaBtn.classList.remove("hidden");
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

  // --- Save New Custom Template ---
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
      const state = document.getElementById("tplState").value.trim();
      const rawQ = document.getElementById("tplQuestions").value.trim();

      if (!id || !name || !state || !rawQ) {
        return alert("ID, Name, State, and Questions JSON are required.");
      }

      let parsedQuestions;
      try {
        parsedQuestions = JSON.parse(rawQ);
      } catch (err) {
        return alert("Invalid Questions JSON formatting.");
      }

      const payload = {
        id,
        name,
        category,
        state,
        questions: parsedQuestions,
        sample_images: tplAttachedImages.length > 0 ? tplAttachedImages : null,
      };

      const res = await fetch("/decision/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        document.getElementById("tplId").value = "";
        document.getElementById("tplName").value = "";
        document.getElementById("tplCategory").value = "";
        document.getElementById("tplState").value = "";
        document.getElementById("tplQuestions").value = "";
        resetTplMedia();
        templateModal.classList.add("hidden");
        await loadTemplates();
      } else {
        alert("Failed to save decision preset.");
      }
    };
  }

  // --- Execute /v1/systemone Decision Call ---
  runDecisionBtn.addEventListener("click", async () => {
    const endpointId = endpointSelect.value;
    const model = modelInput.value.trim();
    const state = stateInput.value.trim();
    const questionsRaw = questionsJsonInput.value.trim();

    if (!endpointId) return alert("Select a target endpoint.");
    if (!model) return alert("Specify a model ID.");
    if (!state) return alert("State description cannot be empty.");
    if (!questionsRaw) return alert("Questions JSON cannot be empty.");

    let questionsObj;
    try {
      questionsObj = JSON.parse(questionsRaw);
    } catch (err) {
      return alert("Invalid JSON inside Questions field.");
    }

    runDecisionBtn.disabled = true;
    btnSpinner.classList.remove("hidden");
    btnText.textContent = "Evaluating Decisions...";

    statStatus.textContent = "--";
    statLatency.textContent = "--";
    statQuestions.textContent = "--";
    statTopChoice.textContent = "--";
    rawResponse.textContent =
      "Executing /v1/systemone request against endpoint...";
    decisionCardsContainer.innerHTML = "";

    const payload = {
      endpoint_id: endpointId,
      model: model,
      state: state,
      images: currentImages,
      questions: questionsObj,
    };

    try {
      const res = await fetch("/decision/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      statStatus.textContent = result.status_code || res.status;
      statLatency.textContent = result.latency_sec
        ? `${result.latency_sec}s`
        : "--";

      rawResponse.textContent = JSON.stringify(result.data, null, 2);

      if (res.ok && result.data && typeof result.data === "object") {
        renderDecisionOutcomes(result.data, questionsObj);
      } else {
        decisionCardsContainer.innerHTML = `
          <div class="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-lg text-xs font-mono">
            Error ${result.status_code}: ${result.detail || JSON.stringify(result.data)}
          </div>
        `;
      }
    } catch (err) {
      rawResponse.textContent = `Error: ${err.message}`;
      statStatus.textContent = "ERR";
    } finally {
      runDecisionBtn.disabled = false;
      btnSpinner.classList.add("hidden");
      btnText.textContent = "Execute Structured Decision";
    }
  });

  // --- Dynamic Visualization for choice, noul, and score ---
  function renderDecisionOutcomes(data, questionsInput) {
    decisionCardsContainer.innerHTML = "";

    // Target the nested 'answers' dictionary if present
    const answersData =
      data && typeof data === "object" && data.answers ? data.answers : data;

    const questionKeys = Object.keys(answersData);
    statQuestions.textContent = questionKeys.length;

    let overallTopChoice = null;
    let highestProb = -1;

    questionKeys.forEach((qKey) => {
      const item = answersData[qKey];
      if (!item || typeof item !== "object") return;

      const qSpec = questionsInput[qKey] || {};
      const qType = item.type || qSpec.type || "choice";

      const card = document.createElement("div");
      card.className =
        "bg-surface-800 border border-surface-700 rounded-lg p-4 space-y-3";

      let headerHtml = `
        <div class="flex items-center justify-between border-b border-surface-700/60 pb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-100 font-mono">${qKey}</span>
            <span class="text-[10px] font-mono uppercase bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded">${qType}</span>
          </div>
          ${item.confidence !== undefined ? `<span class="text-xs font-mono text-slate-400">Confidence: <span class="text-emerald-400 font-bold">${(item.confidence * 100).toFixed(1)}%</span></span>` : ""}
        </div>
      `;

      if (qSpec.instructions) {
        headerHtml += `<p class="text-xs text-slate-400 italic">${qSpec.instructions}</p>`;
      }

      let bodyHtml = "";

      // 1. Choice Question Type
      if (qType === "choice" || item.choice !== undefined) {
        const probs = item.probabilities || {};
        const chosen = item.choice;
        bodyHtml += `<div class="space-y-2 pt-1">`;
        Object.entries(probs).forEach(([option, prob]) => {
          const pct = (Number(prob) * 100).toFixed(1);
          const isSelected = option === chosen;
          if (Number(prob) > highestProb) {
            highestProb = Number(prob);
            overallTopChoice = `${qKey}: ${option}`;
          }

          bodyHtml += `
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="${isSelected ? "text-purple-300 font-bold flex items-center gap-1" : "text-slate-300"}">
                  ${isSelected ? "✓ " : ""}${option}
                </span>
                <span class="${isSelected ? "text-purple-300 font-bold" : "text-slate-400"}">${pct}%</span>
              </div>
              <div class="w-full bg-surface-900 rounded-full h-2 overflow-hidden border border-surface-700">
                <div class="${isSelected ? "bg-purple-500" : "bg-surface-600"} h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        });
        bodyHtml += `</div>`;
      }
      // 2. Noul Question Type (Probability of yes/true)
      else if (qType === "noul" || item.noul !== undefined) {
        const noulProb =
          item.noul !== undefined ? item.noul : item.probabilities?.yes || 0;
        const pct = (Number(noulProb) * 100).toFixed(1);
        if (Number(noulProb) > highestProb) {
          highestProb = Number(noulProb);
          overallTopChoice = `${qKey}: ${pct}%`;
        }

        bodyHtml += `
          <div class="space-y-2 pt-1">
            <div class="flex justify-between text-xs font-mono">
              <span class="text-slate-300">Affirmation (True/Yes)</span>
              <span class="text-purple-400 font-bold">${pct}%</span>
            </div>
            <div class="w-full bg-surface-900 rounded-full h-3 overflow-hidden border border-surface-700">
              <div class="bg-gradient-to-r from-surface-600 to-purple-500 h-3 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }
      // 3. Score Question Type (Expected level index & probabilities)
      else if (qType === "score" || item.score !== undefined) {
        const scoreVal =
          item.score !== undefined && item.score !== null
            ? Number(item.score).toFixed(2)
            : "--";

        // Normalize legend: can be an Array, an Object { "0": "label" }, or fallback to qSpec.criteria
        let rawLegend = item.legend || qSpec.criteria || [];
        let legendEntries = [];

        if (Array.isArray(rawLegend)) {
          legendEntries = rawLegend.map((label, idx) => ({
            index: idx,
            label: String(label),
          }));
        } else if (typeof rawLegend === "object" && rawLegend !== null) {
          legendEntries = Object.entries(rawLegend).map(([k, v]) => ({
            index: k,
            label: String(v),
          }));
        }

        // Normalize probabilities: can be an Array or an Object { "0": 0.12 }
        const rawProbs = item.probabilities || {};

        bodyHtml += `
          <div class="space-y-3 pt-1">
            <div class="flex items-center justify-between text-xs font-mono bg-surface-900 p-2.5 rounded border border-surface-700">
              <span class="text-slate-400">Expected Score:</span>
              <span class="text-purple-300 font-bold text-sm bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60">${scoreVal}</span>
            </div>
            <div class="space-y-2">
        `;

        legendEntries.forEach(({ index, label }) => {
          let prob = 0;
          if (Array.isArray(rawProbs)) {
            prob = rawProbs[Number(index)] ?? 0;
          } else if (typeof rawProbs === "object" && rawProbs !== null) {
            prob = rawProbs[index] ?? rawProbs[String(index)] ?? 0;
          }

          const pct = (Number(prob) * 100).toFixed(1);

          bodyHtml += `
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="text-slate-300"><span class="text-slate-500">[${index}]</span> ${label}</span>
                <span class="text-purple-300 font-bold">${pct}%</span>
              </div>
              <div class="w-full bg-surface-900 rounded-full h-2 overflow-hidden border border-surface-700">
                <div class="bg-purple-500 h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        });

        bodyHtml += `</div></div>`;
      }

      card.innerHTML = headerHtml + bodyHtml;
      decisionCardsContainer.appendChild(card);
    });

    if (overallTopChoice) {
      statTopChoice.textContent = overallTopChoice;
    }
  }

  loadEndpoints();
  loadTemplates();
});
