(function (root) {
  'use strict';
  const fields = ['spend', 'impressions', 'clicks', 'visits', 'conversions', 'revenue', 'other'];
  const counts = new Set(['impressions', 'clicks', 'visits', 'conversions']);
  const ratio = (a, b, scale = 1) => b === 0 ? null : a / b * scale;
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function validDate(s) { const d = new Date(s+'T00:00:00Z'); return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s >= '2000-01-01' && s <= '2099-12-31' && Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s; }
  function validate(r) {
    if (!r || typeof r !== 'object') throw Error('データの形式が正しくありません。');
    if (typeof r.id !== 'string' || !/^[\w-]{1,80}$/.test(r.id)) throw Error('記録IDが正しくありません。');
    if (!validDate(r.date)) throw Error('日付を2000〜2099年の実在する日付で入力してください。');
    for (const [k, max] of [['lp',100], ['medium',80], ['note',500]]) {
      if (typeof r[k] !== 'string' || r[k].length > max || (k === 'lp' && !r[k].trim())) throw Error('LP名・媒体名・メモを確認してください。');
    }
    const out = {id:r.id, date:r.date, lp:r.lp.trim(), medium:r.medium.trim(), note:r.note};
    for (const k of [...fields,'profit']) {
      if (k === 'profit' && r[k] === null) { out[k] = null; continue; }
      const n = r[k], limit = counts.has(k) ? 1e9 : 1e10;
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || Math.abs(n) > limit || (k !== 'profit' && n < 0)) throw Error('金額は100億円以内、回数は10億以内の整数で入力してください（利益以外は0以上）。');
      out[k] = n;
    }
    return out;
  }
  function parse(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'osanai-ad-manager' || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 10000) throw Error('対応する広告効果管理のバックアップではありません。');
    const records = data.records.map(validate), ids = new Set(), keys = new Set();
    for (const r of records) {
      const key = JSON.stringify([r.date,r.lp,r.medium]);
      if (ids.has(r.id) || keys.has(key)) throw Error('日付・LP・媒体、または記録IDが重複しています。');
      ids.add(r.id); keys.add(key);
    }
    return records;
  }
  function catalog(records, saved = {}) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw Error('登録リストの形式が正しくありません。');
    const out = {};
    for (const [key,max] of [['lp',100],['medium',80]]) {
      const values = saved[key] === undefined ? [] : saved[key];
      if (!Array.isArray(values) || values.length > 10000 || values.some(v=>typeof v !== 'string' || !v.trim() || v.length > max)) throw Error('登録リストの名前・件数を確認してください。');
      out[key] = [...new Set([...values.map(v=>v.trim()),...records.map(r=>r[key]).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'ja'));
      if(out[key].length>10000) throw Error('登録リストは各10,000件までです。');
    }
    return out;
  }
  function parseState(text) { const records = parse(text); return {records, catalog:catalog(records,JSON.parse(text).catalog)}; }
  function serialize(records, saved) { return JSON.stringify({app:'osanai-ad-manager', version:1, exportedAt:new Date().toISOString(), records, catalog:catalog(records,saved)}); }
  function shiftDay(date, count) { const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+count); return d.toISOString().slice(0,10); }
  function comparisonRanges(date, mode) {
    if(mode==='day') return {current:[date,date],previous:[shiftDay(date,-1),shiftDay(date,-1)]};
    const d=new Date(date+'T12:00:00Z'), day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);
    const start=d.toISOString().slice(0,10), last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
    d.setUTCDate(Math.min(day,last));
    return {current:[date.slice(0,7)+'-01',date],previous:[start,d.toISOString().slice(0,10)]};
  }
  function change(current, previous) { return {difference:current-previous, percent:previous===0?null:(current-previous)/Math.abs(previous)*100}; }
  function rename(records, saved, field, oldName, newName) {
    if(!['lp','medium'].includes(field)) throw Error('登録種別が正しくありません。');
    const list=catalog(records,saved), name=String(newName).trim();
    if(!name || name.length>(field==='lp'?100:80)) throw Error('名前の長さを確認してください。');
    if(list[field].includes(name) && name!==oldName) throw Error('同じ名前がすでに登録されています。');
    if(oldName && !list[field].includes(oldName)) throw Error('編集対象がありません。');
    list[field]=oldName?list[field].map(v=>v===oldName?name:v):[...list[field],name];
    const next=oldName?records.map(r=>r[field]===oldName?{...r,[field]:name}:r):records;
    return parseState(serialize(next,list));
  }
  function profit(r) { return r.profit === null ? r.revenue - r.spend - r.other : r.profit; }
  function total(records) {
    const t = Object.fromEntries([...fields,'profit'].map(k=>[k,0]));
    for (const r of records) { for (const k of fields) t[k] += r[k]; t.profit += profit(r); }
    return {...t, cpa:ratio(t.spend,t.conversions), ctr:ratio(t.clicks,t.impressions,100), cvr:ratio(t.conversions,t.clicks,100), roas:ratio(t.revenue,t.spend,100), cpc:ratio(t.spend,t.clicks), cpm:ratio(t.spend,t.impressions,1000), visitRate:ratio(t.visits,t.clicks,100), closeRate:ratio(t.conversions,t.visits,100), margin:ratio(t.profit,t.revenue,100), costPerVisit:ratio(t.spend,t.visits), profitPerVisit:ratio(t.profit,t.visits)};
  }
  function group(records, mode) {
    const groups = new Map();
    for (const r of records) { const key = mode === 'lp' ? r.lp : mode === 'medium' ? r.medium : mode === 'month' ? r.date.slice(0,7) : r.date; if (!groups.has(key)) groups.set(key,[]); groups.get(key).push(r); }
    return [...groups].map(([label,rows])=>({label, count:rows.length, ...total(rows)})).sort((a,b)=>['lp','medium'].includes(mode) ? b.revenue-a.revenue || a.label.localeCompare(b.label,'ja') : b.label.localeCompare(a.label));
  }
  const api = {fields,today,validDate,validate,parse,serialize,profit,total,group,catalog,parseState,shiftDay,comparisonRanges,change,rename};
  root.AdCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
