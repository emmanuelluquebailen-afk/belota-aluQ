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
const VALS_AT={J:20,'9':14,A:11,'10':10,K:4,Q:3,'8':0,'7':0};
const VALS_NS={A:8,'10':6,K:4,Q:3,J:2,'9':1,'8':0,'7':0};

function forceAtouts(hand,suit){
  return hand.filter(c=>c.s===suit).reduce((s,c)=>s+(VALS_AT[c.r]||0),0);
}
function evalMain(hand,suit){
  return hand.reduce((s,c)=>s+(c.s===suit?(VALS_AT[c.r]||0):(VALS_NS[c.r]||0)),0);
}

function aiTakeDebutant(hand,suit,flip,round){
  const withFlip=round===1?[...hand,flip]:hand;
  const nbAtouts=withFlip.filter(c=>c.s===suit).length;
  const force=forceAtouts(hand,suit);
  const aValetMain=hand.some(c=>c.r==='J'&&c.s===suit);
  const a9Main=hand.some(c=>c.r==='9'&&c.s===suit);
  const valetTable=round===1&&flip.r==='J';
  const neufTable=round===1&&flip.r==='9';
  if((aValetMain||valetTable)&&(a9Main||neufTable))return true;
  if(force>=35)return true;
  if((aValetMain||valetTable)&&nbAtouts>=2)return true;
  if(nbAtouts>=4)return true;
  return false;
}

function aiTakeIntermediaire(hand,suit,flip,round){
  const withFlip=round===1?[...hand,flip]:hand;
  let score=evalMain(hand,suit);
  const nbAtouts=withFlip.filter(c=>c.s===suit).length;
  const nbValets=withFlip.filter(c=>c.r==='J').length;
  if(nbAtouts>=5)score+=20;
  else if(nbAtouts<=2)score-=10;
  score+=nbValets*10;
  const aGrosAtout=withFlip.some(c=>(c.r==='J'||c.r==='9')&&c.s===suit);
  if(score>=55)return true;
  if(score>=45&&aGrosAtout)return true;
  return false;
}

const EVAL_AT_EXP={J:30,'9':25,A:12,'10':10,K:5,Q:4,'8':1,'7':0};
const EVAL_NS_EXP={A:10,'10':8,K:3,Q:2,J:1,'9':0,'8':0,'7':0};

function evalMainExpert(hand,suit,flip){
  const main=flip?[...hand,flip]:hand;
  let score=0,nbAt=0,nbAs=0,nbDix=0;
  const rep={'♠':0,'♥':0,'♦':0,'♣':0};
  for(const c of main){
    if(!c||!c.s)continue;
    rep[c.s]=(rep[c.s]||0)+1;
    if(c.s===suit){nbAt++;score+=(EVAL_AT_EXP[c.r]||0);}
    else{score+=(EVAL_NS_EXP[c.r]||0);if(c.r==='A')nbAs++;if(c.r==='10')nbDix++;}
  }
  if(nbAt>=5)score+=25;else if(nbAt===4)score+=15;else if(nbAt===3)score+=5;else score-=15;
  const aV=main.some(c=>c.r==='J'&&c.s===suit);
  const a9=main.some(c=>c.r==='9'&&c.s===suit);
  if(aV)score+=20; if(a9)score+=12; if(aV&&a9)score+=20;
  score+=nbAs*5+nbDix*3;
  for(const s of SUITS){
    if(s===suit)continue;
    if((rep[s]||0)===0)score+=8;
    else if((rep[s]||0)===1)score+=5;
  }
  return score;
}

function aiTakeExpert(hand,suit,flip,round,scores){
  const score=evalMainExpert(hand,suit,round===1?flip:null);
  const [sNous,sAdv]=scores||[0,0];
  let seuil=round===1?70:60;
  if(sAdv>=900&&sAdv>sNous)seuil-=15;
  else if(sNous>=900)seuil+=10;
  return score>=seuil;
}

function aiTake(hand,suit,flip,round,diff,scores){
  if(diff==='debutant')     return aiTakeDebutant(hand,suit,flip,round);
  if(diff==='intermediaire')return aiTakeIntermediaire(hand,suit,flip,round);
  return aiTakeExpert(hand,suit,flip,round,scores);
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

// ── IA JEU ────────────────────────────────────────────────────────────────────
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

// ── Helpers stratégiques ─────────────────────────────────────────────────────

// Valet "sec" = seul atout en main
const valetSec=(hand,trump)=>hand.filter(c=>c.s===trump).length===1&&hand.some(c=>c.r==='J'&&c.s===trump);

// On a le 10 de la même couleur qu'un As → appel légitime
const has10ofSuit=(hand,suit)=>hand.some(c=>c.r==='10'&&c.s===suit);

// Meilleur atout en main excluant le Valet (sauf si sec)
function smallTrump(hand,trump){
  const atouts=hand.filter(c=>c.s===trump);
  if(!atouts.length)return null;
  const sec=valetSec(hand,trump);
  // Si Valet sec → on peut l'utiliser, sinon on l'exclut
  const pool=sec?atouts:atouts.filter(c=>c.r!=='J');
  if(!pool.length)return atouts.find(c=>c.r==='J')||null; // que le valet non-sec, on est obligé
  return lowestBy(pool,trump);
}

// Vraie carte la plus petite hors-atout (jamais 10, As sauf appel)
function safeDiscard(hand,trump,toPartner=false){
  const nt=hand.filter(c=>c.s!==trump&&c.r!=='10');
  if(!nt.length)return lowestBy(hand.filter(c=>c.s!==trump).length?hand.filter(c=>c.s!==trump):hand,trump);
  // Éviter les As sauf appel (partenaire + on a le 10)
  const noAce=nt.filter(c=>!(c.r==='A'&&!(toPartner&&has10ofSuit(hand,c.s))));
  return lowestBy(noAce.length?noAce:nt,trump);
}

// Couleurs fortes des adversaires d'après annonces
function strongSuitsAdv(annCombos,player){
  const suits=new Set();
  for(let p=0;p<4;p++){
    if(team(p)===team(player))continue;
    (annCombos||[])[p]?.forEach(c=>{if(c.suit)suits.add(c.suit);});
  }
  return suits;
}

// Couleurs fortes du partenaire d'après annonces
function strongSuitsPar(annCombos,player){
  const par=(player+2)%4;
  const suits=new Set();
  (annCombos||[])[par]?.forEach(c=>{if(c.suit)suits.add(c.suit);});
  return suits;
}

// ── LOGIQUE PRINCIPALE (Intermédiaire + Expert) ───────────────────────────────
function aiCardSmart(hand,trump,player,trick,taker,annCombos){
  const mv=legal(hand,trick||[],trump,player);
  if(!mv.length)return hand[0];
  const par=(player+2)%4;
  const isTaker=taker===player;
  const advStrong=strongSuitsAdv(annCombos,player);
  const parStrong=strongSuitsPar(annCombos,player);

  // ══ ENTAME (je commence le pli) ═══════════════════════════════════════════
  if(!trick||!trick.length){

    // ── JE SUIS LE PRENEUR → jouer atout ────────────────────────────────────
    if(isTaker){
      const atouts=mv.filter(c=>c.s===trump);
      if(atouts.length){
        // Valet en premier s'il est disponible
        const valet=atouts.find(c=>c.r==='J');
        if(valet)return valet;
        // Sinon petit atout pour faire tomber les atouts adverses
        return smallTrump(hand,trump)||lowestBy(atouts,trump);
      }
    }

    // ── JE NE SUIS PAS LE PRENEUR → jeter petit, jamais 10 ─────────────────
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length){
      // Éviter couleurs fortes des adversaires
      const safe=nt.filter(c=>!advStrong.has(c.s));
      const pool=safe.length?safe:nt;
      // Jouer As si on a le 10 (appel partenaire) — couleur forte du partenaire en priorité
      const callSuit=[...parStrong].find(s=>pool.some(c=>c.r==='A'&&c.s===s)&&has10ofSuit(hand,s));
      if(callSuit){const ace=pool.find(c=>c.r==='A'&&c.s===callSuit);if(ace)return ace;}
      // Sinon : jamais de 10, jamais d'As sans le 10, jouer le plus petit
      const noHonor=pool.filter(c=>c.r!=='10'&&!(c.r==='A'&&!has10ofSuit(hand,c.s)));
      return lowestBy(noHonor.length?noHonor:pool,trump);
    }
    // Que des atouts → petit atout sans Valet sauf sec
    return smallTrump(hand,trump)||lowestBy(mv,trump);
  }

  // ══ SUIVI DE PLI ══════════════════════════════════════════════════════════
  const w=tWin(trick,trump);
  const partnerWinning=w===par;
  const lead=trick[0].c.s;
  const mustFollowSuit=mv.some(c=>c.s===lead);
  const mustCut=!mustFollowSuit&&mv.some(c=>isTrump(c,trump));

  // ── PARTENAIRE GAGNE LE PLI ───────────────────────────────────────────────
  if(partnerWinning){
    const nt=nonTrump(mv,trump);
    if(nt.length){
      // Passer As si on a le 10 (on récupérera le 10 plus tard)
      // ou passer le 10 si partenaire est sûr de gagner
      const honor=nt.filter(c=>(c.r==='A'&&has10ofSuit(hand,c.s))||c.r==='10');
      if(honor.length)return highestBy(honor,trump);
      // Sinon jeter le plus petit sans As ni 10
      return safeDiscard(mv.filter(c=>c.s!==trump),trump,true)||lowestBy(nt,trump);
    }
    // Que des atouts → pisser avec le plus petit, jamais le Valet sauf sec
    return smallTrump(hand,trump)||lowestBy(mv,trump);
  }

  // ── ADVERSAIRE GAGNE LE PLI ───────────────────────────────────────────────

  // Suivre la couleur
  if(mustFollowSuit){
    const best=trick.reduce((b,t)=>cs(t.c,trump)>cs(b.c,trump)?t:b);
    const canWin=mv.some(c=>cs(c,trump)>cs(best.c,trump));
    if(canWin)return highestBy(mv,trump); // monter pour gagner
    return lowestBy(mv,trump);            // jouer petit sinon
  }

  // Couper
  if(mustCut){
    const trumpCards=mv.filter(c=>isTrump(c,trump));
    // Ne jamais couper avec le Valet sauf s'il est sec
    const noValet=trumpCards.filter(c=>c.r!=='J');
    const pool=valetSec(hand,trump)?trumpCards:noValet.length?noValet:trumpCards;
    const topTrick=trick.filter(t=>isTrump(t.c,trump));
    if(topTrick.length){
      const best=topTrick.reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);
      const overcut=pool.filter(c=>TS[c.r]>TS[best.c.r]);
      if(overcut.length)return lowestBy(overcut,trump); // sur-couper avec le plus petit qui suffit
      return lowestBy(pool,trump);
    }
    return lowestBy(pool,trump); // couper avec le plus petit atout disponible
  }

  // Défausse
  return safeDiscard(mv,trump,false)||lowestBy(mv,trump);
}

