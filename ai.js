/* ai.js — Gym Tracker Pro · Real AI Integration
 * Static file. Put next to index.html on GitHub Pages.
 * User brings their own API key (saved in localStorage only).
 */
(function () {
  'use strict';

  const LS_KEY = 'gymAI_v1';

  const PROVIDERS = {
    gemini: {
      name: 'Google Gemini',
      desc: 'Free tier · recommended',
      keyUrl: 'https://aistudio.google.com/app/apikey',
      models: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      buildUrl: function (m, k) {
        return 'https://generativelanguage.googleapis.com/v1beta/models/' +
          m + ':generateContent?key=' + encodeURIComponent(k);
      },
      buildReq: function (m, sys, user) {
        return {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: {
              temperature: 0.85,
              responseMimeType: 'application/json',
              maxOutputTokens: 8192
            }
          })
        };
      },
      parseResp: function (d) {
        if (!d.candidates || !d.candidates[0] || !d.candidates[0].content) throw new Error('Empty response');
        return d.candidates[0].content.parts[0].text;
      }
    },
    groq: {
      name: 'Groq',
      desc: 'Extremely fast · free tier',
      keyUrl: 'https://console.groq.com/keys',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
      buildUrl: function () { return 'https://api.groq.com/openai/v1/chat/completions'; },
      buildReq: function (m, sys, user, k) {
        return {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: user }
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' }
          })
        };
      },
      parseResp: function (d) { return d.choices[0].message.content; }
    },
    openrouter: {
      name: 'OpenRouter',
      desc: 'Many models · some free',
      keyUrl: 'https://openrouter.ai/keys',
      models: [
        'google/gemini-2.0-flash-exp:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'anthropic/claude-3.5-sonnet'
      ],
      buildUrl: function () { return 'https://openrouter.ai/api/v1/chat/completions'; },
      buildReq: function (m, sys, user, k) {
        return {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + k,
            'HTTP-Referer': 'https://github.com',
            'X-Title': 'Gym Tracker Pro'
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: user }
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' }
          })
        };
      },
      parseResp: function (d) { return d.choices[0].message.content; }
    },
    openai: {
      name: 'OpenAI',
      desc: 'Paid · high quality',
      keyUrl: 'https://platform.openai.com/api-keys',
      models: ['gpt-4o-mini', 'gpt-4o'],
      buildUrl: function () { return 'https://api.openai.com/v1/chat/completions'; },
      buildReq: function (m, sys, user, k) {
        return {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: user }
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' }
          })
        };
      },
      parseResp: function (d) { return d.choices[0].message.content; }
    },
    anthropic: {
      name: 'Anthropic Claude',
      desc: 'Paid · top reasoning',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
      buildUrl: function () { return 'https://api.anthropic.com/v1/messages'; },
      buildReq: function (m, sys, user, k) {
        return {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': k,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: m,
            max_tokens: 8000,
            system: sys,
            messages: [{ role: 'user', content: user }]
          })
        };
      },
      parseResp: function (d) { return d.content[0].text; }
    }
  };

  const SYSTEM_PROMPT = [
    'You are an elite strength & hypertrophy coach. You design training programs for a gym tracker app.',
    '',
    'Return ONLY valid JSON (no markdown, no explanation outside the JSON object).',
    '',
    'SCHEMA:',
    '{',
    '  "program": [',
    '    {',
    '      "name": "Descriptive day name (e.g. \'Push · Chest Focus\')",',
    '      "muscleGroups": ["Chest","Triceps","Shoulders"],',
    '      "exercises": [',
    '        {',
    '          "name": "Exercise name (simple & well-known)",',
    '          "muscle": "Chest|Back|Shoulders|Biceps|Triceps|Legs|Abs and core|Forearms",',
    '          "sets": 4,',
    '          "warmupSets": 2,',
    '          "reps": "6-8",',
    '          "note": "Optional short cue"',
    '        }',
    '      ]',
    '    }',
    '  ],',
    '  "reasoning": "2-3 sentences on split logic, weekly frequency per muscle, and why it fits this athlete."',
    '}',
    '',
    'STRICT RULES:',
    '1. Exercise names must be simple and familiar (Barbell Bench Press, Dumbbell Row, Lat Pulldown, Cable Fly, Leg Press, RDL, etc.). No invented or exotic names.',
    '2. Compound lifts (presses, rows, squats, deadlifts, pull-ups, overhead press, hip thrusts) FIRST in each day. Isolation (curls, extensions, lateral raises, flies, calves) LATER.',
    '3. Distribute weekly volume intelligently: aim for 2× per week frequency of every major muscle when training 4+ days/week.',
    '4. Do NOT place two similar-muscle compound lifts back-to-back (no two bench variants adjacent). Alternate push/pull or upper/lower when possible.',
    '5. Respect the athlete\'s age, training experience, and any listed equipment restrictions.',
    '6. Respect ALL user requests in the "USER REQUESTS" field. The user is the boss — obey them even if it breaks general rules.',
    '7. If "RESTRICT TO" list is given, use ONLY exercises from that list.',
    '8. If "AVOID" list is given, never include those exercises or the muscles listed.',
    '9. If "FOCUS MUSCLES" specified → add extra volume (1 extra exercise per affected day, and place them earlier in the session).',
    '10. Reps: if the user gave a range, use it. Otherwise vary sensibly: compounds 6-8, isolation 10-15, calves 12-20.',
    '11. Sets: beginners 2-3 per exercise, intermediate 3, advanced 3-4. Compounds get +1 set vs isolation.',
    '12. Only use these muscle group names: Chest, Back, Shoulders, Biceps, Triceps, Legs, Abs and core, Forearms.',
    '13. Return valid JSON. Escape quotes properly. No trailing commas.',
    '',
    'IMPORTANT: If the user gives unusual or specific requests, honor them even if they contradict general best practices.'
  ].join('\n');

  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function isEnabled() {
    const s = load();
    return !!(s.apiKey && s.provider);
  }

  function buildUserPrompt(p) {
    const L = [];
    L.push('ATHLETE PROFILE');
    L.push('- Gender: ' + (p.gender || 'not specified'));
    L.push('- Age: ' + (p.age || 25));
    L.push('- Experience: ' + (p.exp || 'intermediate'));
    L.push('- Training days per week: ' + (p.days || 4));
    L.push('');
    L.push('SPLIT PREFERENCE');
    if (p.splitMode === 'cus') {
      L.push('- Custom split the athlete designed (' + p.days + ' days):');
      (p.customDays || []).forEach(function (d, i) {
        L.push('  Day ' + (i + 1) + ' (' + (d.name || ('Day ' + (i + 1))) + '): ' + (d.muscles.length ? d.muscles.join(', ') : 'EMPTY — fill it sensibly'));
      });
    } else if (p.splitMode === 'com') {
      L.push('- Combined split: ' + (p.combinePrimaryName || '') + ' (base) + ' + (p.combineSecondaryName || '') + ' (variety). Blend them intelligently into ' + p.days + ' days.');
    } else {
      L.push('- Preferred style: ' + (p.splitName || 'Full Body') + ' — ' + (p.splitDesc || ''));
    }
    L.push('');
    L.push('STRUCTURE');
    L.push('- Exercises per day: ' + (p.exPerDay || 'coach default (6–8)'));
    if (p.repRange) L.push('- Rep range: ' + p.repRange);
    if (p.fixedSets) L.push('- Sets per exercise: exactly ' + p.fixedSets + ' (do not vary)');
    if (p.focusMuscles && p.focusMuscles.length) {
      L.push('- FOCUS MUSCLES (add extra volume): ' + p.focusMuscles.join(', '));
    }
    if (p.avoid && p.avoid.length) {
      L.push('');
      L.push('AVOID');
      p.avoid.forEach(function (x) { L.push('- ' + x); });
    }
    if (p.whitelist && p.whitelist.length) {
      L.push('');
      L.push('RESTRICT TO (only these exercises allowed)');
      p.whitelist.forEach(function (x) { L.push('- ' + x); });
    }
    if (p.userText) {
      L.push('');
      L.push('USER REQUESTS (obey ALL of these)');
      L.push(p.userText);
    }
    L.push('');
    L.push('Now design the complete program. Return ONLY the JSON object.');
    return L.join('\n');
  }

  async function callAPI(profile) {
    const settings = load();
    const P = PROVIDERS[settings.provider];
    if (!P) throw new Error('Provider not set');
    if (!settings.apiKey) throw new Error('Missing API key');
    const model = settings.model || P.models[0];
    const url = P.buildUrl(model, settings.apiKey);
    const init = P.buildReq(model, SYSTEM_PROMPT, buildUserPrompt(profile), settings.apiKey);

    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 90000);
    init.signal = ctrl.signal;

    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      clearTimeout(timer);
      throw new Error('Network: ' + e.message);
    }
    clearTimeout(timer);

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch (e) {}
      throw new Error('API ' + res.status + ': ' + body.slice(0, 240));
    }
    const data = await res.json();
    return P.parseResp(data);
  }

  function extractJSON(text) {
    let t = String(text || '').trim();
    if (t.startsWith('```')) {
      t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    try { return JSON.parse(t); } catch (e) {}
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
      const inner = t.slice(a, b + 1);
      try { return JSON.parse(inner); } catch (e) {}
    }
    throw new Error('AI did not return valid JSON');
  }

  function normalize(parsed) {
    if (!parsed || !Array.isArray(parsed.program)) {
      throw new Error('Missing "program" array');
    }
    const program = [];
    parsed.program.forEach(function (day, di) {
      if (!day || !Array.isArray(day.exercises)) return;
      const exs = [];
      day.exercises.forEach(function (e) {
        if (!e || !e.name) return;
        exs.push({
          name: String(e.name).trim(),
          sets: Math.max(1, Math.min(20, parseInt(e.sets) || 3)),
          warmupSets: Math.max(0, Math.min(10, parseInt(e.warmupSets) || 0)),
          note: String(e.note || '').trim(),
          history: [],
          supersetHistory: [],
          viewMode: '1',
          isEach: false,
          _aiReps: String(e.reps || '').trim(),
          _aiMuscle: String(e.muscle || '').trim()
        });
      });
      if (exs.length) {
        program.push({
          day: di + 1,
          name: String(day.name || ('Day ' + (di + 1))).trim(),
          exercises: exs
        });
      }
    });
    if (!program.length) throw new Error('AI returned no valid exercises');
    return {
      program: program,
      reasoning: String(parsed.reasoning || '').trim()
    };
  }

  async function generateSplit(profile) {
    const raw = await callAPI(profile);
    const parsed = extractJSON(raw);
    return normalize(parsed);
  }

  async function ping() {
    if (!isEnabled()) throw new Error('Not connected');
    const raw = await callAPI({
      gender: 'male', age: 25, exp: 'intermediate', days: 2,
      splitName: 'Full Body', splitDesc: 'test', exPerDay: 3,
      userText: 'Minimal test program, 2 days, 3 exercises each. Fast.'
    });
    const parsed = extractJSON(raw);
    return normalize(parsed);
  }

  window.GymAI = {
    PROVIDERS: PROVIDERS,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    load: load,
    save: save,
    isEnabled: isEnabled,
    generateSplit: generateSplit,
    ping: ping,
    buildUserPrompt: buildUserPrompt
  };
})();
