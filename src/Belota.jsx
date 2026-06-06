import { useState, useEffect, useRef, Component } from "react";

class EB extends Component {
  constructor(p){super(p);this.state={e:null};}
  static getDerivedStateFromError(e){return{e};}
  render(){
    if(this.state.e)return(
      <div style={{background:'#111',color:'white',padding:20,minHeight:'100dvh',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
        <div style={{fontSize:14,color:'#e74c3c',fontWeight:'bold'}}>{this.state.e.message}</div>
        <button onClick={()=>this.setState({e:null})}
          style={{background:'#27ae60',color:'white',border:'none',borderRadius:8,padding:'8px 20px',cursor:'pointer'}}>
          Relancer
        </button>
      </div>
    );
    return this.props.children;
  }
}

const SUITS=['♠','♥','♦','♣'];
const RED=s=>s==='♥'||s==='♦';
const SFR={'♠':'Pique','♥':'Cœur','♦':'Carreau','♣':'Trèfle'};
const RANKS=['7','8','9','10','J','Q','K','A'];
const DIS={'7':'7','8':'8','9':'9','10':'10','J':'V','Q':'D','K':'R','A':'A'};
const PN=['Vous','Ouest','Nord','Est'];
const SORD=['♥','♠','♣','♦'];  // ordre : Cœur Pique Trèfle Carreau
const TST={J:8,'9':7,A:6,'10':5,K:4,Q:3,'8':2,'7':1};
const PST={A:8,'10':7,K:6,Q:5,J:4,'9':3,'8':2,'7':1};
const TS={J:7,'9':6,A:5,'10':4,K:3,Q:2,'8':1,'7':0};
const NS={A:7,'10':6,K:5,Q:4,J:3,'9':2,'8':1,'7':0};
const TP={J:20,'9':14,A:11,'10':10,K:4,Q:3,'8':0,'7':0};
const NP={A:11,'10':10,K:4,Q:3,J:2,'9':0,'8':0,'7':0};
const team=p=>(p===0||p===2)?0:1;
const cs=(c,t)=>c.s===t?TS[c.r]:NS[c.r];
const cp=(c,t)=>c.s===t?TP[c.r]:NP[c.r];
const nxt=p=>(p+1)%4;


// ── Prénoms aléatoires pour les IA ───────────────────────────────────────────
const PRENOMS_H=['Baptiste','David','François','Guillaume','Ivan','Kevin','Marc','Nicolas','Olivier','Thomas'];
const PRENOMS_F=['Alice','Clara','Emma','Hélène','Julie','Laura','Marie','Nadia','Rachel','Sophie'];
const TOUS_PRENOMS=[...PRENOMS_H,...PRENOMS_F];
function pickName(exclude=[]){
  const pool=TOUS_PRENOMS.filter(n=>!exclude.includes(n));
  return pool[Math.floor(Math.random()*pool.length)];
}
function genNames(){
  const n1=pickName([]);
  const n2=pickName([n1]);
  const n3=pickName([n1,n2]);
  return{ouest:n1,nord:n2,est:n3};
}

const PW=70,PH=100;   // cartes du pli
const HW=86,HH=124;  // cartes de la main
const AI_DELAY=1300, SHOW_TRICK_MS=2500, BID_DELAY=900;

// ── Tri ───────────────────────────────────────────────────────────────────────
function sortH(hand,trump){
  const safe=(hand||[]).filter(c=>c&&c.s&&c.r);
  if(!safe.length)return[];
  const ord=trump?[trump,...SORD.filter(s=>s!==trump)]:[...SORD];
  const str=c=>(c.s===trump?TST:PST)[c.r]||0;
  return[...safe].sort((a,b)=>{const d=ord.indexOf(a.s)-ord.indexOf(b.s);return d!==0?d:str(b)-str(a);});
}

// ── Deck ──────────────────────────────────────────────────────────────────────
function mkDeck(){return SUITS.flatMap(s=>RANKS.map(r=>({s,r,id:`${r}${s}`})));}
function shuf(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=0|Math.random()*(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;}
function deal(fp){
  const d=shuf(mkDeck());const h=[[],[],[],[]];let i=0;
  for(let k=0;k<4;k++){const p=(fp+k)%4;h[p].push(d[i++],d[i++],d[i++]);}
  for(let k=0;k<4;k++){const p=(fp+k)%4;h[p].push(d[i++],d[i++]);}
  return{hands:h,flip:d[i++],rest:d.slice(i)};
}
function complete(hands,flip,rest,taker){
  const nh=hands.map(h=>h.filter(c=>c&&c.id));
  nh[taker]=[...nh[taker],flip];
  let ri=0,p=taker;
  for(let k=0;k<4;k++){const n=p===taker?2:3;for(let j=0;j<n;j++){const c=rest[ri++];if(c)nh[p].push(c);}p=nxt(p);}
  return nh.map(h=>h.filter(c=>c&&c.id));
}

// ── Règles ────────────────────────────────────────────────────────────────────
function tWin(trick,trump){
  const lead=trick[0].c.s;let best=trick[0];
  for(const t of trick.slice(1)){
    const b=best.c,c=t.c;
    if(c.s===trump&&b.s!==trump){best=t;continue;}
    if(c.s===trump&&b.s===trump&&TS[c.r]>TS[b.r]){best=t;continue;}
    if(c.s===lead&&b.s!==trump&&NS[c.r]>NS[b.r])best=t;
  }
  return best.p;
}
function legal(hand,trick,trump,player){
  const h=hand.filter(c=>c&&c.id);
  if(!trick||!trick.length)return h;
  const lead=trick[0].c.s;
  const tc=h.filter(c=>c.s===trump),lc=h.filter(c=>c.s===lead);
  if(lead===trump){
    if(!tc.length)return h;
    const bt=trick.filter(t=>t.c.s===trump).reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);
    const hi=tc.filter(c=>TS[c.r]>TS[bt.c.r]);return hi.length?hi:tc;
  }
  if(lc.length)return lc;if(!tc.length)return h;
  const w=tWin(trick,trump);if(w===(player+2)%4)return h;
  const pt=trick.filter(t=>t.c.s===trump);
  if(pt.length){const bt=pt.reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);const hi=tc.filter(c=>TS[c.r]>TS[bt.c.r]);if(hi.length)return hi;}
  return tc;
}

// ── IA ENCHÈRES ──────────────────────────────────────────────────────────────
// Valeurs atout pour évaluation
const VALS_AT={J:20,'9':14,A:11,'10':10,K:4,Q:3,'8':0,'7':0};
const VALS_NS={A:8,'10':6,K:4,Q:3,J:2,'9':1,'8':0,'7':0};

// Force des atouts dans la main
function forceAtouts(hand,suit){
  return hand.filter(c=>c.s===suit).reduce((s,c)=>s+(VALS_AT[c.r]||0),0);
}
// Évaluation globale de la main pour l'intermédiaire
function evalMain(hand,suit){
  return hand.reduce((s,c)=>s+(c.s===suit?(VALS_AT[c.r]||0):(VALS_NS[c.r]||0)),0);
}

// ── IA DÉBUTANT — enchères (traduit depuis Python) ───────────────────────────
function aiTakeDebutant(hand,suit,flip,round){
  const withFlip=round===1?[...hand,flip]:hand;
  const nbAtouts=withFlip.filter(c=>c.s===suit).length;
  const force=forceAtouts(hand,suit);
  const aValetMain=hand.some(c=>c.r==='J'&&c.s===suit);
  const a9Main=hand.some(c=>c.r==='9'&&c.s===suit);
  const valetTable=round===1&&flip.r==='J';
  const neufTable=round===1&&flip.r==='9';
  // 1. Combo fort Valet + 9
  if((aValetMain||valetTable)&&(a9Main||neufTable))return true;
  // 2. Force atouts élevée
  if(force>=35)return true;
  // 3. Valet + support
  if((aValetMain||valetTable)&&nbAtouts>=2)return true;
  // 4. Beaucoup d'atouts
  if(nbAtouts>=4)return true;
  return false;
}

// ── IA INTERMÉDIAIRE — enchères (traduit depuis Python) ──────────────────────
function aiTakeIntermediaire(hand,suit,flip,round){
  const withFlip=round===1?[...hand,flip]:hand;
  let score=evalMain(hand,suit);
  const nbAtouts=withFlip.filter(c=>c.s===suit).length;
  const nbValets=withFlip.filter(c=>c.r==='J').length;
  // Bonus/malus structurels
  if(nbAtouts>=5)score+=20;
  else if(nbAtouts<=2)score-=10;
  score+=nbValets*10;
  const aGrosAtout=withFlip.some(c=>(c.r==='J'||c.r==='9')&&c.s===suit);
  if(score>=55)return true;
  if(score>=45&&aGrosAtout)return true;
  return false;
}

// ── IA EXPERT — enchères (logique originale, la plus forte) ──────────────────
function aiTakeExpert(hand,suit,round){
  const tc=hand.filter(c=>c.s===suit);
  return round===1
    ?(tc.some(c=>c.r==='J')||(tc.length>=3&&tc.some(c=>c.r==='9'))||tc.length>=4)
    :(tc.some(c=>c.r==='J')||tc.length>=3);
}

// ── Dispatcher enchères selon difficulté ─────────────────────────────────────
function aiTake(hand,suit,flip,round,diff){
  if(diff==='debutant')     return aiTakeDebutant(hand,suit,flip,round);
  if(diff==='intermediaire')return aiTakeIntermediaire(hand,suit,flip,round);
  return aiTakeExpert(hand,suit,round); // expert (défaut)
}

function aiSuit(hand,ex){
  let best=null,bv=-1;
  for(const s of SUITS){
    if(s===ex)continue;
    const v=hand.filter(c=>c.s===s).reduce((a,c)=>a+TS[c.r],0)+hand.filter(c=>c.s===s).length*2;
    if(v>bv){bv=v;best=s;}
  }
  return best;
}

// ── IA JEU — jouer une carte ──────────────────────────────────────────────────

// Helpers
const lowest =mv=>mv.reduce((b,c)=>cs(c,'__')<cs(b,'__')?c:b); // pas utilisé directement
const lowestBy=(mv,t)=>mv.reduce((b,c)=>cs(c,t)<cs(b,t)?c:b);
const highestBy=(mv,t)=>mv.reduce((b,c)=>cs(c,t)>cs(b,t)?c:b);
const nonTrump=(mv,t)=>mv.filter(c=>c.s!==t);
const isTrump=(c,t)=>c.s===t;

// ── DÉBUTANT : carte légale aléatoire ────────────────────────────────────────
function aiCardDebutant(hand,trick,trump){
  const mv=legal(hand,trick||[],trump,99);
  if(!mv.length)return hand[0];
  return mv[Math.floor(Math.random()*mv.length)];
}

// ── INTERMÉDIAIRE & EXPERT : logique belote correcte ─────────────────────────
function aiCardSmart(hand,trick,trump,player){
  const mv=legal(hand,trick||[],trump,player);
  if(!mv.length)return hand[0];
  const par=(player+2)%4;

  // ── Entame (je commence le pli) ───────────────────────────────────────────
  if(!trick||!trick.length){
    // Jouer un honneur hors-atout en premier (As, 10 si sûr)
    const nt=nonTrump(mv,trump);
    if(nt.length){
      // Privilégier les As hors-atout
      const as=nt.find(c=>c.r==='A');
      if(as)return as;
      return highestBy(nt,trump); // meilleur hors-atout
    }
    // Que des atouts : jouer le plus faible pour ne pas gaspiller
    return lowestBy(mv,trump);
  }

  // ── Suivi de pli ──────────────────────────────────────────────────────────
  const w=tWin(trick,trump);
  const partnerWinning=w===par;
  const lead=trick[0].c.s;
  const mustFollowSuit=mv.some(c=>c.s===lead);
  const mustCut=!mustFollowSuit&&mv.some(c=>isTrump(c,trump));

  // ── Partenaire gagne le pli ───────────────────────────────────────────────
  if(partnerWinning){
    // Ne PAS couper sur la main de son partenaire
    // Jouer la carte hors-atout avec le plus de points (passer des points)
    const nt=nonTrump(mv,trump);
    if(nt.length){
      // Passer le 10 ou l'As si possible (pour que le partenaire marque)
      const honor=nt.filter(c=>c.r==='10'||c.r==='A');
      if(honor.length)return highestBy(honor,trump);
      return lowestBy(nt,trump); // sinon petite carte
    }
    // Que des atouts légaux → pisser avec le plus petit
    return lowestBy(mv,trump);
  }

  // ── Adversaire gagne le pli ───────────────────────────────────────────────
  if(mustFollowSuit){
    // Suivre la couleur : jouer la plus haute si on peut gagner, sinon la plus petite
    const canWin=mv.some(c=>cs(c,trump)>cs(trick.reduce((b,t)=>cs(t.c,trump)>cs(b.c,trump)?t:b).c,trump));
    return canWin?highestBy(mv,trump):lowestBy(mv,trump);
  }

  if(mustCut){
    // Couper : on joue un atout supérieur à celui déjà posé si possible
    const trumpCards=mv.filter(c=>isTrump(c,trump));
    // Vérifier s'il y a déjà un atout dans le pli
    const topTrick=trick.filter(t=>isTrump(t.c,trump));
    if(topTrick.length){
      // Suratout : jouer atout supérieur si possible
      const best=topTrick.reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);
      const overcut=trumpCards.filter(c=>TS[c.r]>TS[best.c.r]);
      if(overcut.length)return highestBy(overcut,trump); // sur-couper
      return lowestBy(trumpCards,trump); // pisser avec le plus petit (obligé)
    }
    // Pas encore d'atout : couper avec le meilleur atout
    return highestBy(trumpCards,trump);
  }