// ── PARTENAIRE PRUDENT (Denis) ────────────────────────────────────────────────
function aiCardPrudent(hand,trump,player,trick,taker,annCombos){
  const mv=legal(hand,trick||[],trump,player);
  if(!mv.length)return hand[0];
  const par=(player+2)%4;

  if(!trick||!trick.length){
    // Prudent : jamais de risque, toujours petit, jamais atout sauf obligé
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length){
      const noHonor=nt.filter(c=>c.r!=='10'&&c.r!=='A'&&c.r!=='J');
      return lowestBy(noHonor.length?noHonor:nt,trump);
    }
    return smallTrump(hand,trump)||lowestBy(mv,trump);
  }

  const w=tWin(trick,trump);
  if(w===par){
    // Partenaire gagne → passer points si possible
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length){
      const honor=nt.filter(c=>(c.r==='A'&&has10ofSuit(hand,c.s))||c.r==='10');
      if(honor.length)return highestBy(honor,trump);
      return lowestBy(nt,trump);
    }
    return smallTrump(hand,trump)||lowestBy(mv,trump);
  }

  // Adversaire gagne
  const mustFollowSuit=mv.some(c=>c.s===trick[0].c.s);
  if(mustFollowSuit){
    const best=trick.reduce((b,t)=>cs(t.c,trump)>cs(b.c,trump)?t:b);
    const canWin=mv.some(c=>cs(c,trump)>cs(best.c,trump));
    return canWin?highestBy(mv,trump):lowestBy(mv,trump);
  }
  const mustCut=mv.some(c=>isTrump(c,trump));
  if(mustCut){
    // Prudent : couper seulement si ça vaut le coup, jamais le Valet
    const trumpCards=mv.filter(c=>isTrump(c,trump));
    const noValet=trumpCards.filter(c=>c.r!=='J');
    const pool=valetSec(hand,trump)?trumpCards:noValet.length?noValet:trumpCards;
    return lowestBy(pool,trump);
  }
  return safeDiscard(mv,trump,false)||lowestBy(mv,trump);
}

// ── PARTENAIRE TÊTE BRÛLÉE (Juan) ────────────────────────────────────────────
function aiCardTemeraire(hand,trump,player,trick,taker,annCombos){
  const mv=legal(hand,trick||[],trump,player);
  if(!mv.length)return hand[0];
  const par=(player+2)%4;

  if(!trick||!trick.length){
    // Tête brûlée : joue Valet d'abord, puis As si a le 10, sinon fort
    const atouts=mv.filter(c=>c.s===trump);
    const valet=atouts.find(c=>c.r==='J');
    if(valet)return valet;
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length){
      // As si on a le 10 (appel)
      const ace=nt.find(c=>c.r==='A'&&has10ofSuit(hand,c.s));
      if(ace)return ace;
      // Sinon le plus fort hors-As et 10
      const noHonor=nt.filter(c=>c.r!=='10'&&c.r!=='A');
      return highestBy(noHonor.length?noHonor:nt,trump);
    }
    // Que des atouts → Valet si sec, sinon le plus fort sans Valet
    return smallTrump(hand,trump)||lowestBy(mv,trump);
  }

  const w=tWin(trick,trump);
  if(w===par){
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length){
      const honor=nt.filter(c=>(c.r==='A'&&has10ofSuit(hand,c.s))||c.r==='10');
      if(honor.length)return highestBy(honor,trump);
      return highestBy(nt,trump);
    }
    return smallTrump(hand,trump)||lowestBy(mv,trump);
  }

  // Adversaire gagne → jouer fort pour tenter de gagner
  const mustFollowSuit=mv.some(c=>c.s===trick[0].c.s);
  if(mustFollowSuit){
    const best=trick.reduce((b,t)=>cs(t.c,trump)>cs(b.c,trump)?t:b);
    const canWin=mv.some(c=>cs(c,trump)>cs(best.c,trump));
    return canWin?highestBy(mv,trump):lowestBy(mv,trump);
  }
  const mustCut=mv.some(c=>isTrump(c,trump));
  if(mustCut){
    const trumpCards=mv.filter(c=>isTrump(c,trump));
    // Tête brûlée coupe avec le plus fort, mais pas le Valet sauf sec
    const noValet=trumpCards.filter(c=>c.r!=='J');
    const pool=valetSec(hand,trump)?trumpCards:noValet.length?noValet:trumpCards;
    const topTrick=trick.filter(t=>isTrump(t.c,trump));
    if(topTrick.length){
      const best=topTrick.reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);
      const overcut=pool.filter(c=>TS[c.r]>TS[best.c.r]);
      if(overcut.length)return highestBy(overcut,trump);
      return lowestBy(pool,trump);
    }
    return highestBy(pool,trump);
  }
  return safeDiscard(mv,trump,false)||lowestBy(mv,trump);
}

function aiCard(hand,trick,trump,player,diff,partnerStyle,taker,annCombos){
  if(player===2&&partnerStyle){
    if(partnerStyle==='prudent')   return aiCardPrudent(hand,trump,player,trick,taker,annCombos);
    if(partnerStyle==='temeraire') return aiCardTemeraire(hand,trump,player,trick,taker,annCombos);
  }
  if(diff==='debutant')return aiCardDebutant(hand,trick,trump);
  return aiCardSmart(hand,trump,player,trick,taker,annCombos);
}


// ── Logique des combinaisons (annonces) ──────────────────────────────────────
const ANN_ORDER=['7','8','9','10','J','Q','K','A'];
const CARRE_PTS={J:200,'9':150,A:100,'10':100,K:100,Q:100};

