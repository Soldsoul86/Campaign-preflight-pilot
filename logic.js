/* Market Sprint 2026-10-22: conservative, browser-local proof-of-work analyzers.
 * No remote fetches, AI calls, tracking, persistence, or external upload.
 */
(function (root) {
  'use strict';
  function unique(xs) { return [...new Set(xs)]; }
  function clean(s) { return String(s == null ? '' : s).trim(); }
  function normalizeLoose(s) { return clean(s).toLowerCase().replace(/\s+/g, ' '); }
  function normalizeDate(s) { return clean(s).slice(0, 10); }
  function htmlToText(html) {
    return clean(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ');
  }
  function percentMentions(s) { return unique([...s.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%/g)].map(x => Number(x[1]))); }
  function isoDates(s) { return unique([...s.matchAll(/\b20\d\d-[01]\d-[0-3]\d\b/g)].map(x => x[0])); }
  function offerCodeMentions(s) {
    return unique([...s.matchAll(/\b(?:promo\s+code|coupon\s+code|discount\s+code|code)\s*[:=\-]?\s*([A-Z][A-Z0-9_\-]{2,})\b/g)].map(x => x[1]));
  }
  function extractHrefs(html) {
    const result=[];
    const tagRe=/<a\s+[^>]*>/gi;
    for (const match of clean(html).matchAll(tagRe)) {
      const found=match[0].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      if (found) result.push(clean(found[1]||found[2]||found[3]||''));
    }
    return result;
  }
  function auditCampaign(data) {
    const expected=data && data.approved ? data.approved : {};
    const email=htmlToText(data && data.emailHtml);
    const landing=htmlToText(data && data.landingText);
    const links=extractHrefs(data && data.emailHtml);
    const issues=[];
    const add=(level,what,where,why) => issues.push({level,what,where,why});
    if (!email) { add('blocker','No email content','Input','Paste the proposed campaign email or HTML.'); return {issues,links,checked:0,scope:'local-static'}; }
    const pct=Number(expected.discountPercent);
    if (Number.isFinite(pct) && pct>0 && pct<=100) {
      const inEmail=percentMentions(email);
      if (inEmail.length && !inEmail.includes(pct)) add('blocker',`Approved discount ${pct}% differs from email ${inEmail.join('%, ')}%`,'Email copy','Confirm the approved offer; a different percentage may describe another claim.');
      if (!inEmail.length) add('review',`Approved ${pct}% offer not found in email`,'Email copy','Check whether it should be present.');
      if (landing) {
        const inLanding=percentMentions(landing);
        if (inLanding.length && !inLanding.includes(pct)) add('blocker',`Landing copy mentions ${inLanding.join('%, ')}%, not approved ${pct}%`,'Landing copy','Verify the page for the same promotion.');
      }
    }
    const code=clean(expected.promoCode).toUpperCase();
    if (code) {
      const inEmail=offerCodeMentions(email);
      if (inEmail.length && !inEmail.includes(code)) add('blocker',`Email promo code differs: ${inEmail.join(', ')} vs ${code}`,'Email copy','Coupon code must be checked in the actual checkout; this tool cannot do that.');
      if (!email.toUpperCase().includes(code)) add('review',`Approved code ${code} not found in email`,'Email copy','Check whether this campaign should state a code.');
      if (landing && !landing.toUpperCase().includes(code)) add('review',`Approved code ${code} not found in landing copy`,'Landing copy','May be intentionally absent; verify against brief.');
    }
    const date=normalizeDate(expected.deadline);
    if (/^20\d\d-\d\d-\d\d$/.test(date)) {
      const mailDates=isoDates(email);
      if (mailDates.length && !mailDates.includes(date)) add('blocker',`Email date ${mailDates.join(', ')} differs from approved ${date}`,'Email copy','Only ISO-format dates are parsed; human-readable dates require review.');
      if (landing) {
        const pageDates=isoDates(landing);
        if (pageDates.length && !pageDates.includes(date)) add('blocker',`Landing date ${pageDates.join(', ')} differs from approved ${date}`,'Landing copy','Confirm the final time and timezone manually.');
      }
    }
    links.forEach((href,i) => {
      if (!href || href==='#' || /^(javascript:|example\.(?:com|org)|https?:\/\/(?:www\.)?example\.(?:com|org))/i.test(href)) add('blocker',`Placeholder or unusable href #${i+1}: ${href||'(empty)'}`,'HTML link','Replace before send. Links were not visited.');
      else if (/^http:/i.test(href)) add('review',`Link #${i+1} uses HTTP`,'HTML link','Consider HTTPS where supported.');
    });
    if (expected.landingUrl && links.length && !links.some(x=>x.replace(/\/$/,'')===clean(expected.landingUrl).replace(/\/$/,''))) add('review','Approved landing URL not found in email links','HTML link','Confirm the intended destination, including redirects and tracking parameters.');
    if (!/unsubscribe|manage (?:your )?preferences|opt out/i.test(email)) add('review','Unsubscribe or preference text not detected','Email copy','Review whether applicable email rules and sender procedures are met. Not a compliance verdict.');
    if (!landing) add('unknown','No independent landing-page copy supplied','Landing copy','Cannot determine whether landing page actually agrees with the email.');
    add('unknown','Live links, discounts, rendering, audience logic and delivery were not tested','Boundaries','This is a local cross-asset consistency check, not a pre-send approval or legal assessment.');
    return {issues, links, checked:1+(landing?1:0), scope:'local-static'};
  }
  function parseCSV(s) {
    const text=String(s==null?'':s).replace(/^\uFEFF/,'');
    const rows=[]; let row=[], field='', q=false;
    for (let i=0;i<text.length;i++) {
      const c=text[i];
      if (q) {
        if (c==='"' && text[i+1]==='"') {field+='"'; i++;}
        else if(c==='"') q=false;
        else field+=c;
      } else if(c==='"') {q=true;}
      else if(c===',') {row.push(field);field='';}
      else if(c==='\n' || c==='\r') {
        if(c==='\r'&&text[i+1]==='\n') i++;
        row.push(field); field='';
        if(row.some(v=>v!==''))rows.push(row);
        row=[];
      } else field+=c;
    }
    if(q) throw new Error('Unclosed CSV quote');
    row.push(field);if(row.some(v=>v!==''))rows.push(row);
    if(!rows.length)return [];
    const headers=rows.shift().map(h=>normalizeLoose(h).replace(/\s/g,'_'));
    if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV column names');
    return rows.map((cells,index)=> {
      if(cells.length!==headers.length)throw new Error(`CSV row ${index+2} has ${cells.length} columns; expected ${headers.length}.`);
      const obj={};headers.forEach((h,i)=>obj[h]=clean(cells[i]));return obj;
    });
  }
  function money(s) {
    const raw=clean(s).toUpperCase();
    const m=raw.match(/^(?:(USD|INR|EUR|GBP)\s*)?(\d+(?:\.\d{1,2})?)(?:\s*(USD|INR|EUR|GBP))?$/);
    if (!m || (m[1] && m[3] && m[1]!==m[3])) return null;
    return {currency:m[1]||m[3]||null,cents:Math.round(Number(m[2])*100)};
  }
  function availability(s) {
    const v=normalizeLoose(s).replace(/[\s-]+/g,'_');
    if(['in_stock','out_of_stock','preorder','backorder'].includes(v))return v;
    return null;
  }
  function auditCatalog(feedText,observedText) {
    const feed=parseCSV(feedText), observed=parseCSV(observedText), issues=[];
    const cols=['id','price','availability'];
    if(!feed.length)throw new Error('Feed CSV is empty.');
    if(!observed.length)throw new Error('Independent observation CSV is empty.');
    for(const col of cols) if(!(col in feed[0]) || !(col in observed[0]))throw new Error(`Both CSV files need a '${col}' column.`);
    const observations=new Map();
    observed.forEach((o,index)=>{
      if(!o.id) issues.push({id:'?',severity:'review',issue:`Observation row ${index+2}: missing id`,feed:'',observed:''});
      else if(observations.has(o.id))issues.push({id:o.id,severity:'review',issue:'Multiple observations for same ID',feed:'',observed:''});
      else observations.set(o.id,o);
    });
    const seen=new Set();
    for(const f of feed){
      const id=f.id;
      if(!id || seen.has(id)) {issues.push({id:id||'?',severity:'blocker',issue:'Missing or duplicate feed ID',feed:'',observed:''});continue;}
      seen.add(id);
      const o=observations.get(id);
      if(!o){issues.push({id,severity:'unknown',issue:'No independent storefront observation',feed:'',observed:''});continue;}
      const fp=money(f.price),op=money(o.price);
      if(!fp||!op||!fp.currency||!op.currency) issues.push({id,severity:'unknown',issue:'Price or currency could not be compared safely',feed:f.price,observed:o.price});
      else if(fp.currency!==op.currency || fp.cents!==op.cents)issues.push({id,severity:'blocker',issue:'Price/currency mismatch',feed:f.price,observed:o.price});
      const fa=availability(f.availability),oa=availability(o.availability);
      if(!fa || !oa)issues.push({id,severity:'unknown',issue:'Availability value not comparable',feed:f.availability,observed:o.availability});
      else if(fa!==oa)issues.push({id,severity:'blocker',issue:'Availability mismatch',feed:f.availability,observed:o.availability});
    }
    return {products:feed.length, observations:observed.length, issues,scope:'two-user-supplied-snapshots'};
  }
  function metrics(issues){return {blockers:issues.filter(x=>x.level==='blocker'||x.severity==='blocker').length,reviews:issues.filter(x=>x.level==='review'||x.severity==='review').length,unknowns:issues.filter(x=>x.level==='unknown'||x.severity==='unknown').length};}
  const out={auditCampaign,auditCatalog,parseCSV,htmlToText,metrics};
  if(typeof module!=='undefined' && module.exports)module.exports=out;
  root.ProofLogic=out;
})(typeof window!=='undefined'?window:globalThis);