  // Défausse (ni la couleur ni atout disponible légalement)
  return lowestBy(mv,trump);
}

// ── PARTENAIRE PRUDENT ───────────────────────────────────────────────────────
function aiCardPrudent(hand,trick,trump,player){
  const mv=legal(hand,trick||[],trump,player);
  if(!mv.length)return hand[0];
  const par=(player+2)%4;
  if(!trick||!trick.length){
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length)return lowestBy(nt,trump);
    return lowestBy(mv,trump);
  }
  const w=tWin(trick,trump);
  if(w===par){
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length){const hon=nt.filter(c=>c.r==='10'||c.r==='A');if(hon.length)return highestBy(hon,trump);return lowestBy(nt,trump);}
    return lowestBy(mv,trump);
  }
  const nt=mv.filter(c=>c.s!==trump);
  if(nt.length)return highestBy(nt,trump);
  return lowestBy(mv,trump);
}

// ── PARTENAIRE TÊTE BRÛLÉE ───────────────────────────────────────────────────
function aiCardTemeraire(hand,trick,trump,player){
  const mv=legal(hand,trick||[],trump,player);
  if(!mv.length)return hand[0];
  const par=(player+2)%4;
  if(!trick||!trick.length){
    const j=mv.find(c=>c.s===trump&&c.r==='J');if(j)return j;
    return highestBy(mv,trump);
  }
  const w=tWin(trick,trump);
  if(w===par){
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length){const hon=nt.filter(c=>c.r==='10'||c.r==='A');if(hon.length)return highestBy(hon,trump);}
  }
  return highestBy(mv,trump);
}

function aiCard(hand,trick,trump,player,diff,partnerStyle){
  if(player===2&&partnerStyle){
    if(partnerStyle==='prudent')   return aiCardPrudent(hand,trick,trump,player);
    if(partnerStyle==='temeraire') return aiCardTemeraire(hand,trick,trump,player);
  }
  if(diff==='debutant')return aiCardDebutant(hand,trick,trump,player);
  return aiCardSmart(hand,trick,trump,player);
}


// ── Logique des combinaisons (annonces) ──────────────────────────────────────
const ANN_ORDER=['7','8','9','10','J','Q','K','A'];
const CARRE_PTS={J:200,'9':150,A:100,'10':100,K:100,Q:100};

function detectCombos(hand){
  const res=[];
  // Séquences par couleur
  for(const suit of SUITS){
    const idx=hand.filter(c=>c.s===suit).map(c=>ANN_ORDER.indexOf(c.r)).filter(i=>i>=0).sort((a,b)=>a-b);
    if(idx.length<3)continue;
    // Trouver les suites consécutives
    let run=[idx[0]];
    for(let i=1;i<idx.length;i++){
      if(idx[i]===idx[i-1]+1){run.push(idx[i]);}
      else{processRun(run,suit,res);run=[idx[i]];}
    }
    processRun(run,suit,res);
  }
  // Carrés (4 du même rang)
  for(const rank of Object.keys(CARRE_PTS)){
    if(hand.filter(c=>c.r===rank).length===4){
      res.push({type:'carre',rank,pts:CARRE_PTS[rank],
        label:`Carré de ${DIS[rank]}`,topVal:1000+CARRE_PTS[rank]});
    }
  }
  return res;
}

