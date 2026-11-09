const { entrypoints } = require("uxp");
const { app, core, imaging, constants, action } = require("photoshop");

function $(id) {
  return document.getElementById(id);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clamp8(v) {
  return clamp(Math.round(v), 0, 255);
}

function fieldValue(el) {
  if (!el) return "";
  if (el.value !== undefined && el.value !== null) return String(el.value);
  return String(el.getAttribute("value") || "");
}

function setFieldValue(el, value) {
  if (!el) return;
  const next = String(value);
  el.value = next;
  try {
    el.setAttribute("value", next);
  } catch (err) {
    // Attribute write can fail on some Spectrum hosts; property is enough.
  }
}

function setStatus(msg, tone = "idle") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg;
  el.dataset.tone = tone;
}

function normalizeHex(hex) {
  let s = String(hex || "").trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error("Enter a hex color like #FFFFFF.");
  }
  return s.toUpperCase();
}

function tryParseCompleteHex(hex) {
  try {
    const h = normalizeHex(hex);
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16),
      hex: h
    };
  } catch (err) {
    return null;
  }
}

function rgbToHex(r, g, b) {
  const rr = clamp8(r).toString(16).padStart(2, "0");
  const gg = clamp8(g).toString(16).padStart(2, "0");
  const bb = clamp8(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`.toUpperCase();
}

function smoothstep01(x) {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

function getDocModeName(mode) {
  const DM = constants.DocumentMode;
  if (mode === DM.RGB) return "RGB";
  if (mode === DM.CMYK) return "CMYK";
  if (mode === DM.GRAYSCALE) return "Grayscale";
  if (mode === DM.LAB) return "Lab";
  if (mode === DM.INDEXEDCOLOR) return "Indexed Color";
  if (mode === DM.BITMAP) return "Bitmap";
  if (mode === DM.DUOTONE) return "Duotone";
  if (mode === DM.MULTICHANNEL) return "Multichannel";
  return String(mode);
}

function isSupportedDocMode(mode) {
  return mode === constants.DocumentMode.RGB;
}

function isSupportedLayer(layer) {
  return !!layer &&
    !layer.isBackgroundLayer &&
    layer.kind === constants.LayerKind.NORMAL &&
    !layer.allLocked;
}

function getTolerancePct() {
  return clamp(Number(fieldValue($("toleranceRange")) || 0), 0, 100);
}

function updateRangeMeta() {
  const pct = getTolerancePct();
  const pretty = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  $("rangeMeta").textContent = `${pretty}%`;
}

function syncRGBFromHex(forceNormalize = false) {
  const parsed = tryParseCompleteHex(fieldValue($("hexInput")));
  if (!parsed) {
    if (forceNormalize) {
      throw new Error("Enter a hex color like #FFFFFF.");
    }
    return false;
  }

  setFieldValue($("rInput"), parsed.r);
  setFieldValue($("gInput"), parsed.g);
  setFieldValue($("bInput"), parsed.b);
  if (forceNormalize) {
    setFieldValue($("hexInput"), parsed.hex);
  }
  return true;
}

function syncHexFromRGB() {
  const r = clamp(Number(fieldValue($("rInput")) || 0), 0, 255);
  const g = clamp(Number(fieldValue($("gInput")) || 0), 0, 255);
  const b = clamp(Number(fieldValue($("bInput")) || 0), 0, 255);
  setFieldValue($("rInput"), clamp8(r));
  setFieldValue($("gInput"), clamp8(g));
  setFieldValue($("bInput"), clamp8(b));
  setFieldValue($("hexInput"), rgbToHex(r, g, b));
}

function getRGBTargetFromUI(strict = false) {
  if (strict) syncRGBFromHex(true);
  return {
    r: clamp8(Number(fieldValue($("rInput")) || 0)),
    g: clamp8(Number(fieldValue($("gInput")) || 0)),
    b: clamp8(Number(fieldValue($("bInput")) || 0))
  };
}

function applyTargetRGB(r, g, b) {
  setFieldValue($("rInput"), clamp8(r));
  setFieldValue($("gInput"), clamp8(g));
  setFieldValue($("bInput"), clamp8(b));
  setFieldValue($("hexInput"), rgbToHex(r, g, b));
  updateMiniSwatch();
}

function updateMiniSwatch() {
  const swatch = $("miniSwatch");
  try {
    const parsed = tryParseCompleteHex(fieldValue($("hexInput")));
    const t = parsed || getRGBTargetFromUI(false);
    swatch.style.background = `rgb(${t.r}, ${t.g}, ${t.b})`;
  } catch (err) {
    swatch.style.background = "#808080";
  }
}

function getUIOptions() {
  const tolerancePct = getTolerancePct();
  const target = getRGBTargetFromUI(true);
  return {
    tolerancePct,
    targetRGB: { r: target.r, g: target.g, b: target.b },
    targetLabel: rgbToHex(target.r, target.g, target.b)
  };
}

function applyForegroundColorToUI() {
  const fg = app.foregroundColor;
  if (!fg) {
    throw new Error("Could not read Photoshop foreground color.");
  }
  applyTargetRGB(fg.rgb.red, fg.rgb.green, fg.rgb.blue);
}

function setReadyState(state, title, detail) {
  const box = $("readyBox");
  box.dataset.state = state;
  $("readyTitle").textContent = title;
  $("readyDetail").textContent = detail;
}

async function refreshDocInfo() {
  const runBtn = $("runBtn");

  try {
    const doc = app.activeDocument;
    if (!doc) {
      setReadyState(
        "blocked",
        "No document open",
        "Open an RGB Photoshop document to begin."
      );
      runBtn.disabled = true;
      return;
    }

    const modeName = getDocModeName(doc.mode);
    const layers = doc.activeLayers;

    if (!isSupportedDocMode(doc.mode)) {
      setReadyState(
        "blocked",
        `${modeName} documents are not supported`,
        "Convert the document to RGB Color, then select one unlocked pixel layer."
      );
      runBtn.disabled = true;
      return;
    }

    if (!layers || layers.length === 0) {
      setReadyState(
        "blocked",
        "Select a layer",
        "Choose one unlocked normal pixel layer."
      );
      runBtn.disabled = true;
      return;
    }

    if (layers.length > 1) {
      setReadyState(
        "blocked",
        "Too many layers selected",
        "Select exactly one unlocked normal pixel layer."
      );
      runBtn.disabled = true;
      return;
    }

    const layer = layers[0];
    if (!isSupportedLayer(layer)) {
      const why = layer.isBackgroundLayer
        ? "Duplicate the Background layer into a normal layer first."
        : "Use an unlocked normal pixel layer — not a group, smart object, text, or adjustment.";
      setReadyState("blocked", `“${layer.name}” can’t be used`, why);
      runBtn.disabled = true;
      return;
    }

    setReadyState(
      "ready",
      "Ready",
      `${modeName} · ${layer.name}`
    );
    runBtn.disabled = false;
  } catch (err) {
    setReadyState(
      "blocked",
      "Could not inspect document",
      String(err.message || err)
    );
    runBtn.disabled = true;
  }
}

function computeRecoveredAlpha01(pixel, target) {
  let a = 0;

  for (let i = 0; i < 3; i++) {
    const pv = pixel[i];
    const tv = target[i];
    let need = 0;

    if (pv > tv && tv < 255) {
      need = (pv - tv) / (255 - tv);
    } else if (pv < tv && tv > 0) {
      need = (tv - pv) / tv;
    }

    if (need > a) a = need;
  }

  return clamp(a, 0, 1);
}

function getToleranceMatch(pixel, targetRGB, tolerancePct) {
  const tol = clamp(Number(tolerancePct || 0), 0, 100);
  if (tol <= 0) return 0;

  const dist = Math.max(
    Math.abs(pixel[0] - targetRGB.r),
    Math.abs(pixel[1] - targetRGB.g),
    Math.abs(pixel[2] - targetRGB.b)
  );

  const radius = (tol / 100) * 255;
  if (radius <= 0 || dist >= radius) return 0;

  return smoothstep01(1 - (dist / radius));
}

function unmixFromTargetRGB(r, g, b, srcAlpha, targetRGB, options) {
  if (srcAlpha <= 0) {
    return { changed: false, rgb: [0, 0, 0], alpha: 0 };
  }

  const original = [r, g, b];
  const match = getToleranceMatch(original, targetRGB, options.tolerancePct);
  const effective = match > 0
    ? [
      r + (targetRGB.r - r) * match,
      g + (targetRGB.g - g) * match,
      b + (targetRGB.b - b) * match
    ]
    : original;

  const target = [targetRGB.r, targetRGB.g, targetRGB.b];
  const recoveredAlpha01 = computeRecoveredAlpha01(effective, target);

  if (recoveredAlpha01 <= 0) {
    return { changed: true, rgb: [0, 0, 0], alpha: 0 };
  }

  const nr = clamp8((effective[0] - target[0] * (1 - recoveredAlpha01)) / recoveredAlpha01);
  const ng = clamp8((effective[1] - target[1] * (1 - recoveredAlpha01)) / recoveredAlpha01);
  const nb = clamp8((effective[2] - target[2] * (1 - recoveredAlpha01)) / recoveredAlpha01);
  const na = clamp8(srcAlpha * recoveredAlpha01);

  if (na === 0) {
    return { changed: true, rgb: [0, 0, 0], alpha: 0 };
  }

  const changed = match > 0 || nr !== r || ng !== g || nb !== b || na !== srcAlpha;
  return { changed, rgb: [nr, ng, nb], alpha: na };
}

async function runColorUnmix() {
  const doc = app.activeDocument;
  if (!doc) throw new Error("No document is open.");
  if (!isSupportedDocMode(doc.mode)) throw new Error("Convert the document to RGB Color first.");

  const layers = doc.activeLayers;
  if (!layers || layers.length !== 1) throw new Error("Select exactly one layer.");

  const src = layers[0];
  if (!isSupportedLayer(src)) {
    throw new Error("Select one unlocked normal pixel layer. Not a group, smart object, text, adjustment, or Background layer.");
  }

  const options = getUIOptions();

  await core.executeAsModal(async (executionContext) => {
    let psImage;
    let outImage;

    try {
      executionContext.reportProgress({ value: 0.02, commandName: "Color Unmix" });
      setStatus("Duplicating layer…", "busy");
      const dup = await src.duplicate();
      dup.name = `${src.name}_unmix`;

      executionContext.reportProgress({ value: 0.08, commandName: "Color Unmix" });
      setStatus("Reading pixels…", "busy");
      const imageObj = await imaging.getPixels({
        documentID: doc.id,
        layerID: dup.id,
        colorSpace: "RGB",
        componentSize: 8
      });

      psImage = imageObj.imageData;
      const sourceBounds = imageObj.sourceBounds;
      const pixelData = await psImage.getData({ chunky: true });

      const width = psImage.width;
      const height = psImage.height;
      const components = psImage.components;

      if (components !== 3 && components !== 4) {
        throw new Error(`Unsupported pixel format with ${components} components.`);
      }

      const out = new Uint8Array(width * height * 4);
      const totalPixels = width * height;
      let processedPixels = 0;
      let changedPixels = 0;

      setStatus("Removing color…", "busy");

      for (let i = 0, j = 0; i < pixelData.length; i += components, j += 4) {
        if (executionContext.isCancelled) return;

        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];
        const a = components === 4 ? pixelData[i + 3] : 255;

        const result = unmixFromTargetRGB(r, g, b, a, options.targetRGB, options);
        if (result.changed) changedPixels++;

        out[j] = result.changed ? result.rgb[0] : r;
        out[j + 1] = result.changed ? result.rgb[1] : g;
        out[j + 2] = result.changed ? result.rgb[2] : b;
        out[j + 3] = result.changed ? result.alpha : a;

        processedPixels++;
        if (processedPixels % 50000 === 0) {
          const value = 0.1 + (processedPixels / totalPixels) * 0.75;
          executionContext.reportProgress({ value, commandName: "Color Unmix" });
        }
      }

      executionContext.reportProgress({ value: 0.9, commandName: "Color Unmix" });
      setStatus("Writing pixels…", "busy");

      outImage = await imaging.createImageDataFromBuffer(out, {
        width,
        height,
        components: 4,
        colorSpace: "RGB",
        colorProfile: psImage.colorProfile || "sRGB IEC61966-2.1"
      });

      await imaging.putPixels({
        documentID: doc.id,
        layerID: dup.id,
        imageData: outImage,
        replace: true,
        targetBounds: {
          left: sourceBounds.left,
          top: sourceBounds.top
        },
        commandName: "Color Unmix"
      });

      executionContext.reportProgress({ value: 1, commandName: "Color Unmix" });
      setStatus(
        `Done. Created “${dup.name}” · ${changedPixels.toLocaleString()} pixels changed · ${options.targetLabel} @ ${options.tolerancePct}%`,
        "ok"
      );
    } finally {
      if (psImage) psImage.dispose();
      if (outImage) outImage.dispose();
    }
  }, { commandName: "Color Unmix" });
}

async function maskFromTransparencyOnly() {
  const doc = app.activeDocument;
  if (!doc) throw new Error("No document is open.");

  const layers = doc.activeLayers;
  if (!layers || layers.length !== 1) throw new Error("Select exactly one layer.");

  const src = layers[0];
  if (!src || src.allLocked) throw new Error("Select one unlocked layer.");
  if (src.isBackgroundLayer) throw new Error("Background layer is not supported for mask from transparency.");

  await core.executeAsModal(async () => {
    setStatus("Building layer mask from transparency…", "busy");
    await action.batchPlay(
      [
        {
          _obj: "make",
          at: { _enum: "channel", _ref: "channel", _value: "mask" },
          new: { _class: "channel" },
          using: { _enum: "userMaskEnabled", _value: "transparency" }
        }
      ],
      { synchronousExecution: true }
    );
    setStatus(`Mask applied to “${src.name}”.`, "ok");
  }, { commandName: "Mask from Transparency" });
}

function bindDocListeners() {
  if (document.body.dataset.docListening) return;
  document.body.dataset.docListening = "1";

  try {
    action.addNotificationListener(
      [
        { event: "select" },
        { event: "open" },
        { event: "close" },
        { event: "new" },
        { event: "make" },
        { event: "duplicate" },
        { event: "delete" },
        { event: "modeChange" },
        { event: "historyStateChanged" }
      ],
      () => {
        refreshDocInfo().catch(() => {});
      }
    );
  } catch (err) {
    // Notification API availability varies by host version; Refresh still works.
  }
}

function bindUI() {
  if (document.body.dataset.bound) return;
  document.body.dataset.bound = "1";

  $("hexInput").addEventListener("input", () => {
    const ok = syncRGBFromHex(false);
    updateMiniSwatch();
    if (!ok) setStatus("Keep typing a hex color…", "busy");
  });

  $("hexInput").addEventListener("change", () => {
    try {
      syncRGBFromHex(true);
      updateMiniSwatch();
      setStatus("Target color updated.", "idle");
    } catch (err) {
      setStatus(String(err.message || err), "error");
    }
  });

  ["rInput", "gInput", "bInput"].forEach((id) => {
    $(id).addEventListener("input", () => {
      syncHexFromRGB();
      updateMiniSwatch();
    });
    $(id).addEventListener("change", () => {
      syncHexFromRGB();
      updateMiniSwatch();
    });
  });

  $("toleranceRange").addEventListener("input", updateRangeMeta);
  $("toleranceRange").addEventListener("change", updateRangeMeta);

  $("useFgBtn").addEventListener("click", () => {
    try {
      applyForegroundColorToUI();
      setStatus("Loaded Photoshop foreground color.", "ok");
    } catch (err) {
      setStatus(String(err.message || err), "error");
    }
  });

  document.querySelectorAll(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parsed = tryParseCompleteHex(btn.dataset.hex);
      if (!parsed) return;
      applyTargetRGB(parsed.r, parsed.g, parsed.b);
      setStatus(`Target set to ${parsed.hex}.`, "idle");
    });
  });

  $("refreshBtn").addEventListener("click", async () => {
    try {
      setStatus("Checking document…", "busy");
      await refreshDocInfo();
      setStatus("Ready when your layer is.", "idle");
    } catch (err) {
      setStatus(String(err.message || err), "error");
    }
  });

  $("runBtn").addEventListener("click", async () => {
    try {
      setStatus("Starting…", "busy");
      await refreshDocInfo();
      await runColorUnmix();
      await refreshDocInfo();
    } catch (err) {
      console.error(err);
      setStatus(String(err.message || err), "error");
    }
  });

  $("maskBtn").addEventListener("click", async () => {
    try {
      await refreshDocInfo();
      await maskFromTransparencyOnly();
      await refreshDocInfo();
    } catch (err) {
      console.error(err);
      setStatus(String(err.message || err), "error");
    }
  });

  syncHexFromRGB();
  updateRangeMeta();
  updateMiniSwatch();
  bindDocListeners();
}

entrypoints.setup({
  panels: {
    whiteUnmixPanel: {
      show() {
        bindUI();
        refreshDocInfo().catch((err) => {
          setStatus(String(err.message || err), "error");
        });
      }
    }
  }
});
