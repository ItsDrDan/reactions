#!/usr/bin/env node
/* Mixing Bench checks. Runs the BENCH-LOGIC block of index.html (plus the page's own greenSol and
   equation parser) in Node, and compares every possible mix against solubility rules written
   independently here. Usage: node tools/check-bench.js */
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function grab(name){let i=src.indexOf('function '+name+'(');if(i<0)throw new Error('missing '+name);let j=src.indexOf('{',i),d=0,k=j,q=null;
 for(;k<src.length;k++){const c=src[k];if(q){if(c==='\\'){k++;continue}if(c===q)q=null;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}
  if(c==='/'&&/[=(,:;!&|?{}\s]/.test(src[k-1])&&src[k+1]!=='/'&&src[k+1]!=='*'){k++;let cls=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue}if(r==='[')cls=true;else if(r===']')cls=false;else if(r==='/'&&!cls)break}continue}
  if(c==='{')d++;else if(c==='}'){d--;if(!d)break}}return src.slice(i,k+1);}
const a=src.indexOf('/*BENCH-LOGIC-START'),b=src.indexOf('/*BENCH-LOGIC-END*/');if(a<0||b<0)throw new Error('logic markers missing');
const ctx={console,Math,JSON,Set,Map,Object,Array,String,Number,Error};vm.createContext(ctx);
vm.runInContext(['greenSol','atoms','charge','key','norm','equalSide','equivalent','parseEquation'].map(grab).join('\n')+'\n'+src.slice(a,b)+'\nthis.benchPairs=benchPairs;this.benchSpec=benchSpec;this.benchFormula=benchFormula;this.parseEquation=parseEquation;this.equivalent=equivalent;this.atoms=atoms;this.BENCH_CAT=BENCH_CAT;this.BENCH_AN=BENCH_AN;',ctx);
/* independent green-sheet rules (true = insoluble), for the ions the bench uses */
const G1=['Na','K','NH4','Li'];
function insoluble(m,y){if(G1.includes(m))return false;if(['NO3','C2H3O2'].includes(y))return false;
 if(['Cl','Br','I'].includes(y))return ['Ag','Pb','Hg2'].includes(m);
 if(y==='SO4')return ['Ba','Sr','Pb','Ca','Ag'].includes(m);
 if(y==='F')return ['Mg','Ca','Sr','Ba','Pb'].includes(m);
 if(['CO3','PO4','OH'].includes(y))return true;throw new Error('no rule '+m+' '+y);}
let fails=0,checks=0;const ok=(c,m)=>{checks++;if(!c){fails++;if(fails<30)console.log('FAIL',m)}};
const pairs=ctx.benchPairs();
ok(pairs.length>=120,'expected a large pool, got '+pairs.length);
ok(pairs.filter(p=>p.ppt).length>=60&&pairs.filter(p=>!p.ppt).length>=30,'need both precipitate and no-reaction mixes');
const gcd=(x,y)=>y?gcd(y,x%y):x;
for(const p of pairs){const [fa,M,c,X,x]=p.A,[fb,N,n,Y,y]=p.B,tag=fa+' + '+fb;
 /* starting salts are soluble and charge-neutral */
 ok(!insoluble(M,X)&&!insoluble(N,Y),tag+': a starting salt is insoluble');
 ok(p.ppt===insoluble(M,Y),tag+': precipitate disagrees with independent rules');
 ok(!insoluble(N,X),tag+': the Na/K/NH4 product should always be soluble');
 const s=ctx.benchSpec(p);
 /* ion counts match whole formula units of each salt */
 const [im,ix,iN,iy]=s.ions;ok(Number.isInteger(im.n)&&Number.isInteger(ix.n)&&Number.isInteger(iN.n)&&Number.isInteger(iy.n),tag+': fractional ions');
 ok(im.n*c===ix.n*x,tag+': beaker A not neutral');ok(iN.n*n===iy.n*y,tag+': beaker B not neutral');
 const total=s.ions.reduce((t,i)=>t+i.n,0);ok(total>=4&&total<=24,tag+': '+total+' particles');
 ok(s.options.length===4&&new Set(s.options.map(o=>o.key)).size===4&&s.options.some(o=>o.key===s.answer),tag+': options');
 ok(new Set(s.options.map(o=>o.html)).size===4,tag+': two options read the same');
 ok(!s.options.some(o=>/undefined|null|NaN(?!O)/.test(o.html)),tag+': junk in options');
 if(p.ppt){/* solid formula: neutral, lowest terms, made of exactly the reacting ions */
  const g=gcd(c,y),nm=y/g,ny=c/g;const want=ctx.atoms(s.solid);
  ok(s.net[0][0].n===nm&&s.net[0][1].n===ny,tag+': net coefficients');
  ok(nm*c===ny*y,tag+': net ionic charge not balanced');ok(gcd(nm,ny)===1,tag+': not lowest terms');
  ok(im.n%nm===0&&iy.n%ny===0&&im.n/nm===iy.n/ny&&im.n/nm===s.solidN,tag+': reacting ions not fully used');
  const ionAtoms={};for(const [ion,k] of [[M,nm],[Y,ny]]){const at=ctx.atoms(ion);for(const e in at)ionAtoms[e]=(ionAtoms[e]||0)+at[e]*k;}
  ok(JSON.stringify(Object.entries(ionAtoms).sort())===JSON.stringify(Object.entries(want).sort()),tag+': solid '+s.solid+' atoms do not match the ions');
  ok(JSON.stringify([...s.spect].sort())===JSON.stringify([X,N].sort()),tag+': spectators');
  /* the student-style answer string parses and grades as correct; a version with spectators does not */
  const typed=s.net[0].map(t=>(t.n>1?t.n:'')+t.f+'(aq)').join(' + ')+' -> '+s.solid+'(s)';
  let good=false;try{good=ctx.equivalent(ctx.parseEquation(typed),s.net)}catch(e){}ok(good,tag+': correct typed answer rejected: '+typed);
  const doubled=s.net[0].map(t=>2*t.n+t.f+'(aq)').join(' + ')+' -> 2'+s.solid+'(s)';let dbl=true;try{dbl=ctx.equivalent(ctx.parseEquation(doubled),s.net)}catch(e){dbl=false}ok(!dbl,tag+': non-lowest-terms answer accepted');
  const noState=typed.replace(/\((aq|s)\)/g,'');let ns=true;try{ns=ctx.equivalent(ctx.parseEquation(noState),s.net)}catch(e){ns=false}ok(!ns,tag+': answer without states accepted');}
 else{ok(s.spect.length===4&&s.net===null&&s.answer==='none',tag+': no-reaction case');}}
console.log(checks+' checks on '+pairs.length+' mixes ('+pairs.filter(p=>p.ppt).length+' with a solid): '+(fails?fails+' FAILED':'all passed'));process.exit(fails?1:0);
