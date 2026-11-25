/* Trainingslog Coach: Digest
 * Turns the full training log into a short Markdown summary (current.md),
 * so an AI only has to read a few KB instead of the whole history.
 * Runs in the browser (window.CoachDigest) and in Node:
 *   node coach/digest.js <trainingslog-backup.json> [YYYY-MM-DD]
 * The maths matches index.html: only sets with r>0 count; e1RM = w*(1+r/30) (Epley).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoachDigest = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function validSets(sets) {
    return (sets || []).filter(function (s) { return s && typeof s.r === 'number' && s.r > 0; });
  }
  function sessionStats(sets) {
    var v = validSets(sets);
    if (!v.length) return null;
    var top = 0, e1 = 0, vol = 0, reps = 0;
    v.forEach(function (s) {
      var w = typeof s.w === 'number' ? s.w : 0;
      reps += s.r; vol += w * s.r;
      if (w > top) top = w;
      if (w > 0) { var e = w * (1 + s.r / 30); if (e > e1) e1 = e; }
    });
    return { top: top, e1: e1, vol: vol, reps: reps, hasW: top > 0, n: v.length };
  }

  function r1(x) { return Math.round(x * 10) / 10; }
  function num(x) { return String(r1(x)); }
  function pct(a, b) {
    if (!b) return '';
    var p = (a / b - 1) * 100;
    return (p >= 0 ? '+' : '') + r1(p) + ' %';
  }
  function dayDiff(a, b) {
    return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  }
  function shift(d, n) {
    var t = new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000);
    return t.toISOString().slice(0, 10);
  }
  function fmtSets(sets) {
    return validSets(sets).map(function (s) {
      return (typeof s.w === 'number' && s.w > 0 ? num(s.w) + '×' : 'BW×') + s.r;
    }).join(', ');
  }
  // main value: e1RM for weighted exercises, total reps for bodyweight ones
  function key(st) { return st.hasW ? st.e1 : st.reps; }
  function keyLabel(st) { return st.hasW ? 'e1RM ' + num(st.e1) + ' kg' : st.reps + ' Wdh. gesamt'; }

  /* Normalised data model: {exercises: {id:{name,groups,removed}}, days: {date:{exId:sets}}} */
  function parse(docs) {
    var ex = {}, days = {};
    var items = (docs && docs.exercises && Array.isArray(docs.exercises.items)) ? docs.exercises.items : [];
    items.forEach(function (it) {
      if (it && it.id) ex[it.id] = { name: it.name || it.id, groups: Array.isArray(it.groups) ? it.groups : [], removed: !!it.removed };
    });
    Object.keys(docs || {}).forEach(function (id) {
      if (!/^day-\d{4}-\d{2}-\d{2}$/.test(id)) return;
      var d = docs[id] || {}, date = d.date || id.slice(4), entries = d.entries || {}, out = {};
      Object.keys(entries).forEach(function (exId) {
        var v = validSets(entries[exId] && entries[exId].sets);
        if (v.length) out[exId] = v;
      });
      if (Object.keys(out).length) days[date] = out;
    });
    return { exercises: ex, days: days };
  }

  function seriesFor(data, exId, upTo) {
    return Object.keys(data.days).filter(function (d) { return d <= upTo && data.days[d][exId]; }).sort()
      .map(function (d) { return { date: d, sets: data.days[d][exId], st: sessionStats(data.days[d][exId]) }; });
  }

  function buildDigest(docs, opts) {
    opts = opts || {};
    var lookback = opts.lookback || 6;
    var data = parse(docs);
    var dates = Object.keys(data.days).sort();
    if (!dates.length) return '# Aktueller Stand\n\nNoch keine Trainingsdaten.\n';
    var date = opts.date && data.days[opts.date] ? opts.date : dates[dates.length - 1];
    var today = data.days[date];
    var before = dates.filter(function (d) { return d < date; });
    var exName = function (id) { return (data.exercises[id] || {}).name || id; };

    // Which groups/units were trained today (by majority of exercises)
    var gCount = {};
    Object.keys(today).forEach(function (id) {
      ((data.exercises[id] || {}).groups || []).forEach(function (g) { gCount[g] = (gCount[g] || 0) + 1; });
    });
    var groups = Object.keys(gCount).sort(function (a, b) { return gCount[b] - gCount[a]; });

    var L = [];
    L.push('# Aktueller Stand: Einheit vom ' + date);
    L.push('');
    L.push('- Einheit: ' + (groups.length ? groups.join(' + ') : 'ohne Gruppe') +
      ' · ' + Object.keys(today).length + ' Übungen');
    if (before.length) L.push('- Letztes Training davor: ' + before[before.length - 1] + ' (vor ' + dayDiff(before[before.length - 1], date) + ' Tagen)');
    var weeks = [];
    for (var w = 0; w < 4; w++) {
      var from = shift(date, -7 * (w + 1) + 1), to = shift(date, -7 * w);
      weeks.push(dates.filter(function (d) { return d >= from && d <= to; }).length);
    }
    L.push('- Trainingstage pro Woche (aktuelle Woche zuerst, je 7 Tage): ' + weeks.join(' / '));
    L.push('- Trainingstage gesamt: ' + dates.filter(function (d) { return d <= date; }).length + ' seit ' + dates[0]);
    L.push('');

    var flags = [];
    L.push('## Heute');
    Object.keys(today).forEach(function (id) {
      var ser = seriesFor(data, id, date), cur = ser[ser.length - 1], prev = ser[ser.length - 2];
      var st = cur.st, line = '- **' + exName(id) + '**: ' + fmtSets(today[id]) + ' → ' + keyLabel(st);
      if (st.hasW) line += ', Volumen ' + Math.round(st.vol) + ' kg';
      if (prev) {
        line += ' · ggü. ' + prev.date + ' (' + fmtSets(prev.sets) + '): ' + pct(key(st), key(prev.st));
        if (st.hasW) line += ', Wdh. ' + prev.st.reps + '→' + st.reps + ', Volumen ' + pct(st.vol, prev.st.vol);
        var bestBefore = Math.max.apply(null, ser.slice(0, -1).map(function (p) { return key(p.st); }));
        if (key(st) > bestBefore) flags.push('PR: ' + exName(id) + ' (' + keyLabel(st) + ', bisher ' + num(bestBefore) + ')');
        if (key(st) < key(prev.st) * 0.95) flags.push('Einbruch: ' + exName(id) + ' ' + pct(key(st), key(prev.st)) + ' ggü. letzter Einheit');
        // Stall: the last 3 sessions are not better than the best before them
        if (ser.length >= 5) {
          var last3 = ser.slice(-3), older = ser.slice(0, -3);
          var bestOld = Math.max.apply(null, older.map(function (p) { return key(p.st); }));
          if (Math.max.apply(null, last3.map(function (p) { return key(p.st); })) <= bestOld)
            flags.push('Stagnation: ' + exName(id) + ' seit 3 Einheiten kein neuer Bestwert (Bestwert ' + num(bestOld) + ')');
        }
        var monthAgo = ser.filter(function (p) { return p.date <= shift(date, -28); }).pop();
        if (monthAgo) line += ' · ggü. ' + monthAgo.date + ' (≈4 Wo.): ' + pct(key(st), key(monthAgo.st));
      } else {
        line += ' · erste Einheit dieser Übung';
      }
      L.push(line);
    });
    L.push('');

    // Exercises in the group(s) that were not done today
    if (groups.length) {
      var missed = Object.keys(data.exercises).filter(function (id) {
        var x = data.exercises[id];
        return !x.removed && !today[id] && x.groups.some(function (g) { return g === groups[0]; });
      });
      if (missed.length) flags.push('Ausgelassen (' + groups[0] + '): ' + missed.map(exName).join(', '));
    }

    L.push('## Auffälligkeiten');
    L.push(flags.length ? flags.map(function (f) { return '- ' + f; }).join('\n') : '- keine');
    L.push('');

    L.push('## Verlauf der heutigen Übungen (letzte ' + lookback + ' Einheiten, älteste zuerst)');
    Object.keys(today).forEach(function (id) {
      var ser = seriesFor(data, id, date).slice(-lookback);
      var hasW = ser.some(function (p) { return p.st.hasW; });
      L.push('- ' + exName(id) + ': ' + ser.map(function (p) {
        return p.date.slice(5) + ' ' + (hasW ? num(p.st.top) + 'kg/e1 ' + num(p.st.e1) : p.st.reps + ' Wdh.');
      }).join(' · '));
    });
    L.push('');
    return L.join('\n');
  }

  return { buildDigest: buildDigest, sessionStats: sessionStats, validSets: validSets, parse: parse };
});

// CLI (Node only)
if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
  var fs = require('fs');
  var file = process.argv[2];
  if (!file) { console.error('Usage: node coach/digest.js <backup.json> [YYYY-MM-DD]'); process.exit(1); }
  var j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!j || j.app !== 'trainingslog' || !j.docs) { console.error('Keine Trainingslog-Backup-Datei.'); process.exit(1); }
  process.stdout.write(module.exports.buildDigest(j.docs, { date: process.argv[3] }));
}
