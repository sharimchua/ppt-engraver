/**
 * PPT Studio Central State Store & Event Bus
 */

class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  emit(event, payload) {
    if (this.listeners.has(event)) {
      for (const handler of this.listeners.get(event)) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`Error in event handler for "${event}":`, err);
        }
      }
    }
  }
}

export const events = new EventEmitter();

function getStoredPref(key, defaultValue) {
  const variations = [
    `ppt_${key}`,
    `ppt_enable_${key}`,
    `ppt_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`,
    `ppt_enable_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`
  ];
  for (const v of variations) {
    const val = localStorage.getItem(v);
    if (val !== null) {
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (!isNaN(Number(val))) return Number(val);
      return val;
    }
  }
  return defaultValue;
}

const internalState = {
  currentScore: null,
  currentScoreContent: '',
  currentKnotId: 'default',
  availableKnots: [],
  scoresList: [],
  snippets: [],

  dirty: false,
  isCompiling: false,
  lastCompileResult: null,
  metrics: null,

  activeTab: 'score-view',
  zoom: 'fit',
  customZoomLevel: 1.0,
  isLoupeActive: false,

  preferences: {
    autocompile: getStoredPref('autocompile', true),
    autocomplete: getStoredPref('autocomplete', true),
    solfegeColors: getStoredPref('solfegeColors', true),
    coilSuggestions: getStoredPref('coilSuggestions', true),
    solfegeContext: getStoredPref('solfegeContext', true),
    loupeSize: getStoredPref('loupeSize', 220),
    loupePower: getStoredPref('loupePower', 2.5),
    lilypondPath: getStoredPref('lilypondPath', ''),
  },
};

export const state = new Proxy(internalState, {
  get(target, prop) {
    if (prop === 'currentScoreFile') return target.currentScore;
    if (prop === 'scores') return target.scoresList;
    if (prop === 'isDirty') return target.dirty;
    return target[prop];
  },
  set(target, prop, value) {
    if (prop === 'currentScoreFile') {
      target.currentScore = value;
      return true;
    }
    if (prop === 'scores') {
      target.scoresList = value;
      return true;
    }
    if (prop === 'isDirty') {
      target.dirty = Boolean(value);
      return true;
    }
    target[prop] = value;
    return true;
  }
});

export function setPreference(key, value) {
  state.preferences[key] = value;
  localStorage.setItem(`ppt_${key}`, String(value));
  const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  localStorage.setItem(`ppt_enable_${snakeKey}`, String(value));
  localStorage.setItem(`ppt_${snakeKey}`, String(value));
  events.emit('preference:changed', { key, value });
}
export const updatePreference = setPreference;

export function setDirty(isDirty) {
  state.dirty = Boolean(isDirty);
  events.emit('dirty:changed', state.dirty);
  events.emit('score:dirty', state.dirty);
}

export function setScore(scorePath, content = null) {
  state.currentScore = scorePath;
  if (content !== null) {
    state.currentScoreContent = content;
  }
  events.emit('score:changed', { path: scorePath, content });
}

export function setKnotId(knotId) {
  state.currentKnotId = knotId || 'default';
  events.emit('knot:changed', state.currentKnotId);
}

export function setAvailableKnots(knots, selectedId = null) {
  state.availableKnots = knots || [];
  if (selectedId) {
    state.currentKnotId = selectedId;
  }
  events.emit('knots:updated', { knots: state.availableKnots, selectedId: state.currentKnotId });
}