function processRun(run,suit,res){
  if(run.length>=5){
    const top=run[run.length-1];
    res.push({type:'cent',suit,pts:100,topVal:200+top,
      label:`Cent (${ANN_ORDER[run[0]]}→${ANN_ORDER[top]}${suit})`});
  } else if(run.length===4){
    const top=run[run.length-1];
    res.push({type:'cinquante',suit,pts:50,topVal:100+top,
      label:`Cinquante (${ANN_ORDER[run[0]]}→${ANN_ORDER[top]}${suit})`});
  } else if(run.length===3){
    const top=run[run.length-1];
    res.push({type:'tierce',suit,pts:20,topVal:top,
      label:`Tierce (${ANN_ORDER[run[0]]}→${ANN_ORDER[top]}${suit})`});
  }
}

function bestCombo(combos){
  if(!combos.length)return null;
  return combos.reduce((b,c)=>c.topVal>b.topVal?c:b);
}

// Compare deux combos selon les règles belote :
// 1. topVal plus élevé gagne (carrés > suites, suite haute > suite basse)
// 2. À égalité → l'équipe preneuse (taker) est prioritaire
// compareCombo retourne >0 si a gagne, <0 si b gagne
// Le tiebreak est géré dans resolveAnnonces via takerTeam
function compareCombo(a,b){
  if(!a&&!b)return 0;
  if(!a)return -1;
  if(!b)return 1;
  return a.topVal-b.topVal;
}

function resolveAnnonces(allCombos,taker,trump){
  const takerTeam=team(taker);
  const teamBest=[null,null];
  for(let p=0;p<4;p++){
    const best=bestCombo(allCombos[p]||[]);
    const t=team(p);
    if(compareCombo(best,teamBest[t])>0) teamBest[t]=best;
  }
  if(!teamBest[0]&&!teamBest[1])return{winner:-1,pts:[0,0],winTeam:-1};
  if(!teamBest[0])return{winner:1,pts:[0,sumPts(allCombos,1)],winTeam:1};
  if(!teamBest[1])return{winner:0,pts:[sumPts(allCombos,0),0],winTeam:0};
  // Comparaison finale — égalité → équipe preneuse prioritaire
  const cmp=compareCombo(teamBest[0],teamBest[1]);
  const winTeam=cmp>0?0:cmp<0?1:takerTeam;
  const pts=[0,0];
  for(let p=0;p<4;p++){
    if(team(p)===winTeam)(allCombos[p]||[]).forEach(c=>{pts[winTeam]+=c.pts;});
  }
  return{winner:winTeam,pts,winTeam};
}

function sumPts(allCombos,t){
  let s=0;
  for(let p=0;p<4;p++)if(team(p)===t)(allCombos[p]||[]).forEach(c=>{s+=c.pts;});
  return s;
}

function init(scores,dealer){
  const sc=scores||[0,0],dl=dealer!==undefined?dealer:3,fp=nxt(dl);
  const{hands,flip,rest}=deal(fp);
  return{phase:'BID',hands,flip,rest,dealer:dl,fp,trump:null,
    br:1,bi:fp,bc:0,taker:null,tt:null,
    trick:[],snap:[null,null,null,null],waiting:false,winner:null,
    done:[],cur:fp,scores:sc,ann:'',
    bB:[0,0],bH:null,bP:[0,0,0,0],result:null,lw:null,
    annCombos:[[],[],[],[]],annPts:[0,0],annDone:false};
}
function doPlay(G,player,card){
  if(G.waiting)return G;
  const nh=G.hands.map((h,i)=>i===player?h.filter(c=>c&&c.id&&c.id!==card.id):h.filter(c=>c&&c.id));
  const nt=[...(G.trick||[]),{p:player,c:card}];
  const ns=[...G.snap];ns[player]=card;
  let ann='',bb=[...G.bB],bp=[...G.bP];
  if(G.bH&&G.bH[player]&&card.s===G.trump&&(card.r==='K'||card.r==='Q')){
    bp=[...bp];bp[player]++;
    if(bp[player]===1)ann='Belote !';
    if(bp[player]===2){ann='Rebelote !';bb=[...bb];bb[team(player)]+=20;}
  }
  if(ns.filter(c=>c!==null).length<4)return{...G,hands:nh,trick:nt,snap:ns,cur:nxt(player),ann,bB:bb,bP:bp};
  const win=tWin(nt,G.trump);
  return{...G,hands:nh,trick:nt,snap:ns,waiting:true,winner:win,ann,bB:bb,bP:bp};
}
function resolve(G){
  const win=G.winner;
  const nd=[...G.done,{winner:win,cards:G.snap.filter(c=>c&&c.s)}];
  const annDone=nd.length>=1; // masquer les annonces après le 1er pli
  const base={...G,trick:[],snap:[null,null,null,null],waiting:false,winner:null,done:nd,phase:'PLAY',lw:win,ann:'',cur:win,annDone};
  return nd.length===8?calcR(base):base;
}
function calcR(G){
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  let pts=[0,0];
  if(t0===8)pts=[250,0];else if(t0===0)pts=[0,250];
  else for(let i=0;i<8;i++){const d=G.done[i],tm=team(d.winner);pts[tm]+=d.cards.reduce((s,c)=>s+cp(c,G.trump),0);if(i===7)pts[tm]+=10;}
  const tt=G.tt,ot=1-tt;
  let rp=[0,0],res;
  if(pts[tt]>pts[ot]){res='ok';rp=[...pts];}
  else if(pts[tt]===pts[ot]){res='litige';rp=tt===0?[0,162]:[162,0];}
  else{res='chute';rp=tt===0?[0,162]:[162,0];}
  const bB0=G.bB[0],bB1=G.bB[1];
  rp=[rp[0]+bB0,rp[1]+bB1];
  const ttn=tt===0?'Vous+Nord':'Ouest+Est',dtn=tt===0?'Ouest+Est':'Vous+Nord';
  let msg,detail;
  // Détail : plis + belote + total
  const mkDetail=(t0,t1)=>{
    const b0=bB0>0?` +${bB0} Bel.`:'';
    const b1=bB1>0?` +${bB1} Bel.`:'';
    return `Vous+Nord ${t0}${b0} | Adv. ${t1}${b1}`;
  };
  if(res==='ok'){msg=`✅ ${ttn} réussit !`;detail=mkDetail(pts[0],pts[1]);}
  else if(res==='litige'){msg=`🟡 Litige — ${dtn} prend 162`;detail=mkDetail(pts[0],pts[1]);}
  else{msg=`❌ CHUTE ! ${dtn} prend 162`;detail=mkDetail(pts[0],pts[1]);}
  // Ajouter pts annonces (combinaisons)
  const annp=G.annPts||[0,0];
  rp=[rp[0]+annp[0],rp[1]+annp[1]];
  const ns2=[G.scores[0]+rp[0],G.scores[1]+rp[1]];
  const go2=ns2[0]>=1000||ns2[1]>=1000;
  return{...G,phase:go2?'END':'OVER',scores:ns2,result:{pts,rp,res,msg,detail,bB:[bB0,bB1]},ann:''};
}

// ══════════════════════════════════════════════════════════════════════════════
// 🃏  CARTES FRANÇAISES — design propre et lisible
// ══════════════════════════════════════════════════════════════════════════════

// Positions pip standard (% zone centrale x, y)
// Colonnes à 28% et 72%, lignes équiréparties
const PIPS_DEF = {
  '7':  [[28,15],[72,15],[28,38],[72,38],[50,50],[28,73],[72,73]],
  '8':  [[28,13],[72,13],[28,35],[72,35],[28,65],[72,65],[28,87],[72,87]],
  '9':  [[28,13],[72,13],[28,34],[72,34],[50,50],[28,66],[72,66],[28,87],[72,87]],
  '10': [[28,12],[72,12],[50,26],[28,39],[72,39],[28,61],[72,61],[50,74],[28,88],[72,88]],
};

// Couleurs officielles
const COL_SUIT = s => RED(s) ? '#C0392B' : '#1a1a1a';

