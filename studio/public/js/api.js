/**
 * PPT Studio Backend REST API Client
 */

export async function apiGetScores() {
  const res = await fetch('/api/scores');
  if (!res.ok) throw new Error('Failed to fetch score list');
  const data = await res.json();
  return data;
}
export const fetchScores = apiGetScores;

export async function apiGetScore(fileName) {
  const res = await fetch(`/api/score?file=${encodeURIComponent(fileName)}`);
  if (!res.ok) throw new Error(`Failed to load score: ${fileName}`);
  return await res.json();
}
export const fetchScore = apiGetScore;

export async function apiSaveScore(fileName, content) {
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: fileName, content }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to save score');
  return data;
}
export const saveScore = apiSaveScore;

export async function apiDeleteScore(fileName) {
  const res = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: fileName }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete score');
  return data;
}
export const deleteScore = apiDeleteScore;

export async function apiRenameScore(oldFile, newFile) {
  const res = await fetch('/api/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldFile, newFile }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to rename score');
  return data;
}
export const renameScore = apiRenameScore;

export async function apiGetSnippets() {
  const res = await fetch('/api/snippets');
  if (!res.ok) return { snippets: [] };
  const data = await res.json();
  return data;
}
export const fetchSnippets = apiGetSnippets;

export async function apiCompileScore(yamlContent, knotId = null, format = 'pdf') {
  let bodyPayload = {};
  if (typeof yamlContent === 'object' && yamlContent !== null && yamlContent.yaml) {
    bodyPayload = yamlContent;
  } else {
    bodyPayload = { yaml: yamlContent, knotId, format };
  }

  const res = await fetch('/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });
  const data = await res.json();
  return data;
}
export const compileScore = apiCompileScore;

export async function apiExportPdf(yamlContent, fileName, knotId = null) {
  let bodyPayload = {};
  if (typeof yamlContent === 'object' && yamlContent !== null && yamlContent.yaml) {
    bodyPayload = yamlContent;
  } else {
    bodyPayload = { yaml: yamlContent, file: fileName, knotId };
  }

  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'PDF Export Failed');
  return data;
}
export const exportPdf = apiExportPdf;

export async function apiGetConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) return { lilypondPath: '', exists: false };
  return await res.json();
}
export const fetchConfig = apiGetConfig;

export async function apiSaveConfig(config) {
  const body = typeof config === 'object' ? config : { lilypondPath: config };
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await res.json();
}
export const saveConfig = apiSaveConfig;

// --- Audio Subsystem & ABC Export APIs ---

export async function apiExportAbc(yamlContent, fileName, knotId = null, isInstrumental = undefined, tempo = undefined) {
  const res = await fetch('/api/export-abc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml: yamlContent, file: fileName, knotId, isInstrumental, tempo }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'ABC Export Failed');
  return data;
}
export const exportAbc = apiExportAbc;

export async function apiGetAudioStatus() {
  const res = await fetch('/api/audio/status');
  if (!res.ok) return { online: false };
  return await res.json();
}

export async function apiGetAudioModels() {
  const res = await fetch('/api/audio/models');
  if (!res.ok) return { models: [], offline: true };
  return await res.json();
}

export async function apiDownloadAudioModel(modelId) {
  const res = await fetch('/api/audio/models/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Model download failed');
  return data;
}

export async function apiDeleteAudioModel(modelId) {
  const res = await fetch('/api/audio/models/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Model deletion failed');
  return data;
}

export async function apiGenerateAudio(params) {
  const res = await fetch('/api/audio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Audio generation failed');
  return data;
}

export async function apiGetAudioJob(jobId) {
  const res = await fetch(`/api/audio/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error('Failed to fetch job status');
  return await res.json();
}