function detectCombos(hand){
  const res=[];
  for(const suit of SUITS){
    const idx=hand.filter(c=>c.s===suit).map(c=>ANN_ORDER.indexOf(c.r)).filter(i=>i>=0).sort((a,b)=>a-b);
    if(idx.length<3)continue;
    let run=[idx[0]];
    for(let i=1;i<idx.length;i++){
      if(idx[i]===idx[i-1]+1){run.push(idx[i]);}
      else{processRun(run,suit,res);run=[idx[i]];}
    }
    processRun(run,suit,res);
  }
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

function init(scores,dealer,mw){
  const sc=scores||[0,0],dl=dealer!==undefined?dealer:3,fp=nxt(dl);
  const{hands,flip,rest}=deal(fp);
  return{phase:'BID',hands,flip,rest,dealer:dl,fp,trump:null,
    br:1,bi:fp,bc:0,taker:null,tt:null,
    trick:[],snap:[null,null,null,null],waiting:false,winner:null,
    done:[],cur:fp,scores:sc,ann:'',
    bB:[0,0],bH:null,bP:[0,0,0,0],result:null,lw:null,
    annCombos:[[],[],[],[]],annPts:[0,0],annDone:false,
    mancheWins:mw||[0,0]};
}
function doPlay(G,player,card){
  if(G.waiting)return G;
  const nh=G.hands.map((h,i)=>i===player?h.filter(c=>c&&c.id&&c.id!==card.id):h.filter(c=>c&&c.id));
  const nt=[...(G.trick||[]),{p:player,c:card}];
  const ns=[...G.snap];ns[player]=card;
  let ann='',bb=[...G.bB],bp=[...G.bP];
  if(G.bH&&G.bH[player]&&card.s===G.trump&&(card.r==='K'||card.r==='Q')){
    const belge=(G.cfg?.beloteOrder||'francaise')==='belge';
    if(belge){
      // Belge : Roi obligatoire en premier
      if(bp[player]===0&&card.r==='K'){bp=[...bp];bp[player]++;ann='Belote !';}
      else if(bp[player]===1&&card.r==='Q'){bp=[...bp];bp[player]++;ann='Rebelote !';bb=[...bb];bb[team(player)]+=20;}
    } else {
      // Française : Dame ou Roi en premier, l'autre ensuite
      if(bp[player]===0&&(card.r==='K'||card.r==='Q')){bp=[...bp];bp[player]++;ann='Belote !';}
      else if(bp[player]===1&&(card.r==='K'||card.r==='Q')){bp=[...bp];bp[player]++;ann='Rebelote !';bb=[...bb];bb[team(player)]+=20;}
    }
  }
  if(ns.filter(c=>c!==null).length<4)return{...G,hands:nh,trick:nt,snap:ns,cur:nxt(player),ann,bB:bb,bP:bp};
  const win=tWin(nt,G.trump);
  return{...G,hands:nh,trick:nt,snap:ns,waiting:true,winner:win,ann,bB:bb,bP:bp};
}
function resolve(G){
  const win=G.winner;
  const nd=[...G.done,{winner:win,cards:G.snap.filter(c=>c&&c.s)}];
  const annDone=nd.length>=2;
  // Au début du pli 2 : déclencher l'affichage des bannières d'annonces
  const showAnnBanner=nd.length===1&&G.cfg?.combinaisons&&(G.annPts||[0,0]).some(p=>p>0);
  const base={...G,trick:[],snap:[null,null,null,null],waiting:false,winner:null,done:nd,phase:'PLAY',lw:win,ann:'',cur:win,annDone,showAnnBanner};
  return nd.length===8?calcR(base):base;
}
function calcR(G){
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  let pts=[0,0];
  if(t0===8)pts=[250,0];else if(t0===0)pts=[0,250];
  else for(let i=0;i<8;i++){const d=G.done[i],tm=team(d.winner);pts[tm]+=d.cards.reduce((s,c)=>s+cp(c,G.trump),0);if(i===7)pts[tm]+=10;}
  const tt=G.tt,ot=1-tt;
  const bB0=G.bB[0],bB1=G.bB[1];
  const ann=G.annPts||[0,0];

  const totalT0=pts[0]+bB0+ann[0];
  const totalT1=pts[1]+bB1+ann[1];
  const grandTotal=totalT0+totalT1;

  const totalTT=tt===0?totalT0:totalT1;
  const totalOT=tt===0?totalT1:totalT0;

  let rp=[0,0],res;
  if(totalTT>totalOT){
    res='ok';
    rp=[totalT0,totalT1];
  } else if(totalTT===totalOT){
    res='litige';
    rp=tt===0?[0,grandTotal]:[grandTotal,0];
  } else {
    res='chute';
    rp=tt===0?[0,grandTotal]:[grandTotal,0];
  }

  const ttn=tt===0?'Vous+Nord':'Ouest+Est',dtn=tt===0?'Ouest+Est':'Vous+Nord';
  let msg,detail;
  const mkDetail=()=>{
    const b0=bB0>0?` +${bB0}Bel`:'';
    const b1=bB1>0?` +${bB1}Bel`:'';
    const a0=ann[0]>0?` +${ann[0]}ann`:'';
    const a1=ann[1]>0?` +${ann[1]}ann`:'';
    return `Nous: ${pts[0]}${b0}${a0} pts | Eux: ${pts[1]}${b1}${a1} pts`;
  };
  if(res==='ok'){msg=`✅ ${ttn} réussit !`;detail=mkDetail();}
  else if(res==='litige'){msg=`🟡 Litige — ${dtn} prend tout`;detail=mkDetail();}
  else{msg=`❌ CHUTE ! ${dtn} prend tout (${grandTotal} pts)`;detail=mkDetail();}
  const ns2=[G.scores[0]+rp[0],G.scores[1]+rp[1]];
  const mancheWinner=ns2[0]>=1000?0:ns2[1]>=1000?1:-1;
  const mw=[...(G.mancheWins||[0,0])];
  if(mancheWinner>=0)mw[mancheWinner]++;
  const matchOver=mw[0]>=2||mw[1]>=2;
  const phase=matchOver?'MATCH_OVER':mancheWinner>=0?'MANCHE_OVER':'OVER';
  if(matchOver){
    try{
      const sk='belota_stats';
      let st=JSON.parse(localStorage.getItem(sk)||'{}');
      const ps=G.cfg?.partnerStyle||'actif';
      if(!st.total)st.total={m:0,mg:0,pp:0,pg:0};
      if(!st[ps])st[ps]={m:0,mg:0,pp:0,pg:0};
      st.total.pp=(st.total.pp||0)+1;
      st[ps].pp=(st[ps].pp||0)+1;
      if(mw[0]>=2){st.total.pg=(st.total.pg||0)+1;st[ps].pg=(st[ps].pg||0)+1;}
      localStorage.setItem(sk,JSON.stringify(st));
    }catch(e){}
  }
  if(mancheWinner>=0){
    try{
      const sk='belota_stats';
      let st=JSON.parse(localStorage.getItem(sk)||'{}');
      const ps=G.cfg?.partnerStyle||'actif';
      if(!st.total)st.total={m:0,mg:0,pp:0,pg:0};
      if(!st[ps])st[ps]={m:0,mg:0,pp:0,pg:0};
      st.total.m=(st.total.m||0)+1;
      st[ps].m=(st[ps].m||0)+1;
      if(mancheWinner===0){st.total.mg=(st.total.mg||0)+1;st[ps].mg=(st[ps].mg||0)+1;}
      localStorage.setItem(sk,JSON.stringify(st));
    }catch(e){}
  }
  return{...G,phase,scores:ns2,mancheWins:mw,result:{pts,rp,res,msg,detail,bB:[bB0,bB1]},ann:''};
}

// ══════════════════════════════════════════════════════════════════════════════
// 🃏  CARTES — images PNG pour toutes les cartes (7/8/9/10/J/Q/K) + As dessiné
// ══════════════════════════════════════════════════════════════════════════════

const COL_SUIT = s => RED(s) ? '#C0392B' : '#1a1a1a';

// Noms pour la construction des URLs PNG
// Figures : "valet de coeur.png" | Numériques : "7 de carreau.png"
const RANK_NAME = {
  J:'valet', Q:'dame', K:'roi',
  '7':'7', '8':'8', '9':'9', '10':'10'
};
const SUIT_NAME = {'♠':'pique','♥':'coeur','♦':'carreau','♣':'trefle'};

// ── Carte avec image PNG (figures + numériques 7/8/9/10) ─────────────────────
function PngCard({suit,rank,W,H}){
  const src=`/${RANK_NAME[rank]} de ${SUIT_NAME[suit]}.png`;
  const isRed=RED(suit);
  const col=COL_SUIT(suit);
  const[err,setErr]=useState(false);
  if(err){
    // Fallback dessiné si l'image est absente
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
        top:0,left:0,
        width:'100%',height:'100%',
        objectFit:'fill',
        borderRadius:'inherit',
        display:'block',
        pointerEvents:'none',
      }}/>
  );
}