// ── Pips ──────────────────────────────────────────────────────────────────────
function PipCard({suit,rank,W,H}){
  const pips=PIPS_DEF[rank];
  if(!pips)return null;
  const col=COL_SUIT(suit);
  const fs=W<50?9:W<65?11:14;
  const mTop=H*0.20, mBot=H*0.20, mSide=W*0.12;
  const zW=W-mSide*2, zH=H-mTop-mBot;
  return(
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
      {pips.map(([px,py],i)=>{
        const x=mSide+zW*px/100;
        const y=mTop+zH*py/100;
        const inv=py>55;
        return(
          <div key={i} style={{
            position:'absolute',
            left:x,top:y,
            fontSize:fs,color:col,lineHeight:1,
            transform:`translate(-50%,-50%)${inv?' rotate(180deg)':''}`,
            userSelect:'none',
          }}>{suit}</div>
        );
      })}
    </div>
  );
}

// ── Figures — vraies cartes (images PNG) ────────────────────────────────────
const RANK_NAME = {J:'valet', Q:'dame', K:'roi'};
const SUIT_NAME = {'♠':'pique','♥':'coeur','♦':'carreau','♣':'trefle'};

function FaceCard({suit,rank,W,H}){
  const src=`/${RANK_NAME[rank]} de ${SUIT_NAME[suit]}.png`;
  const isRed=RED(suit);
  const col=COL_SUIT(suit);
  // Fallback si l'image ne charge pas
  const [err,setErr]=useState(false);
  if(err){
    const bg=isRed?'#fff0f0':'#f0f0ff';
    const bigFs=Math.round(H*0.24);
    const rankFs=Math.round(H*0.16);
    return(
      <div style={{position:'absolute',inset:0,background:bg,
        display:'flex',flexDirection:'column',alignItems:'center',
        justifyContent:'center',gap:2}}>
        <span style={{fontSize:rankFs,fontWeight:900,color:col,
          fontFamily:'Georgia,serif',lineHeight:1}}>{DIS[rank]}</span>
        <span style={{fontSize:bigFs,color:col,lineHeight:1}}>{suit}</span>
      </div>
    );
  }
  return(
    <img src={src} alt={`${rank}${suit}`}
      onError={()=>setErr(true)}
      style={{
        position:'absolute',
        top:0, left:0,
        width:'100%', height:'100%',
        objectFit:'fill',
        borderRadius:'inherit',
        display:'block',
        pointerEvents:'none',
      }}/>
  );
}

// ── As ────────────────────────────────────────────────────────────────────────
function AceCard({suit,W,H}){
  const col=COL_SUIT(suit);
  const fs=Math.round(W*0.52);
  return(
    <div style={{
      position:'absolute',inset:0,
      display:'flex',alignItems:'center',justifyContent:'center',
      pointerEvents:'none',
    }}>
      <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {/* Deux cercles décoratifs concentriques */}
        {[0.72,0.95].map((r,i)=>(
          <div key={i} style={{
            position:'absolute',
            width:W*r,height:W*r,
            borderRadius:'50%',
            border:`${i===0?1.5:0.7}px solid ${col}`,
            opacity:i===0?0.18:0.08,
          }}/>
        ))}
        <span style={{
          fontSize:fs,color:col,lineHeight:1,
          position:'relative',zIndex:1,
          filter:'drop-shadow(0 1px 2px rgba(0,0,0,.1))',
        }}>{suit}</span>
      </div>
    </div>
  );
}

// ── Composant Carte ───────────────────────────────────────────────────────────
function Crd({card,ok,W=54,H=76,onClick}){
  if(!card||!card.s)return null;
  const isRed=RED(card.s);
  const col=COL_SUIT(card.s);
  // Taille de l'index coin proportionnelle
  const idxRank=W<46?8:W<58?10:12;
  const idxSuit=W<46?7:W<58?9:11;
  const isFace=['J','Q','K'].includes(card.r);

  return(
    <div onClick={ok?onClick:undefined} style={{
      width:W, height:H,
      borderRadius:Math.max(3,Math.round(W*0.07)),
      position:'relative',
      background:'#ffffff',
      flexShrink:0,
      border: ok
        ? `2.5px solid #27ae60`
        : `1.5px solid ${isRed?'#e8c8c8':'#c8c8e8'}`,
      boxShadow: ok
        ? '0 0 0 2px rgba(39,174,96,.35), 0 4px 16px rgba(0,0,0,.5)'
        : '0 2px 8px rgba(0,0,0,.38), 0 1px 3px rgba(0,0,0,.2)',
      cursor: ok?'pointer':'default',
      opacity: ok===false ? 0.42 : 1,
      filter: ok===false ? 'grayscale(40%)' : 'none',
      overflow:'hidden',
    }}>
      {/* Figures : image PNG plein cadre, pas d'indices (ils sont dans l'image) */}
      {isFace && <FaceCard suit={card.s} rank={card.r} W={W} H={H}/>}

      {/* Autres cartes : indices de coins + contenu central */}
      {!isFace && <>
        {/* Index haut-gauche */}
        <div style={{
          position:'absolute',top:2,left:W<50?2:3,
          display:'flex',flexDirection:'column',alignItems:'center',
          zIndex:5,lineHeight:1,
        }}>
          <span style={{
            fontSize:idxRank,fontWeight:900,color:col,
            fontFamily:'"Georgia","Times New Roman",serif',
            lineHeight:1,display:'block',
          }}>{DIS[card.r]}</span>
          <span style={{fontSize:idxSuit,color:col,lineHeight:1,display:'block'}}>
            {card.s}
          </span>
        </div>

        {/* Contenu central */}
        {card.r==='A' && <AceCard suit={card.s} W={W} H={H}/>}
        {PIPS_DEF[card.r] && <PipCard suit={card.s} rank={card.r} W={W} H={H}/>}

        {/* Index bas-droite (inversé) */}
        <div style={{
          position:'absolute',bottom:2,right:W<50?2:3,
          display:'flex',flexDirection:'column',alignItems:'center',
          transform:'rotate(180deg)',
          zIndex:5,lineHeight:1,
        }}>
          <span style={{
            fontSize:idxRank,fontWeight:900,color:col,
            fontFamily:'"Georgia","Times New Roman",serif',
            lineHeight:1,display:'block',
          }}>{DIS[card.r]}</span>
          <span style={{fontSize:idxSuit,color:col,lineHeight:1,display:'block'}}>
            {card.s}
          </span>
        </div>
      </>}
    </div>
  );
}



