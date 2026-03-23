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

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg;
}

function normalizeHex(hex) {
  let s = String(hex || "").trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error("Hex color must be 3 or 6 hex digits.");
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

function syncToleranceInputs(from) {
  if (from === "range") {
    $("tolerancePct").value = $("toleranceRange").value;
  } else {
    const v = clamp(Number($("tolerancePct").value || 0), 0, 100);
    $("tolerancePct").value = String(v);
    $("toleranceRange").value = String(v);
  }
  updateRangeMeta();
}

function syncRGBFromHex(forceNormalize = false) {
  const parsed = tryParseCompleteHex($("hexInput").value);
  if (!parsed) {
    if (forceNormalize) {
      throw new Error("Hex color must be 3 or 6 hex digits.");
    }
    return false;
  }

  $("rInput").value = String(parsed.r);
  $("gInput").value = String(parsed.g);
  $("bInput").value = String(parsed.b);
  if (forceNormalize) {
    $("hexInput").value = parsed.hex;
  }
  return true;
}

function syncHexFromRGB() {
  const r = clamp(Number($("rInput").value || 0), 0, 255);
  const g = clamp(Number($("gInput").value || 0), 0, 255);
  const b = clamp(Number($("bInput").value || 0), 0, 255);
  $("rInput").value = String(clamp8(r));
  $("gInput").value = String(clamp8(g));
  $("bInput").value = String(clamp8(b));
  $("hexInput").value = rgbToHex(r, g, b);
}

function getRGBTargetFromUI(strict = false) {
  if (strict) syncRGBFromHex(true);
  return {
    r: clamp8(Number($("rInput").value || 0)),
    g: clamp8(Number($("gInput").value || 0)),
    b: clamp8(Number($("bInput").value || 0))
  };
}

function updateMiniSwatch() {
  const swatch = $("miniSwatch");
  try {
    const parsed = tryParseCompleteHex($("hexInput").value);
    const t = parsed || getRGBTargetFromUI(false);
    swatch.style.background = `rgb(${t.r}, ${t.g}, ${t.b})`;
  } catch (err) {
    swatch.style.background = "#808080";
  }
  updateTargetMeta();
}

function updateTargetMeta() {
  const meta = $("targetMeta");
  if (!meta) return;
  const parsed = tryParseCompleteHex($("hexInput").value);
  if (parsed) {
    meta.textContent = `RGB ${parsed.hex}`;
  } else {
    const t = getRGBTargetFromUI(false);
    meta.textContent = `RGB ${rgbToHex(t.r, t.g, t.b)}`;
  }
}

function updateRangeMeta() {
  const pct = clamp(Number($("tolerancePct").value || 0), 0, 100);
  $("rangeMeta").textContent = `${pct}%`;
}

function getUIOptions() {
  const tolerancePct = clamp(Number($("tolerancePct").value || 0), 0, 100);
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
  const r = clamp8(fg.rgb.red);
  const g = clamp8(fg.rgb.green);
  const b = clamp8(fg.rgb.blue);
  $("rInput").value = String(r);
  $("gInput").value = String(g);
  $("bInput").value = String(b);
  $("hexInput").value = rgbToHex(r, g, b);
  updateMiniSwatch();
}

async function refreshDocInfo() {
  const info = $("docInfo");
  const meta = $("docMeta");
  const runBtn = $("runBtn");

  try {
    const doc = app.activeDocument;
    if (!doc) {
      info.textContent = "No document is open.";
      meta.textContent = "No document";
      runBtn.disabled = true;
      return;
    }

    const modeName = getDocModeName(doc.mode);
    const layers = doc.activeLayers;
    let layerText = "No layer selected";
    let ok = false;

    if (layers && layers.length === 1) {
      const layer = layers[0];
      layerText = layer.name;
      ok = isSupportedLayer(layer) && isSupportedDocMode(doc.mode);
    } else if (layers && layers.length > 1) {
      layerText = "Select exactly one layer";
    }

    const supportText = isSupportedDocMode(doc.mode)
      ? "Supported document mode."
      : "Only RGB documents are supported.";

    info.textContent = `Mode: ${modeName}\nLayer: ${layerText}\n${supportText}`;
    meta.textContent = `${modeName} | ${layerText}`;
    runBtn.disabled = !ok;
  } catch (err) {
    info.textContent = `Could not inspect document: ${err.message || err}`;
    meta.textContent = "Inspect error";
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
  if (!isSupportedDocMode(doc.mode)) throw new Error("This version supports RGB documents only.");

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
      setStatus("Duplicating layer...");
      const dup = await src.duplicate();
      dup.name = `${src.name}_unmix`;

      executionContext.reportProgress({ value: 0.08, commandName: "Color Unmix" });
      setStatus("Reading pixels...");
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

      setStatus("Processing pixels...");

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
      setStatus("Writing pixels...");

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
      setStatus(`Done. ${changedPixels} pixels changed. Target ${options.targetLabel}. Tolerance ${options.tolerancePct}%.`);
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
    setStatus("Applying mask from transparency...");
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
    setStatus("Done. Mask from transparency applied.");
  }, { commandName: "Mask from Transparency" });
}

function bindSectionToggles() {
  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggle;
      const section = $(id);
      if (section) section.classList.toggle("collapsed");
    });
  });
}

function bindUI() {
  if (document.body.dataset.bound) return;
  document.body.dataset.bound = "1";

  bindSectionToggles();

  $("hexInput").addEventListener("input", () => {
    const ok = syncRGBFromHex(false);
    if (ok) {
      updateMiniSwatch();
    } else {
      $("targetMeta").textContent = "RGB invalid";
    }
  });

  $("hexInput").addEventListener("change", () => {
    try {
      syncRGBFromHex(true);
      updateMiniSwatch();
    } catch (err) {
      setStatus(`Error: ${err.message || err}`);
    }
  });

  ["rInput", "gInput", "bInput"].forEach((id) => {
    $(id).addEventListener("input", () => {
      syncHexFromRGB();
      updateMiniSwatch();
    });
  });

  $("toleranceRange").addEventListener("input", () => syncToleranceInputs("range"));
  $("tolerancePct").addEventListener("input", () => syncToleranceInputs("number"));

  $("useFgBtn").addEventListener("click", () => {
    try {
      applyForegroundColorToUI();
      setStatus("Foreground color loaded.");
    } catch (err) {
      setStatus(`Error: ${err.message || err}`);
    }
  });

  $("refreshBtn").addEventListener("click", async () => {
    try {
      setStatus("Refreshing...");
      await refreshDocInfo();
      setStatus("Idle.");
    } catch (err) {
      setStatus(`Error: ${err.message || err}`);
    }
  });

  $("runBtn").addEventListener("click", async () => {
    try {
      setStatus("Starting...");
      await refreshDocInfo();
      await runColorUnmix();
      await refreshDocInfo();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || err}`);
    }
  });

  $("maskBtn").addEventListener("click", async () => {
    try {
      await refreshDocInfo();
      await maskFromTransparencyOnly();
      await refreshDocInfo();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || err}`);
    }
  });

  syncHexFromRGB();
  syncToleranceInputs("number");
  updateMiniSwatch();
}

entrypoints.setup({
  panels: {
    whiteUnmixPanel: {
      show() {
        bindUI();
        refreshDocInfo().catch((err) => {
          setStatus(`Error: ${err.message || err}`);
        });
      }
    }
  }
});