// ── As — dessiné (pas de PNG pour l'As) ──────────────────────────────────────
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
  const idxRank=W<46?8:W<58?10:12;
  const idxSuit=W<46?7:W<58?9:11;

  // Toutes les cartes sauf l'As utilisent une image PNG
  const isPng=['J','Q','K','7','8','9','10'].includes(card.r);
  const isAce=card.r==='A';

  return(
    <div onClick={ok?onClick:undefined} style={{
      width:W,height:H,
      borderRadius:Math.max(3,Math.round(W*0.07)),
      position:'relative',
      background:'#ffffff',
      flexShrink:0,
      border:ok
        ?`2.5px solid #27ae60`
        :`1.5px solid ${isRed?'#e8c8c8':'#c8c8e8'}`,
      boxShadow:ok
        ?'0 0 0 2px rgba(39,174,96,.35), 0 4px 16px rgba(0,0,0,.5)'
        :'0 2px 8px rgba(0,0,0,.38), 0 1px 3px rgba(0,0,0,.2)',
      cursor:ok?'pointer':'default',
      opacity:ok===false?0.72:1,
      filter:ok===false?'grayscale(20%)':'none',
      overflow:'hidden',
    }}>
      {/* PNG : image plein cadre — les index sont dans l'image */}
      {isPng && <PngCard suit={card.s} rank={card.r} W={W} H={H}/>}

      {/* As : dessiné avec index de coins */}
      {isAce && <>
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
        <AceCard suit={card.s} W={W} H={H}/>
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
  const[G,setG]=useState(()=>{
    try{
      const saved=localStorage.getItem('belota_game');
      if(saved){const g=JSON.parse(saved);if(g&&g.phase&&g.phase!=='MATCH_OVER')return g;}
    }catch(e){}
    return init();
  });
  useEffect(()=>{setG(p=>({...p,cfg}));},[cfg]);
  useEffect(()=>{
    try{
      if(G.phase&&G.phase!=='SPLASH')localStorage.setItem('belota_game',JSON.stringify(G));
    }catch(e){}
  },[G]);
  const timer=useRef(null);

  // Valet forcé
  useEffect(()=>{
    if(!cfg?.valetForce)return;
    if(G.phase!=='BID'||G.flip?.r!=='J')return;
    const p=G.fp;
    const suit=G.flip.s;
    const nh=complete(G.hands,G.flip,G.rest,p);
    const ac=nh.map(h=>detectCombos(h));
    const ar=resolveAnnonces(ac,p,suit);
    setG(prev=>{
      if(prev.phase!=='BID'||prev.flip?.r!=='J')return prev;
      return{...prev,phase:'PLAY',trump:suit,taker:p,tt:team(p),cur:prev.fp,
        trick:[],snap:[null,null,null,null],waiting:false,winner:null,
        hands:nh,annCombos:ac,annPts:ar.pts,annWinTeam:ar.winTeam,annDone:false,
        bH:nh.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))};
    });
  },[G.phase,G.flip?.r,cfg?.valetForce]);

  // Préchargement de toutes les images PNG
  useEffect(()=>{
    // Figures
    ['valet','dame','roi'].forEach(r=>
      ['coeur','pique','carreau','trefle'].forEach(s=>{
        const img=new Image();img.src=`/${r} de ${s}.png`;
      })
    );
    // Numériques
    ['7','8','9','10'].forEach(r=>
      ['coeur','pique','carreau','trefle'].forEach(s=>{
        const img=new Image();img.src=`/${r} de ${s}.png`;
      })
    );
  },[]);

  const isTablet=typeof window!=='undefined'&&(window.innerWidth>=768||window.innerHeight>=768);
  const[ls,setLs]=useState(()=>typeof window!=='undefined'&&(window.innerWidth>window.innerHeight||isTablet));
  useEffect(()=>{const u=()=>setLs(window.innerWidth>window.innerHeight||window.innerWidth>=768||window.innerHeight>=768);window.addEventListener('resize',u);return()=>window.removeEventListener('resize',u);},[]);

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
            bH:nh.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))};
        };
        const diff=cfg?.difficulty||'intermediaire';
        if(prev.br===1){if(aiTake(hand,prev.flip.s,prev.flip,1,diff))return take(prev.flip.s);}
        else{const s=aiSuit(hand,prev.flip.s);if(s&&aiTake(hand,s,prev.flip,2,diff))return take(s);}
        const nc=prev.bc+1;
        if(nc>=4){if(prev.br===1)return{...prev,br:2,bi:prev.fp,bc:0};const nd=nxt(prev.dealer);const nfp=nxt(nd);const deal2=deal(nfp);return{...prev,...deal2,dealer:nd,fp:nfp,br:1,bi:nfp,bc:0,trump:null};}
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
        return doPlay(prev,p,aiCard(hand,prev.trick||[],prev.trump,p,cfg?.difficulty||'intermediaire',cfg?.partnerStyle||'actif',prev.taker,prev.annCombos));
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
        bH:nh.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))};
    });
      return;
    }
    setG(prev=>{
      const nc=prev.bc+1;
      if(nc>=4){if(prev.br===1)return{...prev,br:2,bi:prev.fp,bc:0};const nd=nxt(prev.dealer);const nfp=nxt(nd);const deal2=deal(nfp);return{...prev,...deal2,dealer:nd,fp:nfp,br:1,bi:nfp,bc:0,trump:null};}
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
    background:`radial-gradient(ellipse at 50% 40%,${tc}ee 0%,${tc}bb 55%,${tc}99 100%)`,
    fontFamily:'Georgia,serif',color:'white',overflow:'hidden',userSelect:'none'};

  const partnerName=cfg?.partnerStyle==='prudent'?'Denis':cfg?.partnerStyle==='temeraire'?'Juan':'David';
  const pName=p=>p===0?'Vous':p===1?(names?.ouest||'Ouest'):p===2?partnerName:(names?.est||'Est');
  const hand0=(G.hands[0]||[]).filter(c=>c&&c.id);
  const myTurn=G.phase==='PLAY'&&G.cur===0&&!G.waiting;
  let okIds=null;
  if(myTurn&&G.trump){try{okIds=new Set(legal(hand0,G.trick||[],G.trump,0).map(c=>c.id));}catch(e){}}
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  const t1=G.done.filter(d=>team(d.winner)===1).length;
  const ac=G.trump&&RED(G.trump)?'#ff8a80':'#80cbc4';

  if(G.phase==='OVER'||G.phase==='MANCHE_OVER'||G.phase==='MATCH_OVER'){
    const r=G.result,nd=nxt(G.dealer);
    const mw=G.mancheWins||[0,0];
    const matchOver=G.phase==='MATCH_OVER';
    const mancheOver=G.phase==='MANCHE_OVER';
    const weWin=mw[0]>=2;
    return(
      <div style={{...TABLE,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'rgba(0,0,0,.88)',borderRadius:18,padding:26,maxWidth:440,
          width:'92%',textAlign:'center',border:'1px solid rgba(255,255,255,.15)'}}>

          <div style={{fontSize:17,fontWeight:'bold',marginBottom:10}}>
            {matchOver?(weWin?'🏆 Vous gagnez le match !':'😔 Match perdu'):'✓ Fin de manche'}
          </div>

          {(mancheOver||matchOver)&&(
            <div style={{display:'flex',justifyContent:'center',gap:20,marginBottom:12}}>
              {[0,1].map(t=>(
                <div key={t} style={{textAlign:'center'}}>
                  <div style={{fontSize:10,opacity:.5}}>{t===0?'Nous':'Eux'}
                  <div style={{fontSize:18,fontWeight:'bold',color:t===0?'#4caf50':'#ef5350'}}>
                    {'⭐'.repeat(mw[t])}{'☆'.repeat(2-mw[t])}
                  </div>
                  <div style={{fontSize:11,opacity:.6}}>{mw[t]} manche{mw[t]>1?'s':''}</div>
                </div>
              ))}
            </div>
          )}

          {r&&(()=>{
            // Victoire = Vous+Nord ont plus de points cette manche
            const weWonManche=r.rp[0]>r.rp[1];
            const draw=r.rp[0]===r.rp[1];
            return(<>
              {/* Titre victoire/défaite */}
              <div style={{
                fontSize:22,fontWeight:900,marginBottom:6,
                color:draw?'#ffd54f':weWonManche?'#4caf50':'#ef5350',
              }}>
                {draw?'🟡 Égalité':weWonManche?'✅ Manche gagnée !':'❌ Manche perdue'}
              </div>

              {/* Détail plis */}
              <div style={{fontSize:11,opacity:.6,marginBottom:10}}>{r.detail}</div>

              {/* Belote bonus */}
              {(r.bB&&(r.bB[0]>0||r.bB[1]>0))&&(
                <div style={{fontSize:11,color:'#ffd54f',marginBottom:8}}>
                  🏅 {r.bB[0]>0?`Vous+Nord +${r.bB[0]}pts Belote `:''}
                     {r.bB[1]>0?`Adv. +${r.bB[1]}pts Belote`:''}
                </div>
              )}

              {/* Points de la manche */}
              <div style={{
                background:'rgba(255,255,255,.06)',borderRadius:12,
                padding:'10px 20px',marginBottom:10,
              }}>
                <div style={{fontSize:10,opacity:.5,marginBottom:6,letterSpacing:1}}>POINTS DE LA MANCHE</div>
                <div style={{display:'flex',justifyContent:'center',gap:32}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:10,opacity:.5}}>Nous</div>
                    <div style={{color:weWonManche?'#4caf50':'#ef5350',fontWeight:'bold',fontSize:24}}>+{r.rp[0]}</div>
                  </div>
                  <div style={{alignSelf:'center',opacity:.3,fontSize:18}}>—</div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:10,opacity:.5}}>Eux</div>
                    <div style={{color:weWonManche?'#ef5350':'#4caf50',fontWeight:'bold',fontSize:24}}>+{r.rp[1]}</div>
                  </div>
                </div>
              </div>

              {/* Total partie */}
              <div style={{
                background:'rgba(255,255,255,.06)',borderRadius:12,
                padding:'10px 20px',marginBottom:14,
              }}>
                <div style={{fontSize:10,opacity:.5,marginBottom:6,letterSpacing:1}}>TOTAL PARTIE</div>
                <div style={{display:'flex',justifyContent:'center',gap:32}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:10,opacity:.5}}>Nous</div>
                    <div style={{color:'#4caf50',fontWeight:'bold',fontSize:20}}>{G.scores[0]}</div>
                  </div>
                  <div style={{alignSelf:'center',opacity:.3,fontSize:18}}>—</div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:10,opacity:.5}}>Eux</div>
                    <div style={{color:'#ef5350',fontWeight:'bold',fontSize:20}}>{G.scores[1]}</div>
                  </div>
                </div>
              </div>
            </>);
          })()}

          {matchOver?(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Btn bg="#388e3c" onClick={()=>setG(init([0,0],nd,[0,0]))}>🃏 Nouvelle partie</Btn>
              <button onClick={onMenu} style={{background:'none',border:'1px solid rgba(255,255,255,.3)',
                borderRadius:20,padding:'8px 16px',color:'rgba(255,255,255,.7)',cursor:'pointer',fontSize:13}}>
                ← Menu principal
              </button>
            </div>
          ):(
            <Btn bg="#1976d2" onClick={()=>setG(init(mancheOver?[0,0]:G.scores,nd,mw))}>
              {mancheOver?`Manche ${mw[0]+mw[1]+1}/3 →`:`Manche suivante →`} Don: {PN[nd]}
            </Btn>
          )}
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
        <PL name={pName(2)} n={(G.hands[2]||[]).length} active={G.bi===2} dealer={G.dealer===2}
          style={{position:'absolute',top:38,left:'50%',transform:'translateX(-50%)',zIndex:5}}/>
        <PL name={pName(1)} n={(G.hands[1]||[]).length} active={G.bi===1} dealer={G.dealer===1}
          style={{position:'absolute',top:'46%',left:'13%',transform:'translateY(-50%)',zIndex:5}}/>
        <PL name={pName(3)} n={(G.hands[3]||[]).length} active={G.bi===3} dealer={G.dealer===3}
          style={{position:'absolute',top:'46%',right:'13%',transform:'translateY(-50%)',zIndex:5}}/>
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
        trump={G.taker===2?G.trump:null}
        style={{position:'absolute',top:32,left:'50%',transform:'translateX(-50%)',zIndex:10}}/>
      <PL name={pName(1)} n={(G.hands[1]||[]).filter(c=>c&&c.id).length}
        active={G.cur===1&&!G.waiting} dealer={G.dealer===1}
        trump={G.taker===1?G.trump:null}
        style={{position:'absolute',top:'44%',left:'13%',transform:'translateY(-50%)',zIndex:10}}/>
      <PL name={pName(3)} n={(G.hands[3]||[]).filter(c=>c&&c.id).length}
        active={G.cur===3&&!G.waiting} dealer={G.dealer===3}
        trump={G.taker===3?G.trump:null}
        style={{position:'absolute',top:'44%',right:'13%',transform:'translateY(-50%)',zIndex:10}}/>

      {/* ANNONCES */}
      {cfg?.combinaisons&&!G.annDone&&G.done.length===1&&G.phase==='PLAY'&&
        [0,1,2,3].map(p=>{
          const combos=(G.annCombos||[])[p]||[];
          if(!combos.length)return null;
          const pTeam=team(p);
          const wins=G.annWinTeam===pTeam;
          const best=combos.reduce((b,c)=>c.pts>b.pts?c:b,combos[0]);
          const FW=38,FH=54,STEP=22;
          let fanCards=[];
          if(best.type==='carre'){
            fanCards=SUITS.map(s=>({r:best.rank,s,id:`ann${best.rank}${s}`}));
          } else {
            const match=best.label.match(/\(([^→]+)→/);
            const startRank=match?match[1]:'7';
            const startIdx=ANN_ORDER.indexOf(startRank);
            const len=best.type==='tierce'?3:best.type==='cinquante'?4:5;
            fanCards=Array.from({length:len},(_,i)=>({
              r:ANN_ORDER[Math.min(startIdx+i,7)],s:best.suit,id:`ann${p}${i}`
            }));
          }
          const n=fanCards.length;
          const fanW=FW+(n-1)*STEP;
          const fanH=FH+30;
          const pos=p===2
            ?{top:58,right:'8%'}
            :p===1
            ?{top:`calc(44% - ${fanH+14}px)`,left:'8%'}
            :p===3
            ?{top:'50%',right:'8%'}
            :{bottom:10,left:8};
          return(
            <div key={p} style={{
              position:'absolute',...pos,
              zIndex:300,display:'flex',flexDirection:'column',
              alignItems:'center',gap:3,pointerEvents:'none',
            }}>
              <div style={{position:'relative',width:fanW,height:FH+12}}>
                {fanCards.map((c,i)=>{
                  const angle=(i-(n-1)/2)*9;
                  return(
                    <div key={c.id} style={{
                      position:'absolute',left:i*STEP,top:0,
                      width:FW,height:FH,
                      transform:`rotate(${angle}deg)`,
                      transformOrigin:'50% 100%',
                      zIndex:i+1,
                      filter:wins?'none':'grayscale(80%) opacity(.4)',
                    }}>
                      <Crd card={c} W={FW} H={FH}/>
                    </div>
                  );
                })}
              </div>
              <div style={{
                background:wins?(pTeam===0?'rgba(39,174,96,.9)':'rgba(192,57,43,.9)'):'rgba(50,50,50,.8)',
                borderRadius:7,padding:'2px 7px',fontSize:9,fontWeight:'bold',
                color:wins?'white':'rgba(255,255,255,.35)',
                textDecoration:wins?'none':'line-through',whiteSpace:'nowrap',
              }}>
                {pName(p)}{wins?` +${combos.reduce((s,c)=>s+c.pts,0)}pts`:''}
              </div>
            </div>
          );
        })
      }

      {/* ZONE DE PLI EN CROIX */}
      {(()=>{
        const byP={};
        (G.trick||[]).slice(0,4).forEach(t=>{byP[t.p]=t.c;});
        if(!Object.keys(byP).length)return null;

        // Taille des cartes du pli adaptée à l'écran
        const screenH=window.innerHeight;
        const screenW=window.innerWidth;
        const isLarge=screenW>=1024||screenH>=768;
        const CPW=isLarge?96:80, CPH=isLarge?138:116;
        const CW=CPW*2;
        const CH=CPH*1.58;

        // Zone disponible : top=65px (barre+label), bottom=screenH-155px (main)
        const zoneTop=65;
        const zoneBot=screenH-(HH+16+8+20); // main + padding
        const zoneCenter=(zoneTop+zoneBot)/2;
        const trickTop=Math.round(zoneCenter-CH/2);

        const pos={
          2:{l:Math.round(CW/2-CPW/2), t:0},
          1:{l:0,                       t:Math.round(CH/2-CPH/2)},
          3:{l:CW-CPW,                  t:Math.round(CH/2-CPH/2)},
          0:{l:Math.round(CW/2-CPW/2),  t:Math.round(CH-CPH)},
        };
        return(
          <div style={{
            position:'absolute',
            top:trickTop,
            left:'50%',
            marginLeft:-CW/2,
            width:CW,height:CH,
            zIndex:200,pointerEvents:'none',
          }}>
            {[2,1,3,0].map(p=>{
              if(!byP[p])return null;
              const pp=pos[p];
              return(
                <div key={p} style={{
                  position:'absolute',
                  left:pp.l,top:pp.t,
                  zIndex:p===0?4:p===3?3:p===1?2:1,
                  filter:G.waiting&&G.winner===p
                    ?'drop-shadow(0 0 14px #ffd54f)'
                    :'drop-shadow(0 3px 10px rgba(0,0,0,.55))',
                }}>
                  <Crd card={byP[p]} W={CPW} H={CPH}/>
                </div>
              );
            })}
            {G.waiting&&G.winner!==null&&(
              <div style={{
                position:'absolute',
                top:CH/2-14,left:isLarge?-165:-145,
                background:'rgba(0,0,0,.88)',
                border:'1.5px solid #ffd54f',
                borderRadius:20,padding:'4px 14px',
                fontSize:12,color:'#ffd54f',fontWeight:'bold',
                whiteSpace:'nowrap',zIndex:10,
                pointerEvents:'none',
              }}>
                {PN[G.winner]} ✓
              </div>
            )}
          </div>
        );
      })()}

      {/* Indicateur tour */}
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

      {/* Bannière Belote / Rebelote */}
      {G.ann&&G.ann.includes('elote')&&(
        <div style={{
          position:'absolute',
          top:'40%',left:'50%',
          transform:'translate(-50%,-50%)',
          zIndex:500,
          background:'linear-gradient(135deg,rgba(180,120,0,.97),rgba(120,60,0,.97))',
          border:'2px solid #ffd54f',
          borderRadius:18,
          padding:'12px 32px',
          fontSize:24,fontWeight:900,
          color:'#fff',
          letterSpacing:3,
          textShadow:'0 2px 8px rgba(0,0,0,.6)',
          boxShadow:'0 6px 28px rgba(255,213,79,.6)',
          animation:'beloteAnim .35s ease-out',
          pointerEvents:'none',
          whiteSpace:'nowrap',
        }}>
          {G.ann}
          {G.bP&&G.bP[G.cur]===2&&<div style={{fontSize:13,textAlign:'center',opacity:.8,marginTop:4}}>+20 pts 🏅</div>}
        </div>
      )}

      {/* Bannières annonces — au début du pli 2, une par joueur ayant une annonce */}
      {G.showAnnBanner&&G.done.length===1&&[0,1,2,3].map(p=>{
        const combos=(G.annCombos||[])[p]||[];
        if(!combos.length)return null;
        const pTeam=team(p);
        const wins=G.annWinTeam===pTeam;
        const totalPts=combos.reduce((s,c)=>s+c.pts,0);
        const best=combos.reduce((b,c)=>c.pts>b.pts?c:b,combos[0]);
        // Position verticale décalée pour chaque joueur (éviter superposition)
        const offsets=[0,1,2,3];
        const idx=offsets.indexOf(p);
        const topPct=30+idx*12;
        return(
          <div key={p} style={{
            position:'absolute',
            top:`${topPct}%`,left:'50%',
            transform:'translate(-50%,-50%)',
            zIndex:490+p,
            background:wins
              ?(pTeam===0?'linear-gradient(135deg,rgba(20,100,20,.97),rgba(10,60,10,.97))':'linear-gradient(135deg,rgba(140,20,20,.97),rgba(80,10,10,.97))')
              :'linear-gradient(135deg,rgba(60,60,60,.95),rgba(30,30,30,.95))',
            border:`2px solid ${wins?(pTeam===0?'#4caf50':'#ef5350'):'rgba(255,255,255,.2)'}`,
            borderRadius:16,
            padding:'8px 22px',
            fontSize:15,fontWeight:900,
            color:'#fff',
            letterSpacing:1,
            textShadow:'0 1px 4px rgba(0,0,0,.6)',
            boxShadow:`0 4px 18px ${wins?(pTeam===0?'rgba(76,175,80,.5)':'rgba(239,83,80,.5)'):'rgba(0,0,0,.4)'}`,
            animation:'beloteAnim .35s ease-out',
            pointerEvents:'none',
            whiteSpace:'nowrap',
            opacity:wins?1:0.6,
          }}>
            <span style={{marginRight:8}}>{p===0?'Vous':p===2?(cfg?.partnerStyle==='prudent'?'Denis':cfg?.partnerStyle==='temeraire'?'Juan':'David'):pName(p)}</span>
            <span style={{opacity:.8}}>{best.label}</span>
            <span style={{marginLeft:8,color:wins?'#ffd54f':'rgba(255,255,255,.5)',textDecoration:wins?'none':'line-through'}}>
              {wins?`+${totalPts} pts`:'annulée'}
            </span>
          </div>
        );
      })}
      <style>{`@keyframes beloteAnim{from{opacity:0;transform:translate(-50%,-50%) scale(.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>

      {/* Main joueur */}
      <div style={{position:'absolute',bottom:8,left:0,right:0,zIndex:8,textAlign:'center'}}>
        <Hand hand={hand0} okIds={okIds} onPlay={playCard} trump={G.trump}/>
      </div>
    </div>
  );
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
function PL({name,n,active,dealer,trump,style={}}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,...style}}>
      <div style={{
        fontSize:active?12:10,fontWeight:active?'bold':'normal',
        color:active?'#ffd54f':'rgba(255,255,255,.7)',
        textShadow:'0 1px 4px rgba(0,0,0,.9)',
        whiteSpace:'nowrap',
      }}>
        {active?'▼ ':''}{name}{dealer?' 🔴':''}{trump?<span style={{marginLeft:5,fontSize:18,color:RED(trump)?'#ff8a80':'white',lineHeight:1}}>{trump}</span>:null}
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
        <div style={{fontSize:11,color:'rgba(255,255,255,.3)',letterSpacing:1,marginTop:4}}>
          by aluQ ENTERTAINMENT
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
  const[tab,setTab]=useState('play');
  const[avis,setAvis]=useState({
    stars:0,fluide:'',ia:'',bugs:'',aime:'',change:'',multi:'',sent:false
  });
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

      {/* Onglets — masqués sur l'écran info */}
      <div style={{display:tab==='info'?'none':'flex',gap:4,background:'rgba(0,0,0,.3)',
        borderRadius:20,padding:4,marginBottom:20,width:'90%',maxWidth:420}}>
        {[
          ['play',  '🃏','Jouer'],
          ['options','⚙️','Règles'],
          ['stats', '📊','Stats'],
          ['avis',  '💬','Avis'],
          ['info',  'ℹ️','Info'],
        ].map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1,border:'none',borderRadius:16,
            padding:'8px 2px',cursor:'pointer',
            background:tab===id?'rgba(255,255,255,.15)':'transparent',
            color:tab===id?'white':'rgba(255,255,255,.45)',
            transition:'all .2s',
            display:'flex',flexDirection:'column',alignItems:'center',gap:1,
          }}>
            <span style={{fontSize:26}}>{icon}</span>
            <span style={{fontSize:11,fontWeight:'bold',letterSpacing:.2}}>{label}</span>
          </button>
        ))}
      </div>

      <div style={{width:'90%',maxWidth:420,display:'flex',flexDirection:'column',gap:10}}>

        {/* ─── ONGLET JOUER ─── */}
        {tab==='play'&&<>
          {!cfg.difficulty&&<>
            <div style={{fontSize:11,opacity:.5,letterSpacing:1,marginBottom:8,textAlign:'center'}}>
              DIFFICULTÉ
            </div>
            {DIFFICULTIES.map(d=>(
              <button key={d.id} onClick={()=>setCfg(c=>({...c,difficulty:d.id}))} style={{
                background:'rgba(0,0,0,.25)',
                border:'2px solid rgba(255,255,255,.08)',
                borderRadius:14,padding:'13px 16px',cursor:'pointer',
                display:'flex',alignItems:'center',gap:14,textAlign:'left',transition:'all .15s',
              }}>
                <div style={{width:16,height:16,borderRadius:'50%',background:d.dot,flexShrink:0}}/>
                <div style={{fontSize:15,fontWeight:'bold',color:'white'}}>{d.label}</div>
              </button>
            ))}
          </>}

          {cfg.difficulty&&<>
            <div style={{display:'flex',alignItems:'center',marginBottom:8}}>
              <button onClick={()=>setCfg(c=>({...c,difficulty:null,partnerStyle:null}))} style={{
                background:'none',border:'none',color:'rgba(255,255,255,.5)',
                fontSize:13,cursor:'pointer',padding:0,
              }}>← Niveau</button>
              <div style={{margin:'0 auto',fontSize:13,fontWeight:'bold',color:'rgba(255,255,255,.8)'}}>
                {DIFFICULTIES.find(d=>d.id===cfg.difficulty)?.label}
              </div>
              <div style={{width:60}}/>
            </div>
            <div style={{fontSize:11,opacity:.5,letterSpacing:1,marginBottom:8,textAlign:'center'}}>
              CHOIX DU PARTENAIRE
            </div>
            {[
              {id:'prudent',   emoji:'🛡️', label:'Denis'},
              {id:'actif',     emoji:'⚡', label:'David'},
              {id:'temeraire', emoji:'🔥', label:'Juan'},
            ].map(s=>(
              <button key={s.id} onClick={()=>setCfg(c=>({...c,partnerStyle:s.id}))} style={{
                background:cfg.partnerStyle===s.id?'rgba(255,255,255,.18)':'rgba(0,0,0,.25)',
                border:cfg.partnerStyle===s.id?'2px solid rgba(255,255,255,.4)':'2px solid rgba(255,255,255,.08)',
                borderRadius:14,padding:'13px 16px',cursor:'pointer',
                display:'flex',alignItems:'center',gap:12,textAlign:'left',transition:'all .15s',
              }}>
                <span style={{fontSize:22}}>{s.emoji}</span>
                <div style={{fontSize:15,fontWeight:'bold',color:'white'}}>{s.label}</div>
                {cfg.partnerStyle===s.id&&<div style={{marginLeft:'auto',color:'#4caf50',fontSize:16}}>✓</div>}
              </button>
            ))}
            {cfg.partnerStyle&&(
              <button onClick={onPlay} style={{
                marginTop:8,background:'linear-gradient(135deg,#27ae60,#1e8449)',
                border:'none',borderRadius:16,padding:'15px',
                fontSize:16,fontWeight:900,color:'white',cursor:'pointer',
                letterSpacing:1,boxShadow:'0 4px 16px rgba(39,174,96,.4)',
              }}>
                🃏 JOUER
              </button>
            )}
          </>}
          {/* Bouton Reprendre si partie sauvegardée — visible sur les deux étapes */}
          {(()=>{
            try{
              const saved=localStorage.getItem('belota_game');
              if(saved){const g=JSON.parse(saved);if(g&&g.phase&&g.phase!=='MATCH_OVER'&&g.phase!=='OVER'&&g.phase!=='MANCHE_OVER')return(
                <button onClick={onPlay} style={{
                  marginTop:6,
                  background:'linear-gradient(135deg,#1565c0,#0d47a1)',
                  border:'2px solid rgba(255,255,255,.25)',
                  borderRadius:14,padding:'13px 16px',cursor:'pointer',
                  display:'flex',alignItems:'center',gap:14,textAlign:'left',
                  width:'100%',
                }}>
                  <span style={{fontSize:24}}>▶️</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:'bold',color:'white'}}>Reprendre la partie</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>
                      Pli {(g.done||[]).length+1}/8 · {g.scores?`${g.scores[0]} — ${g.scores[1]}`:''}
                    </div>
                  </div>
                </button>
              );}
            }catch(e){}
            return null;
          })()}
        </>}

        {/* ─── ONGLET OPTIONS ─── */}
        {tab==='options'&&<>
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

          <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:16,
            display:'flex',flexDirection:'column',gap:12}}>
            <div style={{fontSize:12,opacity:.6,letterSpacing:1}}>RÈGLES</div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{flex:1,marginRight:12}}>
                <div style={{fontSize:14,fontWeight:'bold'}}>Combinaisons</div>
                <div style={{fontSize:11,opacity:.5,lineHeight:1.5}}>
                  Tierce +20 · Cinquante +50 · Cent +100 · Carré V +200 · Carré 9 +150 · Carré As/10/R/D +100
                </div>
              </div>
              <Toggle val={cfg.combinaisons} onToggle={()=>setCfg(c=>({...c,combinaisons:!c.combinaisons}))}/>
            </div>

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

            {/* Ordre Belote */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{flex:1,marginRight:12}}>
                <div style={{fontSize:14,fontWeight:'bold'}}>Règle Belge 🇧🇪</div>
                <div style={{fontSize:11,opacity:.5,lineHeight:1.5}}>
                  Roi obligatoire en premier · Par défaut : D ou R (française)
                </div>
              </div>
              <Toggle val={(cfg.beloteOrder||'francaise')==='belge'} onToggle={()=>setCfg(c=>({...c,beloteOrder:(c.beloteOrder||'francaise')==='belge'?'francaise':'belge'}))}/>
            </div>
          </div>
        </>}

        {/* ─── ONGLET STATS ─── */}
        {tab==='stats'&&(()=>{
          let st={total:{m:0,mg:0,pp:0,pg:0},prudent:{m:0,mg:0,pp:0,pg:0},actif:{m:0,mg:0,pp:0,pg:0},temeraire:{m:0,mg:0,pp:0,pg:0}};
          try{const s=localStorage.getItem('belota_stats');if(s)st={...st,...JSON.parse(s)};}catch(e){}
          const pct=(a,b)=>b>0?Math.round(a/b*100):0;
          const StatRow=({label,val,sub})=>(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
              <div style={{fontSize:13,color:'rgba(255,255,255,.7)'}}>{label}</div>
              <div style={{textAlign:'right'}}>
                <span style={{fontSize:15,fontWeight:'bold',color:'white'}}>{val}</span>
                {sub&&<span style={{fontSize:11,color:'rgba(255,255,255,.4)',marginLeft:6}}>{sub}</span>}
              </div>
            </div>
          );
          const partners=[
            {id:'prudent',  emoji:'🛡️', name:'Denis'},
            {id:'actif',    emoji:'⚡', name:'David'},
            {id:'temeraire',emoji:'🔥', name:'Juan'},
          ];
          return(<>
            {/* Global */}
            <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:16}}>
              <div style={{fontSize:12,opacity:.5,letterSpacing:1,marginBottom:10}}>GLOBAL</div>
              <StatRow label="Manches jouées" val={st.total.m} sub={`${st.total.mg} gagnées · ${pct(st.total.mg,st.total.m)}%`}/>
              <StatRow label="Parties jouées" val={st.total.pp} sub={`${st.total.pg} gagnées · ${pct(st.total.pg,st.total.pp)}%`}/>
            </div>
            {/* Par partenaire */}
            <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:16}}>
              <div style={{fontSize:12,opacity:.5,letterSpacing:1,marginBottom:10}}>PAR PARTENAIRE</div>
              {partners.map(p=>{
                const s=st[p.id]||{m:0,mg:0,pp:0,pg:0};
                return(
                  <div key={p.id} style={{marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:16}}>{p.emoji}</span>
                      <span style={{fontSize:13,fontWeight:'bold',color:'white'}}>{p.name}</span>
                    </div>
                    <StatRow label="Manches" val={s.m} sub={`${s.mg} gagnées · ${pct(s.mg,s.m)}%`}/>
                    <StatRow label="Parties"  val={s.pp} sub={`${s.pg} gagnées · ${pct(s.pg,s.pp)}%`}/>
                  </div>
                );
              })}
            </div>
            {/* Reset */}
            <button onClick={()=>{
              if(window.confirm('Effacer toutes les statistiques ?')){
                localStorage.removeItem('belota_stats');
                setTab('play');setTimeout(()=>setTab('stats'),50);
              }
            }} style={{
              background:'none',border:'1px solid rgba(255,100,100,.3)',
              borderRadius:10,padding:'8px 16px',fontSize:11,
              color:'rgba(255,100,100,.6)',cursor:'pointer',alignSelf:'center',
            }}>🗑 Réinitialiser les stats</button>
          </>);
        })()}

        {/* ─── ONGLET AVIS ─── */}
        {tab==='avis'&&<>
          {avis.sent?(
            <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:30,textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:12}}>🙏</div>
              <div style={{fontSize:16,fontWeight:'bold',color:'white',marginBottom:8}}>Merci pour votre avis !</div>
              <div style={{fontSize:12,opacity:.6,marginBottom:20}}>Votre retour a bien été envoyé.</div>
              <button onClick={()=>{setAvis({stars:0,fluide:'',ia:'',bugs:'',aime:'',change:'',multi:'',sent:false});setTab('play');}}
                style={{background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',
                  borderRadius:20,padding:'8px 24px',fontSize:13,color:'white',cursor:'pointer'}}>
                ← Retour
              </button>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,opacity:.5,marginBottom:8}}>NOTE GLOBALE</div>
                <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                  {[1,2,3,4,5].map(n=>(
                    <span key={n} onClick={()=>setAvis(a=>({...a,stars:n}))}
                      style={{fontSize:28,cursor:'pointer',opacity:n<=avis.stars?1:.3,transition:'opacity .15s'}}>
                      ⭐
                    </span>
                  ))}
                </div>
              </div>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,opacity:.5,marginBottom:8}}>LE JEU EST FLUIDE SUR MON APPAREIL</div>
                <div style={{display:'flex',gap:8}}>
                  {['Oui','Non','Parfois'].map(v=>(
                    <button key={v} onClick={()=>setAvis(a=>({...a,fluide:v}))} style={{
                      flex:1,padding:'8px 4px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:'bold',
                      background:avis.fluide===v?'#27ae60':'rgba(255,255,255,.1)',
                      color:avis.fluide===v?'white':'rgba(255,255,255,.6)',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,opacity:.5,marginBottom:8}}>L IA EST...</div>
                <div style={{display:'flex',gap:6}}>
                  {['Trop facile','Équilibrée','Trop forte'].map(v=>(
                    <button key={v} onClick={()=>setAvis(a=>({...a,ia:v}))} style={{
                      flex:1,padding:'8px 4px',borderRadius:10,border:'none',cursor:'pointer',fontSize:11,fontWeight:'bold',
                      background:avis.ia===v?'#2980b9':'rgba(255,255,255,.1)',
                      color:avis.ia===v?'white':'rgba(255,255,255,.6)',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,opacity:.5,marginBottom:6}}>BUGS RENCONTRÉS</div>
                <textarea value={avis.bugs} onChange={e=>setAvis(a=>({...a,bugs:e.target.value}))}
                  placeholder="Décrivez un bug si vous en avez rencontré..."
                  style={{width:'100%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',
                    borderRadius:8,padding:'8px 10px',color:'white',fontSize:12,resize:'none',height:60,
                    fontFamily:'inherit',boxSizing:'border-box'}}/>
              </div>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,opacity:.5,marginBottom:6}}>CE QUE VOUS AIMEZ LE PLUS</div>
                <textarea value={avis.aime} onChange={e=>setAvis(a=>({...a,aime:e.target.value}))}
                  placeholder="Ce qui vous plaît dans le jeu..."
                  style={{width:'100%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',
                    borderRadius:8,padding:'8px 10px',color:'white',fontSize:12,resize:'none',height:60,
                    fontFamily:'inherit',boxSizing:'border-box'}}/>
              </div>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,opacity:.5,marginBottom:6}}>CE QUE VOUS CHANGERIEZ</div>
                <textarea value={avis.change} onChange={e=>setAvis(a=>({...a,change:e.target.value}))}
                  placeholder="Vos suggestions..."
                  style={{width:'100%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',
                    borderRadius:8,padding:'8px 10px',color:'white',fontSize:12,resize:'none',height:60,
                    fontFamily:'inherit',boxSizing:'border-box'}}/>
              </div>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:14,padding:14}}>
                <div style={{fontSize:11,opacity:.5,marginBottom:8}}>JOUERIEZ-VOUS EN MULTIJOUEUR ?</div>
                <div style={{display:'flex',gap:8}}>
                  {['Oui','Non','Peut-être'].map(v=>(
                    <button key={v} onClick={()=>setAvis(a=>({...a,multi:v}))} style={{
                      flex:1,padding:'8px 4px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:'bold',
                      background:avis.multi===v?'#8e44ad':'rgba(255,255,255,.1)',
                      color:avis.multi===v?'white':'rgba(255,255,255,.6)',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <button onClick={()=>{
                const body=`AVIS BELOTA%0A%0ANote: ${'⭐'.repeat(avis.stars)}%0AFluide: ${avis.fluide}%0AIA: ${avis.ia}%0AMultijoueur: ${avis.multi}%0A%0ABugs: ${avis.bugs||'(aucun)'}%0A%0ACe que j aime: ${avis.aime||'(vide)'}%0A%0ACe que je changerais: ${avis.change||'(vide)'}`;
                window.open('mailto:emmanuel.luque.bailen@gmail.com?subject=Avis BELOTA&body='+body);
                setAvis(a=>({...a,sent:true}));
              }} style={{
                background:'linear-gradient(135deg,#27ae60,#1e8449)',
                border:'none',borderRadius:16,padding:'14px',
                fontSize:15,fontWeight:900,color:'white',cursor:'pointer',
                boxShadow:'0 4px 16px rgba(39,174,96,.4)',
              }}>
                📧 Envoyer mon avis
              </button>
            </div>
          )}
        </>}

        {/* ─── ONGLET INFO ─── */}
        {tab==='info'&&<>
          <div style={{
            background:'rgba(0,0,0,.25)',borderRadius:16,padding:30,
            textAlign:'center',display:'flex',flexDirection:'column',
            alignItems:'center',gap:14,
          }}>
            <img src="/belota-icon.png" alt="BELOTA"
              style={{width:90,height:90,borderRadius:20,boxShadow:'0 4px 16px rgba(0,0,0,.5)'}}
              onError={e=>{e.target.style.display='none';}}/>
            <div style={{fontSize:26,fontWeight:900,letterSpacing:3,color:'white'}}>BELOTA</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.5)',letterSpacing:2}}>JEU DE BELOTE FRANÇAIS</div>
            <div style={{width:'80%',height:1,background:'rgba(255,255,255,.1)'}}/>
            <div style={{width:'100%',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{background:'rgba(255,255,255,.07)',borderRadius:10,padding:'10px 16px',textAlign:'left'}}>
                <div style={{fontSize:10,opacity:.5,marginBottom:2}}>PROPRIÉTÉ</div>
                <div style={{fontSize:14,fontWeight:'bold',color:'white'}}>aluQ ENTERTAINMENT</div>
              </div>
              <div style={{background:'rgba(255,255,255,.07)',borderRadius:10,padding:'10px 16px',textAlign:'left'}}>
                <div style={{fontSize:10,opacity:.5,marginBottom:2}}>DÉVELOPPÉ PAR</div>
                <div style={{fontSize:14,fontWeight:'bold',color:'white'}}>Emmanuel Luque Bailen</div>
              </div>
              <div style={{background:'rgba(255,255,255,.07)',borderRadius:10,padding:'10px 16px',
                fontSize:11,color:'rgba(255,255,255,.4)',textAlign:'center'}}>
                © 2026 aluQ ENTERTAINMENT - Tous droits réservés
              </div>
            </div>
            <button onClick={()=>setTab('play')} style={{
              background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',
              borderRadius:20,padding:'8px 24px',fontSize:13,color:'white',cursor:'pointer',
            }}>← Retour</button>
          </div>
        </>}

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
    difficulty:null,
    tableColor:'#00838f',
    combinaisons:false,
    valetForce:false,
    beloteOrder:'francaise',
    partnerStyle:'actif',
  });
  const[names,setNames]=useState(()=>genNames());
  const[updateReady,setUpdateReady]=useState(false);

  useEffect(()=>{
    async function checkUpdate(){
      try{
        const r=await fetch('/',{cache:'no-store'});
        const html=await r.text();
        const m=html.match(/src="[^"]*\/index-([^"]+)\.js"/);
        if(!m)return;
        const newHash=m[1];
        const savedHash=localStorage.getItem('belota_build_hash');
        if(savedHash&&savedHash!==newHash){setUpdateReady(true);}
        localStorage.setItem('belota_build_hash',newHash);
      }catch(e){}
    }
    checkUpdate();
    const iv=setInterval(checkUpdate,120000);
    return()=>clearInterval(iv);
  },[]);

  function applyUpdate(){window.location.reload();}
  function startGame(){setNames(genNames());setScreen('GAME');}

  return(
    <>
      {screen==='SPLASH'&&<SplashScreen onDone={()=>setScreen('MENU')}/>}
      {screen==='MENU'&&<MenuScreen cfg={cfg} setCfg={setCfg} onPlay={startGame}/>}
      {screen==='GAME'&&<App cfg={cfg} names={names} onMenu={()=>setScreen('MENU')}/>}
      {updateReady&&(
        <div style={{
          position:'fixed',bottom:0,left:0,right:0,zIndex:9999,
          background:'linear-gradient(135deg,#1a5c24,#0d3b14)',
          borderTop:'2px solid #27ae60',
          padding:'12px 20px',
          display:'flex',alignItems:'center',justifyContent:'space-between',
          boxShadow:'0 -4px 20px rgba(0,0,0,.5)',
          fontFamily:'Georgia,serif',
        }}>
          <div>
            <div style={{fontSize:13,fontWeight:'bold',color:'white'}}>🆕 Mise à jour disponible</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.6)'}}>Une nouvelle version de BELOTA est prête</div>
          </div>
          <button onClick={applyUpdate} style={{
            background:'#27ae60',border:'none',borderRadius:20,
            padding:'8px 18px',fontSize:13,fontWeight:'bold',
            color:'white',cursor:'pointer',
            boxShadow:'0 2px 8px rgba(39,174,96,.5)',
            whiteSpace:'nowrap',
          }}>
            Mettre à jour
          </button>
        </div>
      )}
    </>
  );
}

export default function Belota(){
  return <EB><BelotaRoot/></EB>;
}
