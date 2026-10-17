/* ============================================================
   JIZURA-motionGraphic — presets: save/load motion configuration
   A preset stores the visual/motion setup (not lyrics/audio),
   so the same look can be reused across songs.
   ============================================================ */
(() => {
'use strict';

/* fields that define the "motion" (excludes lyrics, audio, title, artist) */
const PRESET_FIELDS = ['style', 'mood', 'themeId', 'extra', 'wa', 'horror', 'typo', 'kinetic',
  'unify', 'typeset', 'centerDir', 'centerFree', 'seed', 'aspect', 'res', 'fps',
  'fx', 'enabled', 'colors', 'fonts', 'keyBg', 'bgMedia', 'keywords', 'regions'];

const clone = o => JSON.parse(JSON.stringify(o));

J.presetFromProject = (project) => {
  const p = {};
  for (const f of PRESET_FIELDS) if (project[f] !== undefined) p[f] = clone(project[f]);
  return p;
};

J.presetToProject = (project, preset) => {
  if (!preset) return project;
  for (const f of PRESET_FIELDS) if (preset[f] !== undefined) project[f] = clone(preset[f]);
  return project;
};

/* ---------- built-in presets ---------- */
J.BUILTIN_PRESETS = [
  {
    id: 'builtin-karaoke', name: '노래방',
    config: {
      style: 'paper', mood: 'calm',
      fx: { motion: 0.25, glitch: 0, chroma: 0.15, decor: 0.15, density: 0.35, texture: 0.25, flash: false, onTwos: true, koma: 12, hud: 'auto', bgSwitch: 0.2 },
      enabled: { treat: { karaoke: true } },
      unify: true,
    }
  },
  {
    id: 'builtin-pop', name: '팝',
    config: {
      style: 'magenta', mood: 'pop',
      fx: { motion: 0.85, glitch: 0.6, chroma: 0.8, decor: 0.7, density: 0.7, texture: 0.5, flash: true, onTwos: true, koma: 12, hud: 'auto', bgSwitch: 0.5 },
    }
  },
  {
    id: 'builtin-ballad', name: '감성 발라드',
    config: {
      style: 'noir', mood: 'calm',
      fx: { motion: 0.35, glitch: 0.1, chroma: 0.3, decor: 0.4, density: 0.4, texture: 0.7, flash: false, onTwos: true, koma: 12, hud: 'auto', bgSwitch: 0.25 },
    }
  },
  {
    id: 'builtin-kinetic', name: '키네틱',
    config: {
      style: 'specimen', mood: 'graphic', themeId: 'kinetic', kinetic: true,
      fx: { motion: 0.9, glitch: 0.4, chroma: 0.6, decor: 0.6, density: 0.65, texture: 0.4, flash: false, onTwos: true, koma: 12, hud: 'auto', bgSwitch: 0.4 },
    }
  },
];

/* ---------- user presets (localStorage) ---------- */
const LS_KEY = 'jizura-presets-v1';
J.presetList = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
};
J.presetSave = (name, config) => {
  const list = J.presetList();
  const id = 'user-' + Date.now().toString(36);
  list.push({ id, name, config });
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) {}
  return id;
};
J.presetDelete = (id) => {
  const list = J.presetList().filter(p => p.id !== id);
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) {}
};
J.presetGet = (id) => {
  const b = J.BUILTIN_PRESETS.find(p => p.id === id);
  if (b) return b;
  return J.presetList().find(p => p.id === id) || null;
};
J.presetAll = () => [...J.BUILTIN_PRESETS, ...J.presetList()];

})();
