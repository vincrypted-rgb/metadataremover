import { removeMetadata, inspectProvenance } from 'https://esm.sh/picscrub@1.2.0';

const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');
const out = document.getElementById('out');
const optOrientation = document.getElementById('opt-orientation');
const optColor = document.getElementById('opt-color');
const optCopyright = document.getElementById('opt-copyright');
const optC2pa = document.getElementById('opt-c2pa');

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});
fileInput.addEventListener('change', e => handleFiles([...e.target.files]));
['dragenter','dragover'].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hover'); }));
['dragleave','drop'].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hover'); }));
drop.addEventListener('drop', e => handleFiles([...e.dataTransfer.files]));

function currentOptions() {
  return {
    preserveOrientation: optOrientation.checked,
    preserveColorProfile: optColor.checked,
    preserveCopyright: optCopyright.checked,
    preserveContentCredentials: optC2pa.checked,
  };
}

async function handleFiles(files) {
  out.hidden = false;
  for (const file of files) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h2>${escapeHtml(file.name)}</h2><pre>Processing…</pre>`;
    out.appendChild(card);
    try {
      await processFile(file, card);
    } catch (e) {
      card.querySelector('pre').innerHTML =
        `<span class="err">❌ ${escapeHtml(e.message)}</span>`;
    }
  }
}

async function processFile(file, card) {
  const buf = new Uint8Array(await file.arrayBuffer());

  // Inspect first — provenance report
  let provenance = null;
  try { provenance = inspectProvenance(buf); } catch { /* unsupported */ }

  const result = await removeMetadata(buf, currentOptions());

  const removedLines = result.removedMetadata.length
    ? result.removedMetadata.map(m => `  • ${m}`).join('\n')
    : '  (none found)';

  let provenanceBlock = '';
  if (provenance && (provenance.contentCredentials || provenance.aiGenerated)) {
    const bits = [];
    if (provenance.contentCredentials) bits.push('C2PA Content Credentials');
    if (provenance.aiGenerated) bits.push('AI-generated indicator');
    if (provenance.creatorTool) bits.push(`Tool: ${provenance.creatorTool}`);
    if (provenance.digitalSourceType) bits.push(`Source: ${provenance.digitalSourceType}`);

    const kept = optC2pa.checked
      ? 'Preserved (C2PA checkbox is on).'
      : 'Stripped.';
    provenanceBlock = `\n<span class="warn">⚠ Provenance detected: ${escapeHtml(bits.join(' · '))}\n   ${kept}</span>`;
  }

  card.querySelector('pre').innerHTML =
    `Format: ${result.format}\n` +
    `Input:  ${formatBytes(result.originalSize)}\n` +
    `Output: ${formatBytes(result.cleanedSize)}  (saved ${formatBytes(result.originalSize - result.cleanedSize)})\n\n` +
    `Removed:\n${escapeHtml(removedLines)}${provenanceBlock}`;

  const blob = new Blob([result.data], { type: file.type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = (file.name.match(/\.[^.]+$/) || [''])[0];

  const a = document.createElement('a');
  a.className = 'dl';
  a.href = url;
  a.download = `${baseName}.clean${ext}`;
  a.textContent = `Download cleaned (${formatBytes(result.cleanedSize)})`;
  card.appendChild(a);
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
