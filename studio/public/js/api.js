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

export async function apiSaveConfig(lilypondPath) {
  const body = typeof lilypondPath === 'object' ? lilypondPath : { lilypondPath };
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await res.json();
}
export const saveConfig = apiSaveConfig;
