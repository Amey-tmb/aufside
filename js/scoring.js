import { POS_SHORT } from './constants.js';

/* ------------------------------ Data helpers ----------------------------- */
export function posOf(el){ return POS_SHORT[el.element_type]; }
export function teamOf(bs, teamId){ return bs.teams.find(t=>t.id===teamId); }
export function crestUrl(teamCode){ return `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`; }
export function photoUrl(code){ return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`; }
export function priceFmt(now_cost){ return '£' + (now_cost/10).toFixed(1) + 'm'; }
export function statusBadge(el){
  if(el.status==='a' && (el.chance_of_playing_next_round===null || el.chance_of_playing_next_round===100)) return null;
  if(el.status==='i') return {label:'Injured', cls:'badge-bad'};
  if(el.status==='s') return {label:'Suspended', cls:'badge-bad'};
  if(el.status==='u') return {label:'Unavailable', cls:'badge-bad'};
  if(el.status==='d') return {label:(el.chance_of_playing_next_round??'?')+'% chance', cls:'badge-warn'};
  if(el.status==='n') return {label:'Not in squad', cls:'badge-mute'};
  return null;
}

/* ==========================================================================
   RECOMMENDATION SCORING ENGINE
   Isolated here so the weights can be tuned independently of the UI.
   All sub-scores are normalised to roughly 0-10 before weighting.
   ========================================================================== */
const SCORING_WEIGHTS = {
  form: 0.35,           // recent form (last ~30 days, FPL's own "form" stat)
  value: 0.15,          // total points per £1m spent
  fixtures: 0.25,       // ease of next 3 fixtures (inverted difficulty)
  minutes: 0.15,        // reliability of starting minutes
  underlying: 0.10,     // xG + xA per 90
};

export function fixtureEaseScore(bs, fixtures, teamId, lookahead=3){
  const upcoming = fixtures
    .filter(f=>!f.finished && (f.team_h===teamId || f.team_a===teamId))
    .sort((a,b)=>(a.event||999)-(b.event||999))
    .slice(0, lookahead);
  if(upcoming.length===0) return 5; // neutral if unknown
  const diffs = upcoming.map(f=> f.team_h===teamId ? (f.team_h_difficulty||3) : (f.team_a_difficulty||3));
  const avgDiff = diffs.reduce((a,b)=>a+b,0)/diffs.length; // 1 (easy) - 5 (hard)
  return (5 - avgDiff) * 2.5; // invert & scale to 0-10
}

export function minutesReliabilityScore(el){
  // starts_per_90 style proxy: minutes played vs matches available so far
  const mins = parseFloat(el.minutes)||0;
  const starts = parseFloat(el.starts)||0;
  if(mins===0) return 0;
  const perStart = starts>0 ? mins/starts : mins;
  return Math.max(0, Math.min(10, (perStart/90)*10));
}

export function underlyingStatScore(el){
  const xgi90 = parseFloat(el.expected_goal_involvements_per_90)||0;
  return Math.max(0, Math.min(10, xgi90 * 12)); // ~0.8 xGI/90 -> ~10
}

export function valueScore(el){
  const price = (el.now_cost||1)/10;
  const pts = parseFloat(el.total_points)||0;
  const ppm = price>0 ? pts/price : 0;
  return Math.max(0, Math.min(10, ppm)); // ~10 pts/£m -> full score
}

export function formScore(el){
  const f = parseFloat(el.form)||0;
  return Math.max(0, Math.min(10, f*1.5)); // form of ~6-7 -> near top score
}

// The single exported scoring function used everywhere in the app.
export function scorePlayer(el, bs, fixtures){
  const s_form = formScore(el);
  const s_value = valueScore(el);
  const s_fix = fixtureEaseScore(bs, fixtures, el.team);
  const s_min = minutesReliabilityScore(el);
  const s_und = underlyingStatScore(el);
  const total =
    s_form * SCORING_WEIGHTS.form +
    s_value * SCORING_WEIGHTS.value +
    s_fix * SCORING_WEIGHTS.fixtures +
    s_min * SCORING_WEIGHTS.minutes +
    s_und * SCORING_WEIGHTS.underlying;
  return {total, breakdown:{form:s_form, value:s_value, fixtures:s_fix, minutes:s_min, underlying:s_und}};
}

// Suggests up to `limit` single swaps: worst-scoring squad players replaced
// by the best-scoring available players in the same position, respecting
// budget (bank + sale price) and the max-3-per-club rule.
export function buildTransferSuggestions(bs, fixtures, squadElements, bank, limit=3){
  const squadTeamCounts = {};
  squadElements.forEach(el=>{ squadTeamCounts[el.team] = (squadTeamCounts[el.team]||0)+1; });
  const squadIds = new Set(squadElements.map(e=>e.id));

  const scoredSquad = squadElements.map(el=>({el, ...scorePlayer(el, bs, fixtures)}))
    .sort((a,b)=>a.total-b.total); // worst first

  const suggestions = [];
  const usedIncoming = new Set();

  for(const weak of scoredSquad){
    if(suggestions.length >= limit) break;
    const pos = weak.el.element_type;
    const budget = bank + weak.el.now_cost; // funds freed by selling + bank
    const candidates = bs.elements.filter(cand=>
      cand.element_type===pos &&
      !squadIds.has(cand.id) &&
      !usedIncoming.has(cand.id) &&
      cand.now_cost <= budget &&
      cand.status==='a' &&
      (squadTeamCounts[cand.team]||0) < 3
    ).map(cand=>({cand, ...scorePlayer(cand, bs, fixtures)}))
     .sort((a,b)=>b.total-a.total);

    const best = candidates[0];
    if(best && best.total > weak.total + 0.6){ // only suggest meaningful upgrades
      usedIncoming.add(best.cand.id);
      suggestions.push({out:weak, in:best});
    }
  }
  return suggestions;
}

export function reasonFor(out, inn, bs){
  const bits = [];
  if(inn.breakdown.form > out.breakdown.form + 1) bits.push(`better recent form (${(inn.cand.form)} vs ${(out.el.form)})`);
  if(inn.breakdown.fixtures > out.breakdown.fixtures + 1) bits.push('easier upcoming fixtures');
  if(inn.breakdown.underlying > out.breakdown.underlying + 1) bits.push('stronger underlying numbers (xG/xA)');
  if(inn.breakdown.minutes > out.breakdown.minutes + 1) bits.push('more reliable minutes');
  if(inn.breakdown.value > out.breakdown.value + 1) bits.push('better points-per-million value');
  if(bits.length===0) bits.push('a modest all-round upgrade this week');
  return bits.join(', ');
}