// ── Main horizontale ──────────────────────────────────────────────────────────
function Hand({hand,okIds,onPlay,trump}){
  const ids=okIds||new Set();
  const hasOk=okIds!==null&&okIds!==undefined;
  const sorted=sortH(hand,trump);
  const n=sorted.length;if(!n)return null;
  const STEP=Math.min(HW-8,Math.floor(350/Math.max(n-1,1)));
  const totalW=HW+(n-1)*STEP;
  return(
    <div style={{position:'relative',height:HH+16,width:totalW,margin:'0 auto'}}>
      {sorted.map((card,i)=>{
        const ok=hasOk?ids.has(card.id):undefined;
        return(
          <div key={card.id}
            onClick={ok?(e)=>{e.stopPropagation();onPlay(card);}:undefined}
            style={{
              position:'absolute',left:i*STEP,bottom:0,
              width:HW,height:HH,
              zIndex:ok?i+30:i+1,
              transform:ok?'translateY(-14px)':'none',
              transition:'transform .12s ease-out',
              cursor:ok?'pointer':'default',
            }}>
            <Crd card={card} ok={ok} W={HW} H={HH}/>
          </div>
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App({cfg,names,onMenu}){
  const[G,setG]=useState(()=>init());
  const timer=useRef(null);

  // Valet forcé : si la carte retournée est un Valet → prise automatique par fp
  useEffect(()=>{
    if(!cfg?.valetForce)return;
    if(G.phase!=='BID'||G.flip?.r!=='J')return;
    // Prise automatique immédiate par le premier joueur (fp)
    const p=G.fp;
    const hand=G.hands[p].filter(c=>c&&c.id);
    const suit=G.flip.s;
    const nh=complete(G.hands,G.flip,G.rest,p);
    const ac=nh.map(h=>detectCombos(h));
    const ar=resolveAnnonces(ac,p,suit);
    setG(prev=>{
      if(prev.phase!=='BID'||prev.flip?.r!=='J')return prev;
      return{...prev,phase:'PLAY',trump:suit,taker:p,tt:team(p),cur:prev.fp,
        trick:[],snap:[null,null,null,null],waiting:false,winner:null,
        hands:nh,annCombos:ac,annPts:ar.pts,annWinTeam:ar.winTeam,annDone:false,
        bH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))};
    });
  },[G.phase,G.flip?.r,cfg?.valetForce]);

  // Préchargement des 12 images de figures au démarrage → zéro latence ensuite
  useEffect(()=>{
    ['valet','dame','roi'].forEach(r=>
      ['coeur','pique','carreau','trefle'].forEach(s=>{
        const img=new Image();
        img.src=`/${r} de ${s}.png`;
      })
    );
  },[]);
  const[ls,setLs]=useState(()=>typeof window!=='undefined'&&window.innerWidth>window.innerHeight);
  useEffect(()=>{const u=()=>setLs(window.innerWidth>window.innerHeight);window.addEventListener('resize',u);return()=>window.removeEventListener('resize',u);},[]);

  useEffect(()=>{
    if(!G.waiting)return;
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>setG(p=>p.waiting?resolve(p):p),SHOW_TRICK_MS);
    return()=>{if(timer.current)clearTimeout(timer.current);};
  },[G.waiting,G.winner]);

  useEffect(()=>{
    if(G.phase!=='BID'||G.bi===0)return;
    const t=setTimeout(()=>{
      setG(prev=>{
        if(prev.phase!=='BID'||prev.bi===0)return prev;
        const p=prev.bi,hand=prev.hands[p].filter(c=>c&&c.id);
        const take=suit=>{
          const nh=complete(prev.hands,prev.flip,prev.rest,p);
          const ac=nh.map(h=>detectCombos(h));
          const ar=resolveAnnonces(ac,p,suit);
          return{...prev,phase:'PLAY',trump:suit,taker:p,tt:team(p),cur:prev.fp,
            trick:[],snap:[null,null,null,null],waiting:false,winner:null,
            hands:nh,annCombos:ac,annPts:ar.pts,annWinTeam:ar.winTeam,annDone:false,
            bH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))};
        };
        const diff=cfg?.difficulty||'expert';
        if(prev.br===1){if(aiTake(hand,prev.flip.s,prev.flip,1,diff))return take(prev.flip.s);}
        else{const s=aiSuit(hand,prev.flip.s);if(s&&aiTake(hand,s,prev.flip,2,diff))return take(s);}
        const nc=prev.bc+1;
        if(nc>=4){if(prev.br===1)return{...prev,br:2,bi:prev.fp,bc:0};const nd=deal(prev.fp);return{...prev,...nd,br:1,bi:prev.fp,bc:0,trump:null};}
        return{...prev,bi:nxt(prev.bi),bc:nc};
      });
    },BID_DELAY);
    return()=>clearTimeout(t);
  },[G.phase,G.bi,G.br]);

  useEffect(()=>{
    if(G.phase!=='PLAY'||G.cur===0||G.waiting)return;
    const t=setTimeout(()=>{
      setG(prev=>{
        if(prev.phase!=='PLAY'||prev.cur===0||prev.waiting)return prev;
        const p=prev.cur,hand=prev.hands[p].filter(c=>c&&c.id);
        return doPlay(prev,p,aiCard(hand,prev.trick||[],prev.trump,p,cfg?.difficulty||'expert',cfg?.partnerStyle||'actif'));
      });
    },AI_DELAY);
    return()=>clearTimeout(t);
  },[G.phase,G.cur,G.waiting]);

  function bid(suit){
    if(suit!==null){
      setG(prev=>{
      const nh=complete(prev.hands,prev.flip,prev.rest,0);
      const ac=nh.map(h=>detectCombos(h));
      const ar=resolveAnnonces(ac,0,suit);
      return{...prev,phase:'PLAY',trump:suit,taker:0,tt:0,cur:prev.fp,
        trick:[],snap:[null,null,null,null],waiting:false,winner:null,
        hands:nh,annCombos:ac,annPts:ar.pts,annWinTeam:ar.winTeam,annDone:false,
        bH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))};
    });
      return;
    }
    setG(prev=>{
      const nc=prev.bc+1;
      if(nc>=4){if(prev.br===1)return{...prev,br:2,bi:prev.fp,bc:0};const nd=deal(prev.fp);return{...prev,...nd,br:1,bi:prev.fp,bc:0,trump:null};}
      return{...prev,bi:nxt(prev.bi),bc:nc};
    });
  }
  function playCard(card){
    if(G.phase!=='PLAY'||G.cur!==0||G.waiting)return;
    const hand=G.hands[0].filter(c=>c&&c.id);
    if(!legal(hand,G.trick||[],G.trump,0).some(c=>c.id===card.id))return;
    setG(prev=>doPlay(prev,0,card));
  }

  if(!ls)return(
    <div style={{height:'100dvh',background:'#1b4d22',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',color:'white',fontFamily:'Georgia,serif',textAlign:'center',gap:16}}>
      <div style={{fontSize:48}}>📱</div>
      <div style={{fontSize:20,fontWeight:'bold'}}>Retourne ton téléphone</div>
      <div style={{fontSize:14,opacity:.7}}>BELOTA se joue en mode paysage</div>
    </div>
  );

  const tc=cfg&&cfg.tableColor||'#1b5e20';
  const TABLE={position:'fixed',inset:0,
    background:`radial-gradient(ellipse at 50% 40%,${tc}cc 0%,${tc} 50%,${tc}aa 100%)`,
    fontFamily:'Georgia,serif',color:'white',overflow:'hidden',userSelect:'none'};

  // Noms affichés (prénoms pour IA, "Vous" pour joueur)
  // Prénom du partenaire (Nord) fixé selon son style
  const partnerName=cfg?.partnerStyle==='prudent'?'Denis':cfg?.partnerStyle==='temeraire'?'Juan':'David';
  const pName=p=>p===0?'Vous':p===1?(names?.ouest||'Ouest'):p===2?partnerName:(names?.est||'Est');
  const hand0=(G.hands[0]||[]).filter(c=>c&&c.id);
  const myTurn=G.phase==='PLAY'&&G.cur===0&&!G.waiting;
  let okIds=null;
  if(myTurn&&G.trump){try{okIds=new Set(legal(hand0,G.trick||[],G.trump,0).map(c=>c.id));}catch(e){}}
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  const t1=G.done.filter(d=>team(d.winner)===1).length;
  const ac=G.trump&&RED(G.trump)?'#ff8a80':'#80cbc4';

  if(G.phase==='OVER'||G.phase==='END'){
    const r=G.result,nd=nxt(G.dealer);
    return(
      <div style={{...TABLE,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'rgba(0,0,0,.85)',borderRadius:16,padding:26,maxWidth:440,
          width:'90%',textAlign:'center',border:'1px solid rgba(255,255,255,.15)'}}>
          <div style={{fontSize:17,fontWeight:'bold',marginBottom:14}}>
            {G.phase==='END'?'🏆 Partie terminée !':'✓ Fin de manche'}
          </div>
          {r&&<>
            <div style={{fontSize:15,fontWeight:'bold',color:'#ffd54f',marginBottom:5}}>{r.msg}</div>
            <div style={{fontSize:11,opacity:.65,marginBottom:6}}>{r.detail}</div>
            {(r.bB&&(r.bB[0]>0||r.bB[1]>0))&&(
              <div style={{fontSize:11,color:'#ffd54f',marginBottom:10}}>
                🏅 Belote+Rebelote : {r.bB[0]>0?`Vous+Nord +${r.bB[0]}pts`:''}{r.bB[1]>0?`Adv. +${r.bB[1]}pts`:''}
              </div>
            )}
            <div style={{display:'flex',justifyContent:'center',gap:36,marginBottom:14}}>
              <div><div style={{fontSize:10,opacity:.55}}>Vous+Nord</div><div style={{color:'#4caf50',fontWeight:'bold',fontSize:22}}>+{r.rp[0]}</div></div>
              <div><div style={{fontSize:10,opacity:.55}}>Ouest+Est</div><div style={{color:'#ef5350',fontWeight:'bold',fontSize:22}}>+{r.rp[1]}</div></div>
            </div>
            <div style={{fontSize:17,fontWeight:'bold',marginBottom:18}}>
              <span style={{color:'#4caf50'}}>Vous+Nord {G.scores[0]}</span>
              <span style={{opacity:.3}}> — </span>
              <span style={{color:'#ef5350'}}>Adv. {G.scores[1]}</span>
            </div>
          </>}
          {G.phase==='END'
            ?<><div style={{fontSize:14,marginBottom:12}}>{G.scores[0]>=1000?'🎉 Vous gagnez !':'😔 Les adversaires gagnent.'}</div>
              <Btn bg="#388e3c" onClick={()=>setG(init())}>Nouvelle partie</Btn></>
            :<Btn bg="#1976d2" onClick={()=>setG(init(G.scores,nd))}>Manche suivante → Don: {PN[nd]}</Btn>}
        </div>
      </div>
    );
  }

  // ── ENCHÈRES
  if(G.phase==='BID'){
    const mb=G.bi===0;
    return(
      <div style={TABLE}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:30,background:'rgba(0,0,0,.55)',
          display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 34px',zIndex:10}}>
          <div style={{fontWeight:'bold',fontSize:12}}>🃏 BELOTA</div>
          <div style={{fontSize:11}}>
            <span style={{color:'#4caf50',fontWeight:'bold'}}>{G.scores[0]}</span>
            <span style={{opacity:.4}}> — </span>
            <span style={{color:'#ef5350',fontWeight:'bold'}}>{G.scores[1]}</span>
          </div>
          <div style={{fontSize:10,opacity:.7}}>Don: {PN[G.dealer]}</div>
        </div>
        <PL name="Nord" n={(G.hands[2]||[]).length} active={G.bi===2} dealer={G.dealer===2}
          style={{position:'absolute',top:38,left:'50%',transform:'translateX(-50%)',zIndex:5}}/>
        <PL name="Ouest" n={(G.hands[1]||[]).length} active={G.bi===1} dealer={G.dealer===1}
          style={{position:'absolute',top:'46%',left:'13%',transform:'translateY(-50%)',zIndex:5}}/>
        <PL name="Est" n={(G.hands[3]||[]).length} active={G.bi===3} dealer={G.dealer===3}
          style={{position:'absolute',top:'46%',right:'13%',transform:'translateY(-50%)',zIndex:5}}/>
        {/* Carte retournée centrée */}
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-68%)',zIndex:5}}>
          <Crd card={G.flip} W={82} H={118}/>
        </div>

        {mb&&(
          <div style={{position:'absolute',bottom:'28%',left:'50%',
            transform:'translateX(-50%)',zIndex:20,display:'flex',gap:10,alignItems:'center'}}>
            {G.br===1?(<>
              <button onClick={()=>bid(G.flip.s)} style={suitBtn(RED(G.flip?.s)?'rgba(150,20,20,.92)':'rgba(15,45,15,.92)',true)}>
                {G.flip.s}
              </button>
              <button onClick={()=>bid(null)} style={passBtn()}>Passer</button>
            </>):(<>
              {SUITS.filter(s=>s!==G.flip?.s).map(s=>(
                <button key={s} onClick={()=>bid(s)} style={suitBtn(RED(s)?'rgba(150,20,20,.92)':'rgba(15,35,80,.92)',false)}>
                  {s}
                </button>
              ))}
              <button onClick={()=>bid(null)} style={passBtn()}>Passer</button>
            </>)}
          </div>
        )}
        <div style={{position:'absolute',bottom:8,left:0,right:0,zIndex:6,textAlign:'center'}}>
          <Hand hand={hand0} trump={null} okIds={null}/>
        </div>
      </div>
    );
  }

  // ── JEU
  // Cartes du pli en cascade superposée (style vrai jeu de belote)
  return(
    <div style={TABLE}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>

      {/* Barre top */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:28,
        background:'rgba(0,0,0,.6)',display:'flex',justifyContent:'space-between',
        alignItems:'center',padding:'0 34px',zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={onMenu} style={{background:'none',border:'none',
            color:'rgba(255,255,255,.55)',fontSize:11,cursor:'pointer',padding:0}}>
            ← Menu
          </button>
          <span style={{color:ac,fontWeight:'bold',fontSize:11}}>{G.trump} {G.trump?SFR[G.trump]:''}</span>
          <span style={{opacity:.5,fontSize:9}}>{G.tt===0?'V+N':'Adv.'}</span>
        </div>
        <div style={{fontSize:12,color:G.waiting?'#ffd54f':'rgba(255,255,255,.9)',fontWeight:'bold',
          display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
          <span>{G.ann||`Pli ${G.done.length+1}/8`}</span>

        </div>
        <div style={{fontSize:11}}>
          <span style={{color:'#4caf50',fontWeight:'bold'}}>{G.scores[0]}</span>
          <span style={{opacity:.4}}> — </span>
          <span style={{color:'#ef5350',fontWeight:'bold'}}>{G.scores[1]}</span>
          <span style={{opacity:.35,fontSize:9}}> {t0}-{t1}</span>
        </div>
      </div>

      {/* Labels joueurs */}
      <PL name={pName(2)} n={(G.hands[2]||[]).filter(c=>c&&c.id).length}
        active={G.cur===2&&!G.waiting} dealer={G.dealer===2}
        style={{position:'absolute',top:32,left:'50%',transform:'translateX(-50%)',zIndex:10}}/>
      <PL name={pName(1)} n={(G.hands[1]||[]).filter(c=>c&&c.id).length}
        active={G.cur===1&&!G.waiting} dealer={G.dealer===1}
        style={{position:'absolute',top:'44%',left:'13%',transform:'translateY(-50%)',zIndex:10}}/>
      <PL name={pName(3)} n={(G.hands[3]||[]).filter(c=>c&&c.id).length}
        active={G.cur===3&&!G.waiting} dealer={G.dealer===3}
        style={{position:'absolute',top:'44%',right:'13%',transform:'translateY(-50%)',zIndex:10}}/>

      {/* ══════ ANNONCES PREMIER PLI ══════
          Affiche tierce/cinquante/cent/carré pour chaque joueur
          pendant le 1er pli si cfg.combinaisons activé            */}
      {cfg?.combinaisons&&!G.annDone&&G.done.length===0&&G.phase==='PLAY'&&(
        <div style={{
          position:'absolute',
          top:32,left:'50%',
          transform:'translateX(-50%)',
          zIndex:300,
          display:'flex',flexDirection:'column',
          alignItems:'center',gap:4,
          pointerEvents:'none',
        }}>
          {[0,1,2,3].map(p=>{
            const combos=(G.annCombos||[])[p]||[];
            if(!combos.length)return null;
            const pTeam=team(p);
            const wins=G.annWinTeam===pTeam;
            return(
              <div key={p} style={{
                background:wins
                  ?(pTeam===0?'rgba(39,174,96,.92)':'rgba(192,57,43,.92)')
                  :'rgba(80,80,80,.85)',
                border:`1px solid ${wins?(pTeam===0?'#2ecc71':'#e74c3c'):'rgba(255,255,255,.2)'}`,
                borderRadius:12,
                padding:'3px 14px',
                fontSize:11,
                color:wins?'white':'rgba(255,255,255,.55)',
                fontWeight:'bold',
                whiteSpace:'nowrap',
                boxShadow:'0 2px 8px rgba(0,0,0,.4)',
                textDecoration:wins?'none':'line-through',
              }}>
                {pName(p)} : {combos.map(c=>c.label).join(' · ')}
                {wins&&(
                  <span style={{opacity:.8,marginLeft:6}}>
                    +{combos.reduce((s,c)=>s+c.pts,0)} pts
                  </span>
                )}
                {!wins&&(
                  <span style={{opacity:.5,marginLeft:6,fontWeight:'normal'}}>
                    annulée
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════ ZONE DE PLI EN CROIX ══════
          Centrée entre barre top (28px) et main (~252px)
          Centre cible : ~155px. CW=161 CH=196
          ═══════════════════════════════════════ */}
      {(()=>{
        const byP={};
        (G.trick||[]).slice(0,4).forEach(t=>{byP[t.p]=t.c;});
        if(!Object.keys(byP).length)return null;

        const CW=Math.round(PW*2.6);  // ~161px
        const CH=Math.round(PH*2.22); // ~196px
        // Positions de chaque carte dans le conteneur
        const pos={
          2:{l:Math.round(CW/2-PW/2), t:0               },// Nord — haut centre
          1:{l:0,                      t:Math.round(CH/2-PH/2)},// Ouest — gauche
          3:{l:CW-PW,                  t:Math.round(CH/2-PH/2)},// Est — droite
          0:{l:Math.round(CW/2-PW/2), t:CH-PH            },// Vous — bas centre
        };
        return(
          <div style={{
            position:'absolute',
            top:82,          /* descendu vers le centre */
            left:'50%',
            marginLeft:-CW/2,
            width:CW, height:CH,
            zIndex:200, pointerEvents:'none',
          }}>
            {[2,1,3,0].map(p=>{
              if(!byP[p])return null;
              const pp=pos[p];
              return(
                <div key={p} style={{
                  position:'absolute',
                  left:pp.l, top:pp.t,
                  zIndex:p===0?4:p===3?3:p===1?2:1,
                  filter:G.waiting&&G.winner===p
                    ?'drop-shadow(0 0 14px #ffd54f)'
                    :'drop-shadow(0 3px 10px rgba(0,0,0,.55))',
                }}>
                  <Crd card={byP[p]} W={PW} H={PH}/>
                </div>
              );
            })}
            {/* Badge gagnant — à gauche du pli */}
            {G.waiting&&G.winner!==null&&(
              <div style={{
                position:'absolute',
                top:CH/2-14, left:-145,
                background:'rgba(0,0,0,.88)',
                border:'1.5px solid #ffd54f',
                borderRadius:20, padding:'4px 14px',
                fontSize:12, color:'#ffd54f', fontWeight:'bold',
                whiteSpace:'nowrap', zIndex:10,
                pointerEvents:'none',
              }}>
                {PN[G.winner]} ✓
              </div>
            )}
          </div>
        );
      })()}

      {/* Indicateur tour — seulement quand c'est au joueur */}
      {!G.waiting&&myTurn&&(
        <div style={{position:'absolute',bottom:128,left:'50%',transform:'translateX(-50%)',
          zIndex:50,whiteSpace:'nowrap'}}>
          <div style={{background:'rgba(20,80,20,.95)',border:'2px solid #66bb6a',
            borderRadius:20,padding:'4px 14px',fontSize:12,fontWeight:'bold',
            animation:'pulse 1.2s infinite'}}>
            🎯 À vous — jouez une carte
          </div>
        </div>
      )}
      {/* Bannière Belote / Rebelote — animation centrée */}
      {G.ann&&G.ann.includes('elote')&&(
        <div style={{
          position:'absolute',
          top:'38%',left:'50%',
          transform:'translate(-50%,-50%)',
          zIndex:500,
          background:'linear-gradient(135deg,rgba(180,120,0,.95),rgba(120,80,0,.95))',
          border:'2px solid #ffd54f',
          borderRadius:16,
          padding:'10px 28px',
          fontSize:22,fontWeight:900,
          color:'#fff',
          letterSpacing:2,
          textShadow:'0 2px 8px rgba(0,0,0,.5)',
          boxShadow:'0 4px 24px rgba(255,213,79,.5)',
          animation:'beloteAnim .4s ease-out',
          pointerEvents:'none',
          whiteSpace:'nowrap',
        }}>
          {G.ann}
        </div>
      )}
      <style>{`@keyframes beloteAnim{from{opacity:0;transform:translate(-50%,-50%) scale(.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>

      {/* Main joueur */}
      <div style={{position:'absolute',bottom:8,left:0,right:0,zIndex:8,textAlign:'center'}}>
        <Hand hand={hand0} okIds={okIds} onPlay={playCard} trump={G.trump}/>
      </div>
    </div>
  );
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
function EmptySlot({W,H}){
  return <div style={{width:W,height:H,borderRadius:4,
    border:'1px dashed rgba(255,255,255,.12)',
    background:'rgba(255,255,255,.03)'}}/>;
}
function PL({name,n,active,dealer,style={}}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,...style}}>
      <div style={{
        fontSize:active?12:10,fontWeight:active?'bold':'normal',
        color:active?'#ffd54f':'rgba(255,255,255,.7)',
        textShadow:'0 1px 4px rgba(0,0,0,.9)',
        whiteSpace:'nowrap',
      }}>
        {active?'▼ ':''}{name}{dealer?' 🔴':''}
      </div>
      <div style={{
        background:active?'rgba(46,125,50,.7)':'rgba(0,0,0,.45)',
        borderRadius:14,padding:'2px 8px',fontSize:10,
        border:'1px solid rgba(255,255,255,.2)',
        whiteSpace:'nowrap',
        color:'rgba(255,255,255,.85)',
      }}>
        {n}🂠
      </div>
    </div>
  );
}
function Btn({children,onClick,bg}){
  return <button onClick={onClick} style={{background:bg,color:'white',border:'none',
    borderRadius:22,padding:'9px 22px',fontSize:13,cursor:'pointer',fontWeight:'bold',
    boxShadow:'0 3px 8px rgba(0,0,0,.4)'}}>{children}</button>;
}
function suitBtn(bg,big){
  return{background:bg,color:'white',border:'2px solid rgba(255,255,255,.4)',
    borderRadius:'50%',width:big?66:54,height:big?66:54,fontSize:big?30:22,
    display:'flex',alignItems:'center',justifyContent:'center',
    cursor:'pointer',fontWeight:'bold',boxShadow:'0 4px 12px rgba(0,0,0,.5)',flexShrink:0};
}
function passBtn(){
  return{background:'rgba(40,40,40,.85)',color:'rgba(255,255,255,.85)',
    border:'1px solid rgba(255,255,255,.25)',borderRadius:22,padding:'9px 20px',
    fontSize:13,cursor:'pointer',fontWeight:'normal',boxShadow:'0 2px 8px rgba(0,0,0,.4)'};
}

// ══════════════════════════════════════════════════
// 🎴  SPLASH SCREEN
// ══════════════════════════════════════════════════
function SplashScreen({onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2200);return()=>clearTimeout(t);},[]);
  return(
    <div style={{
      position:'fixed',inset:0,
      background:'linear-gradient(135deg,#1a5c24 0%,#0d3b14 60%,#061e0a 100%)',
      display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',
      gap:20,
      paddingTop:'env(safe-area-inset-top)',
      paddingBottom:'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        animation:'splashIn .7s ease-out',
        display:'flex',flexDirection:'column',alignItems:'center',gap:16,
      }}>
        <img src="/belota-icon.png" alt="BELOTA"
          style={{width:110,height:110,borderRadius:24,
            boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}
          onError={e=>{e.target.style.display='none';}}/>
        <div style={{
          fontSize:42,fontWeight:900,color:'white',
          fontFamily:'Georgia,serif',letterSpacing:4,
          textShadow:'0 2px 12px rgba(0,0,0,.5)',
        }}>BELOTA</div>
        <div style={{fontSize:13,color:'rgba(255,255,255,.5)',letterSpacing:2}}>
          JEU DE BELOTE
        </div>
      </div>
      <style>{`
        @keyframes splashIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 🎮  MENU PRINCIPAL
// ══════════════════════════════════════════════════
const DIFFICULTIES=[
  {id:'debutant',      label:'Débutant',      dot:'#27ae60', desc:'IA aléatoire · Parfait pour apprendre les règles'},
  {id:'intermediaire', label:'Intermédiaire', dot:'#f39c12', desc:'IA standard · Jeu équilibré et progressif'},
  {id:'expert',        label:'Expert',        dot:'#e74c3c', desc:'IA optimale · Stratégie maximale · Sans pitié'},
];
const TABLE_COLORS=[
  {id:'#1b5e20', label:'Vert'},
  {id:'#00838f', label:'Cyan'},
  {id:'#0277bd', label:'Bleu'},
  {id:'#00695c', label:'Turquoise'},
  {id:'#558b2f', label:'Vert clair'},
  {id:'#6a1f8a', label:'Violet'},
];

function MenuScreen({cfg,setCfg,onPlay}){
  const[tab,setTab]=useState('play'); // 'play'|'options'|'stats'
  return(
    <div style={{
      position:'fixed',inset:0,
      background:'linear-gradient(160deg,#1a5c24 0%,#0d3b14 100%)',
      display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',
      fontFamily:'Georgia,serif',
      color:'white',overflowY:'auto',
      paddingTop:'max(env(safe-area-inset-top),20px)',
      paddingBottom:'max(env(safe-area-inset-bottom),20px)',
    }}>
      {/* Logo */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',
        paddingTop:40,paddingBottom:20,gap:10}}>
        <img src="/belota-icon.png" alt="BELOTA"
          style={{width:80,height:80,borderRadius:18,boxShadow:'0 4px 16px rgba(0,0,0,.5)'}}
          onError={e=>{e.target.style.display='none';}}/>
        <div style={{fontSize:28,fontWeight:900,letterSpacing:3,
          textShadow:'0 2px 8px rgba(0,0,0,.4)'}}>BELOTA</div>
        <div style={{fontSize:11,opacity:.5,letterSpacing:2}}>JEU DE BELOTE FRANÇAIS</div>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:4,background:'rgba(0,0,0,.3)',
        borderRadius:20,padding:4,marginBottom:20,width:'90%',maxWidth:420}}>
        {[['play','🃏 Jouer'],['options','⚙️ Options'],['stats','📊 Stats']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1,border:'none',borderRadius:16,
            padding:'8px 4px',fontSize:12,cursor:'pointer',fontWeight:'bold',
            background:tab===id?'rgba(255,255,255,.15)':'transparent',
            color:tab===id?'white':'rgba(255,255,255,.5)',
            transition:'all .2s',
          }}>{label}</button>
        ))}
      </div>

      <div style={{width:'90%',maxWidth:420,display:'flex',flexDirection:'column',gap:10}}>

        {/* ─── ONGLET JOUER ─── */}
        {tab==='play'&&<>
          <div style={{fontSize:11,opacity:.5,letterSpacing:1,marginBottom:4,textAlign:'center'}}>
            DIFFICULTÉ
          </div>
          {DIFFICULTIES.map(d=>(
            <button key={d.id} onClick={()=>{setCfg(c=>({...c,difficulty:d.id}));}} style={{
              background:cfg.difficulty===d.id
                ?'rgba(255,255,255,.18)':'rgba(0,0,0,.25)',
              border:cfg.difficulty===d.id
                ?'2px solid rgba(255,255,255,.4)':'2px solid rgba(255,255,255,.08)',
              borderRadius:14,padding:'14px 16px',cursor:'pointer',
              display:'flex',alignItems:'center',gap:14,textAlign:'left',
              transition:'all .15s',
            }}>
              <div style={{width:18,height:18,borderRadius:'50%',
                background:d.dot,flexShrink:0,
                boxShadow:`0 0 8px ${d.dot}88`}}/>
              <div>
                <div style={{fontSize:15,fontWeight:'bold',color:'white',marginBottom:2}}>
                  {d.label}
                </div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.55)'}}>
                  {d.desc}
                </div>
              </div>
              {cfg.difficulty===d.id&&(
                <div style={{marginLeft:'auto',color:'#4caf50',fontSize:18}}>✓</div>
              )}
            </button>
          ))}

          {/* Choix du partenaire */}
          <div style={{fontSize:11,opacity:.5,letterSpacing:1,margin:'14px 0 6px',textAlign:'center'}}>
            PARTENAIRE (Nord)
          </div>
          {[
            {id:'prudent',   emoji:'🛡️', label:'Prudent',      desc:'Joue sûr, économise les atouts'},
            {id:'actif',     emoji:'⚡', label:'Actif',        desc:'Jeu équilibré, s'adapte'},
            {id:'temeraire', emoji:'🔥', label:'Tête brûlée',  desc:'Attaque fort, prend des risques'},
          ].map(s=>(
            <button key={s.id} onClick={()=>setCfg(c=>({...c,partnerStyle:s.id}))} style={{
              background:cfg.partnerStyle===s.id
                ?'rgba(255,255,255,.18)':'rgba(0,0,0,.25)',
              border:cfg.partnerStyle===s.id
                ?'2px solid rgba(255,255,255,.4)':'2px solid rgba(255,255,255,.08)',
              borderRadius:14,padding:'10px 16px',cursor:'pointer',
              display:'flex',alignItems:'center',gap:12,textAlign:'left',
              transition:'all .15s',
            }}>
              <span style={{fontSize:22}}>{s.emoji}</span>
              <div>
                <div style={{fontSize:14,fontWeight:'bold',color:'white'}}>{s.label}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>{s.desc}</div>
              </div>
              {cfg.partnerStyle===s.id&&(
                <div style={{marginLeft:'auto',color:'#4caf50',fontSize:18}}>✓</div>
              )}
            </button>
          ))}

          {/* Bouton lancer */}
          <button onClick={onPlay} style={{
            marginTop:10,
            background:'linear-gradient(135deg,#27ae60,#1e8449)',
            border:'none',borderRadius:16,padding:'16px',
            fontSize:16,fontWeight:900,color:'white',cursor:'pointer',
            letterSpacing:1,
            boxShadow:'0 4px 16px rgba(39,174,96,.4)',
          }}>
            🃏 JOUER
          </button>
        </>}

        {/* ─── ONGLET OPTIONS ─── */}
        {tab==='options'&&<>
          {/* Couleur du tapis */}
          <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:16}}>
            <div style={{fontSize:12,opacity:.6,marginBottom:12,letterSpacing:1}}>
              COULEUR DU TAPIS
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:10,justifyContent:'center'}}>
              {TABLE_COLORS.map(tc=>(
                <div key={tc.id} style={{display:'flex',flexDirection:'column',
                  alignItems:'center',gap:3}}>
                  <button onClick={()=>setCfg(c=>({...c,tableColor:tc.id}))} style={{
                    width:42,height:42,borderRadius:'50%',
                    background:tc.id,border:'none',cursor:'pointer',
                    outline:cfg.tableColor===tc.id?'3px solid white':'3px solid transparent',
                    outlineOffset:2,
                    boxShadow:'0 2px 8px rgba(0,0,0,.4)',
                    transition:'all .15s',
                  }}/>
                  <span style={{fontSize:9,opacity:.6,color:'white'}}>{tc.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Règles */}
          <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:16,
            display:'flex',flexDirection:'column',gap:12}}>
            <div style={{fontSize:12,opacity:.6,letterSpacing:1}}>RÈGLES</div>

            {/* Combinaisons */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{flex:1,marginRight:12}}>
                <div style={{fontSize:14,fontWeight:'bold'}}>Combinaisons</div>
                <div style={{fontSize:11,opacity:.5,lineHeight:1.5}}>
                  Tierce +20 · Cinquante +50 · Cent +100 · Carré V +200 · Carré 9 +150 · Carré As/10/R/D +100
                </div>
              </div>
              <Toggle val={cfg.combinaisons} onToggle={()=>setCfg(c=>({...c,combinaisons:!c.combinaisons}))}/>
            </div>

            {/* Valet forcé */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{flex:1,marginRight:12}}>
                <div style={{fontSize:14,fontWeight:'bold'}}>Valet forcé</div>
                <div style={{fontSize:11,opacity:.5,lineHeight:1.5}}>
                  Si la carte retournée est un Valet, 
                  le premier joueur la prend d'office
                </div>
              </div>
              <Toggle val={cfg.valetForce} onToggle={()=>setCfg(c=>({...c,valetForce:!c.valetForce}))}/>
            </div>
          </div>
        </>}

        {/* ─── ONGLET STATS ─── */}
        {tab==='stats'&&<>
          <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:20,
            textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:8}}>📊</div>
            <div style={{fontSize:14,opacity:.6}}>Statistiques bientôt disponibles</div>
          </div>
        </>}

        {/* Infos */}
        <div style={{textAlign:'center',marginTop:8,fontSize:10,opacity:.3}}>
          BELOTA · aluQ innovation group · v1.0
        </div>
      </div>
    </div>
  );
}

function Toggle({val,onToggle}){
  return(
    <div onClick={onToggle} style={{
      width:46,height:26,borderRadius:13,
      background:val?'#27ae60':'rgba(255,255,255,.2)',
      position:'relative',cursor:'pointer',
      transition:'background .2s',flexShrink:0,
    }}>
      <div style={{
        position:'absolute',
        top:3,left:val?22:3,
        width:20,height:20,borderRadius:'50%',
        background:'white',
        boxShadow:'0 1px 4px rgba(0,0,0,.3)',
        transition:'left .2s',
      }}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 🚀  POINT D'ENTRÉE
// ══════════════════════════════════════════════════
function BelotaRoot(){
  const[screen,setScreen]=useState('SPLASH');
  const[cfg,setCfg]=useState({
    difficulty:'intermediaire',
    tableColor:'#1b5e20',
    combinaisons:false,
    valetForce:false,
    partnerStyle:'actif',
  });
  const[names,setNames]=useState(()=>genNames());

  // Nouveaux prénoms à chaque partie
  function startGame(){setNames(genNames());setScreen('GAME');}

  if(screen==='SPLASH') return <SplashScreen onDone={()=>setScreen('MENU')}/>;
  if(screen==='MENU')   return(
    <MenuScreen cfg={cfg} setCfg={setCfg} onPlay={startGame}/>
  );
  return <App cfg={cfg} names={names} onMenu={()=>setScreen('MENU')}/>;
}

export default function Belota(){
  return <EB><BelotaRoot/></EB>;
}
