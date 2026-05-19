// BELOTA — Table plein écran style belote authentique

import { useState, useEffect, useRef, Component } from "react";
class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(e){ return{error:e}; }
  render(){
    if(this.state.error){
      return(
        <div style={{background:'#1a1a2e',color:'white',padding:24,fontFamily:'monospace',
          minHeight:'100dvh',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{fontSize:18,fontWeight:'bold',color:'#e74c3c'}}>💥 Erreur détectée</div>
          <div style={{fontSize:13,color:'#f1c40f'}}>{this.state.error.message}</div>
          <pre style={{fontSize:10,opacity:.7,whiteSpace:'pre-wrap'}}>
            {this.state.error.stack?.slice(0,600)}
          </pre>
          <button onClick={()=>this.setState({error:null})}
            style={{background:'#27ae60',color:'white',border:'none',borderRadius:8,
              padding:'10px 20px',fontSize:14,cursor:'pointer',width:200}}>
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}



const SUITS      = ['♠','♥','♦','♣'];
const RED_S      = s => s==='♥'||s==='♦';
const SUIT_FR    = {'♠':'Pique','♥':'Cœur','♦':'Carreau','♣':'Trèfle'};
const RANKS      = ['7','8','9','10','J','Q','K','A'];
const DISP       = {'7':'7','8':'8','9':'9','10':'10','J':'V','Q':'D','K':'R','A':'A'};
const PNAME      = ['Vous','Ouest','Nord','Est'];
const SUIT_ORDER = ['♠','♥','♣','♦'];

const TRUMP_STR = {J:8,'9':7,A:6,'10':5,K:4,Q:3,'8':2,'7':1};
const PLAIN_STR = {A:8,'10':7,K:6,Q:5,J:4,'9':3,'8':2,'7':1};
const TS = {J:7,'9':6,A:5,'10':4,K:3,Q:2,'8':1,'7':0};
const NS = {A:7,'10':6,K:5,Q:4,J:3,'9':2,'8':1,'7':0};
const TP = {J:20,'9':14,A:11,'10':10,K:4,Q:3,'8':0,'7':0};
const NP = {A:11,'10':10,K:4,Q:3,J:2,'9':0,'8':0,'7':0};

const teamOf  = p => (p===0||p===2)?0:1;
const cardStr = (c,t) => c.s===t?TS[c.r]:NS[c.r];
const cardPts = (c,t) => c.s===t?TP[c.r]:NP[c.r];
const nextP   = p => (p+1)%4;

const AI_DELAY=1500, TRICK_PAUSE=2500, BID_DELAY=900;

// Taille cartes du pli
const PC_W=58, PC_H=82;

// ─── TRI ─────────────────────────────────────────────────────────────────────
function sortHand(hand, trump) {
  const safe = (hand||[]).filter(c=>c&&c.s&&c.r);
  if (!safe.length) return [];
  const suitOrder = trump ? [trump,...SUIT_ORDER.filter(s=>s!==trump)] : [...SUIT_ORDER];
  const str = c => (c.s===trump ? TRUMP_STR : PLAIN_STR)[c.r];
  return [...safe].sort((a,b) => {
    const si = suitOrder.indexOf(a.s) - suitOrder.indexOf(b.s);
    return si !== 0 ? si : str(b) - str(a);
  });
}

// ─── DECK ────────────────────────────────────────────────────────────────────
function mkDeck(){return SUITS.flatMap(s=>RANKS.map(r=>({s,r,id:`${r}${s}`})));}
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=0|Math.random()*(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;}
function dealInitial(fp){
  const d=shuffle(mkDeck());const h=[[],[],[],[]];let i=0;
  for(let k=0;k<4;k++){const p=(fp+k)%4;h[p].push(d[i++],d[i++],d[i++]);}
  for(let k=0;k<4;k++){const p=(fp+k)%4;h[p].push(d[i++],d[i++]);}
  const flip=d[i++];return{hands:h,flipCard:flip,rest:d.slice(i)};
}
function completeHands(hands,flip,rest,taker){
  const nh=hands.map(h=>h.filter(c=>c&&c.id));
  nh[taker]=[...nh[taker],flip];
  let ri=0,p=taker;
  for(let k=0;k<4;k++){
    const n=p===taker?2:3;
    for(let j=0;j<n;j++){const c=rest[ri++];if(c)nh[p].push(c);}
    p=nextP(p);
  }
  return nh.map(h=>h.filter(c=>c&&c.id));
}

// ─── RÈGLES ──────────────────────────────────────────────────────────────────
function trickWinner(trick,trump){
  if(!trick||!trick.length||!trick[0]||!trick[0].c)return 0;
  const lead=trick[0].c.s;let best=trick[0];
  for(const t of trick.slice(1)){
    const b=best.c,c=t.c;
    if(c.s===trump&&b.s!==trump){best=t;continue;}
    if(c.s===trump&&b.s===trump&&TS[c.r]>TS[b.r]){best=t;continue;}
    if(c.s===lead&&b.s!==trump&&NS[c.r]>NS[b.r])best=t;
  }
  return best.p;
}
function legalMoves(hand,trick,trump,player){
  const h=hand.filter(c=>c&&c.id);
  const safeTrick=trick.filter(t=>t&&t.c&&t.c.s);
  if(!safeTrick.length)return h;
  const lead=safeTrick[0].c.s;
  const tc=h.filter(c=>c.s===trump),lc=h.filter(c=>c.s===lead);
  if(lead===trump){
    if(!tc.length)return h;
    const bt=safeTrick.filter(t=>t.c.s===trump).reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);
    const hi=tc.filter(c=>TS[c.r]>TS[bt.c.r]);return hi.length?hi:tc;
  }
  if(lc.length)return lc;if(!tc.length)return h;
  const win=trickWinner(safeTrick,trump);
  if(win===(player+2)%4)return h;
  const pt=safeTrick.filter(t=>t.c.s===trump);
  if(pt.length){const bt=pt.reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);const hi=tc.filter(c=>TS[c.r]>TS[bt.c.r]);if(hi.length)return hi;}
  return tc;
}

// ─── IA ──────────────────────────────────────────────────────────────────────
function aiShouldTake(hand,suit,r){
  const tc=hand.filter(c=>c.s===suit);
  return r===1?(tc.some(c=>c.r==='J')||(tc.length>=3&&tc.some(c=>c.r==='9'))||tc.length>=4):(tc.some(c=>c.r==='J')||tc.length>=3);
}
function aiPickSuit(hand,ex){
  let best=null,bv=-1;
  for(const s of SUITS){if(s===ex)continue;const v=hand.filter(c=>c.s===s).reduce((a,c)=>a+TS[c.r],0)+hand.filter(c=>c.s===s).length*2;if(v>bv){bv=v;best=s;}}
  return best;
}
function aiPickCard(hand,trick,trump,player){
  const moves=legalMoves(hand,trick,trump,player);
  if(!moves.length){
    const fallback=hand.filter(c=>c&&c.id);
    return fallback.length?fallback[0]:null;
  }
  const partner=(player+2)%4;
  if(!trick.length){
    const jT=moves.find(c=>c.s===trump&&c.r==='J');if(jT)return jT;
    const nt=moves.filter(c=>c.s!==trump);
    if(nt.length)return nt.reduce((b,c)=>cardStr(c,trump)>cardStr(b,trump)?c:b);
    return moves.reduce((b,c)=>cardStr(c,trump)<cardStr(b,trump)?c:b);
  }
  const win=trickWinner(trick,trump);
  return win===partner?moves.reduce((b,c)=>cardStr(c,trump)<cardStr(b,trump)?c:b):moves.reduce((b,c)=>cardStr(c,trump)>cardStr(b,trump)?c:b);
}

// ─── ÉTAT ────────────────────────────────────────────────────────────────────
function initRound(scores,dealer){
  const sc=scores||[0,0],dl=dealer!==undefined?dealer:3,fp=nextP(dl);
  const{hands,flipCard,rest}=dealInitial(fp);
  return{phase:'BIDDING',hands,flipCard,rest,dealer:dl,firstPlayer:fp,
    trump:null,bidRound:1,bidIdx:fp,bidCount:0,taker:null,takerTeam:null,
    trick:[],done:[],curPlayer:fp,scores:sc,announce:'',
    belB:[0,0],belH:null,belP:[0,0,0,0],roundResult:null,ltWin:null,pendingWin:null,
  };
}

function applyPlayCard(G,player,card){
  const newHands=G.hands.map((h,i)=>i===player?h.filter(c=>c&&c.id&&c.id!==card.id):h.filter(c=>c&&c.id));
  const newTrick=[...G.trick,{p:player,c:card}];
  let ann='',bb=[...G.belB],bp=[...G.belP];
  if(G.belH&&G.belH[player]&&card.s===G.trump&&(card.r==='K'||card.r==='Q')){
    bp=[...bp];bp[player]++;
    if(bp[player]===1)ann='Belote !';
    if(bp[player]===2){ann='Rebelote !';bb=[...bb];bb[teamOf(player)]+=20;}
  }
  if(newTrick.length<4){
    return{...G,hands:newHands,trick:newTrick,curPlayer:nextP(player),announce:ann,belB:bb,belP:bp};
  }
  // Pli complet — trick GARDE les 4 cartes jusqu'à la fin de la pause
  // Elles restent visibles pendant TRICK_PAUSE ms
  const win=trickWinner(newTrick,G.trump);
  return{...G,hands:newHands,trick:newTrick,phase:'TRICK_DONE',pendingWin:win,announce:ann,belB:bb,belP:bp};
}

function resolveTrick(G){
  const win=G.pendingWin;
  const nd=[...G.done,{winner:win,cards:G.trick.map(t=>t.c)}];
  const base={...G,trick:[],done:nd,phase:'PLAYING',pendingWin:null,ltWin:win,announce:''};
  return nd.length===8?calcResult(base):{...base,curPlayer:win};
}

function calcResult(G){
  const t0=G.done.filter(d=>teamOf(d.winner)===0).length;
  let pts=[0,0];
  if(t0===8)pts=[250,0];else if(t0===0)pts=[0,250];
  else for(let i=0;i<8;i++){const d=G.done[i],tm=teamOf(d.winner);pts[tm]+=d.cards.reduce((s,c)=>s+cardPts(c,G.trump),0);if(i===7)pts[tm]+=10;}
  const tt=G.takerTeam,ot=1-tt;
  let rp=[0,0],res;
  if(pts[tt]>pts[ot]){res='success';rp=[...pts];}
  else if(pts[tt]===pts[ot]){res='litige';rp=tt===0?[0,162]:[162,0];}
  else{res='chute';rp=tt===0?[0,162]:[162,0];}
  rp=[rp[0]+G.belB[0],rp[1]+G.belB[1]];
  const ns=[G.scores[0]+rp[0],G.scores[1]+rp[1]];
  const go=ns[0]>=1000||ns[1]>=1000;
  const tn=G.taker===0?'Vous avez':G.taker===2?'Nord a':G.taker===1?'Ouest a':'Est a';
  const ttn=tt===0?'Vous+Nord':'Ouest+Est',dtn=tt===0?'Ouest+Est':'Vous+Nord';
  let msg,detail;
  if(res==='success'){msg=`✅ ${tn} pris — ${ttn} réussit !`;detail=`${ttn} ${pts[tt]} pts | ${dtn} ${pts[ot]} pts`;}
  else if(res==='litige'){msg=`🟡 Litige — ${dtn} prend 162`;detail=`${pts[0]}-${pts[1]}, chute du preneur`;}
  else{msg=`❌ ${tn} pris — CHUTE ! ${dtn} prend 162`;detail=`${ttn} ${pts[tt]} pts | ${dtn} ${pts[ot]} pts`;}
  return{...G,phase:go?'GAME_OVER':'ROUND_END',scores:ns,roundResult:{pts,rp,res,msg,detail},announce:''};
}

// ─── EMPLACEMENT VIDE (slot pli) ─────────────────────────────────────────────
function Slot({W,H}){
  return <div style={{width:W,height:H,borderRadius:6,
    border:'1px dashed rgba(255,255,255,.15)',
    background:'rgba(0,0,0,.1)'}}/>;
}

// ─── STYLE BOUTON ────────────────────────────────────────────────────────────
function BS(bg){
  return{background:bg,color:'white',border:'none',borderRadius:22,
    padding:'8px 18px',fontSize:13,cursor:'pointer',fontWeight:'bold',
    boxShadow:'0 3px 8px rgba(0,0,0,.4)'};
}

// ─── CARTE ───────────────────────────────────────────────────────────────────
function CardView({card,faceDown,isLegal,W,H,onClick}){
  const w=W||54,h=H||76;
  if(faceDown||!card||!card.s){
    return <div style={{width:w,height:h,borderRadius:6,flexShrink:0,
      background:'#1a3580',border:'2px solid #2244aa',
      backgroundImage:'repeating-linear-gradient(45deg,#1a3580,#1a3580 4px,#243fa0 4px,#243fa0 8px)',
      boxShadow:'0 3px 8px rgba(0,0,0,.5)'}}/>;
  }
  const tc=RED_S(card.s)?'#c0392b':'#1a1a2e';
  const fs=w<44?7:w<54?9:10, ms=w<44?13:w<54?16:20;
  return(
    <div onClick={isLegal?onClick:undefined} style={{
      width:w,height:h,borderRadius:6,flexShrink:0,
      position:'relative',overflow:'hidden',background:'white',
      border:`2px solid ${isLegal?'#2ecc71':'rgba(0,0,0,.15)'}`,
      boxShadow:isLegal?'0 0 14px rgba(46,204,113,.9),0 4px 12px rgba(0,0,0,.4)':'0 4px 14px rgba(0,0,0,.55)',
      cursor:isLegal?'pointer':'default'}}>
      <div style={{position:'absolute',top:2,left:3,fontSize:fs,fontWeight:700,color:tc,lineHeight:1.1}}>
        {DISP[card.r]}<br/>{card.s}
      </div>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',
        justifyContent:'center',fontSize:ms,color:tc}}>{card.s}</div>
      <div style={{position:'absolute',bottom:2,right:3,fontSize:fs,fontWeight:700,
        color:tc,lineHeight:1.1,transform:'rotate(180deg)'}}>
        {DISP[card.r]}<br/>{card.s}
      </div>
    </div>
  );
}

// ─── ÉVENTAIL ────────────────────────────────────────────────────────────────
function FanCard({card,angle,isLegal,zIdx,cw,ch,pv,onClick}){
  const[hov,setHov]=useState(false);
  // Cartes légales soulevées de base de 16px, 28px au hover
  const lift=isLegal?(hov?-28:-16):0;
  return(
    <div onClick={isLegal?onClick:undefined}
      onMouseEnter={()=>isLegal&&setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{position:'absolute',bottom:0,left:`calc(50% - ${cw/2}px)`,
        width:cw,height:ch,transformOrigin:`50% ${ch+pv}px`,
        transform:`rotate(${angle}deg) translateY(${lift}px)`,
        zIndex:isLegal?zIdx+20:zIdx,transition:'transform .12s',
        cursor:isLegal?'pointer':'default'}}>
      <CardView card={card} isLegal={isLegal} W={cw} H={ch} onClick={onClick}/>
    </div>
  );
}
function FanHand({hand,legalIDs,onPlay,trump,cw=62,ch=88,pv=340}){
  const ids=legalIDs||new Set();
  const sorted=sortHand(hand,trump);
  const n=sorted.length;if(!n)return<div style={{height:ch}}/>;
  const spread=n<=1?0:Math.min(n*5,36);
  const step=n>1?spread/(n-1):0,start=-spread/2;
  const fh=Math.min(ch+160, ch+Math.round((1-Math.cos(spread/2*Math.PI/180))*(pv+ch))+10);
  return(
    <div style={{position:'relative',height:Math.max(fh,ch+10),width:'100%'}}>
      {sorted.map((card,i)=>(
        <FanCard key={card.id} card={card} angle={start+i*step}
          isLegal={ids.has(card.id)} zIdx={i+1}
          cw={cw} ch={ch} pv={pv}
          onClick={()=>ids.has(card.id)&&onPlay(card)}/>
      ))}
    </div>
  );
}

// ─── CHIP JOUEUR ─────────────────────────────────────────────────────────────
function PlayerChip({name,cards,active,dealer,team}){
  return(
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:11,fontWeight:'bold',
        color:active?'#f1c40f':'rgba(255,255,255,.8)',
        textShadow:'0 1px 4px rgba(0,0,0,.9)',marginBottom:3}}>
        {active?'▼ ':''}{name}{dealer?' 🔴':''}
      </div>
      <div style={{background:'rgba(0,0,0,.5)',borderRadius:20,padding:'3px 10px',
        fontSize:11,display:'inline-block',
        border:`1px solid ${team===0?'rgba(46,204,113,.4)':'rgba(231,76,60,.4)'}`}}>
        {cards}🂠
      </div>
    </div>
  );
}

// ─── PRINCIPAL ───────────────────────────────────────────────────────────────
function BelotaGame(){
  const[G,setG]=useState(()=>initRound());
  const tRef=useRef(null);
  const[isLs,setIsLs]=useState(()=>typeof window!=='undefined'&&window.innerWidth>window.innerHeight);
  useEffect(()=>{
    const u=()=>setIsLs(window.innerWidth>window.innerHeight);
    window.addEventListener('resize',u);return()=>window.removeEventListener('resize',u);
  },[]);

  // Résoudre pli après TRICK_PAUSE
  useEffect(()=>{
    if(G.phase!=='TRICK_DONE')return;
    if(tRef.current)clearTimeout(tRef.current);
    tRef.current=setTimeout(()=>setG(p=>p.phase==='TRICK_DONE'?resolveTrick(p):p),TRICK_PAUSE);
    return()=>{if(tRef.current)clearTimeout(tRef.current);};
  },[G.phase,G.pendingWin]);

  // IA enchères
  useEffect(()=>{
    if(G.phase!=='BIDDING'||G.bidIdx===0)return;
    const t=setTimeout(()=>{
      setG(prev=>{
        if(prev.phase!=='BIDDING'||prev.bidIdx===0)return prev;
        const p=prev.bidIdx,hand=prev.hands[p].filter(c=>c&&c.id);
        const take=suit=>({...prev,phase:'PLAYING',trump:suit,taker:p,takerTeam:teamOf(p),
          curPlayer:prev.firstPlayer,
          hands:completeHands(prev.hands,prev.flipCard,prev.rest,p),
          belH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))});
        if(prev.bidRound===1){if(aiShouldTake(hand,prev.flipCard.s,1))return take(prev.flipCard.s);}
        else{const s=aiPickSuit(hand,prev.flipCard.s);if(s&&aiShouldTake(hand,s,2))return take(s);}
        const nc=prev.bidCount+1;
        if(nc>=4){
          if(prev.bidRound===1)return{...prev,bidRound:2,bidIdx:prev.firstPlayer,bidCount:0};
          const nd=dealInitial(prev.firstPlayer);
          return{...prev,...nd,bidRound:1,bidIdx:prev.firstPlayer,bidCount:0,trump:null};
        }
        return{...prev,bidIdx:nextP(prev.bidIdx),bidCount:nc};
      });
    },BID_DELAY);
    return()=>clearTimeout(t);
  },[G.phase,G.bidIdx,G.bidRound]);

  // IA jeu — uniquement en phase PLAYING
  useEffect(()=>{
    if(G.phase!=='PLAYING'||G.curPlayer===0)return;
    const t=setTimeout(()=>{
      setG(prev=>{
        if(prev.phase!=='PLAYING'||prev.curPlayer===0)return prev;
        const p=prev.curPlayer,hand=prev.hands[p].filter(c=>c&&c.id);
        const card=aiPickCard(hand,prev.trick,prev.trump,p);
        if(!card)return prev; // sécurité: main vide inattendue
        return applyPlayCard(prev,p,card);
      });
    },AI_DELAY);
    return()=>clearTimeout(t);
  },[G.phase,G.curPlayer,G.trick.length]);

  function humanBid(suit){
    if(suit!==null){
      setG(prev=>({...prev,phase:'PLAYING',trump:suit,taker:0,takerTeam:0,
        curPlayer:prev.firstPlayer,
        hands:completeHands(prev.hands,prev.flipCard,prev.rest,0),
        belH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))}));
      return;
    }
    setG(prev=>{
      const nc=prev.bidCount+1;
      if(nc>=4){
        if(prev.bidRound===1)return{...prev,bidRound:2,bidIdx:prev.firstPlayer,bidCount:0};
        const nd=dealInitial(prev.firstPlayer);
        return{...prev,...nd,bidRound:1,bidIdx:prev.firstPlayer,bidCount:0,trump:null};
      }
      return{...prev,bidIdx:nextP(prev.bidIdx),bidCount:nc};
    });
  }
  function humanPlay(card){
    if(G.phase!=='PLAYING'||G.curPlayer!==0||!card||!card.id)return;
    const hand=G.hands[0].filter(c=>c&&c.id);
    try{
      if(!legalMoves(hand,G.trick,G.trump,0).some(c=>c.id===card.id))return;
      setG(prev=>applyPlayCard(prev,0,card));
    }catch(e){console.error('humanPlay error',e);}
  }

  // Portrait overlay
  if(!isLs)return(
    <div style={{height:'100dvh',background:'#1a5c20',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',color:'white',textAlign:'center',gap:16}}>
      <div style={{fontSize:52}}>📱</div>
      <div style={{fontSize:20,fontWeight:'bold'}}>Retourne ton iPhone</div>
      <div style={{fontSize:14,opacity:.7}}>BELOTA se joue en mode paysage</div>
      <style>{`@keyframes rot{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:36,animation:'rot 2s linear infinite'}}>🔄</div>
    </div>
  );

  // TABLE = fond vert plein écran
  const TABLE={position:'fixed',inset:0,
    background:'radial-gradient(ellipse at 50% 40%,#2d7a35 0%,#1a5020 60%,#0f3614 100%)',
    fontFamily:'Georgia,serif',color:'white',userSelect:'none',overflow:'hidden'};

  const isDone=G.phase==='TRICK_DONE';
  // trick contient toujours les cartes visibles (0 à 4)
  const trickMap=Object.fromEntries((G.trick||[]).filter(t=>t&&t.c).map(t=>[t.p,t.c]));
  const hand0=(G.hands[0]||[]).filter(c=>c&&c.id);
  let legalIDs=new Set();
  try{
    if(G.phase==='PLAYING'&&G.curPlayer===0&&G.trump&&hand0.length){
      legalIDs=new Set(legalMoves(hand0,G.trick||[],G.trump,0).map(c=>c&&c.id).filter(Boolean));
    }
  }catch(e){console.error('legalMoves render error',e);}
  const t0=G.done.filter(d=>teamOf(d.winner)===0).length;
  const t1=G.done.filter(d=>teamOf(d.winner)===1).length;
  const ac=G.trump&&RED_S(G.trump)?'#ff9090':'white';

  // ── FIN DE MANCHE / PARTIE
  if(G.phase==='ROUND_END'||G.phase==='GAME_OVER'){
    const r=G.roundResult,nd=nextP(G.dealer);
    return(
      <div style={{...TABLE,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'rgba(0,0,0,.7)',borderRadius:16,padding:24,
          maxWidth:460,width:'90%',textAlign:'center',border:'1px solid rgba(255,255,255,.15)'}}>
          <div style={{fontSize:16,fontWeight:'bold',marginBottom:12}}>
            {G.phase==='GAME_OVER'?'🏆 Partie terminée !':'✓ Fin de manche'}
          </div>
          {r&&<>
            <div style={{fontSize:15,fontWeight:'bold',marginBottom:4}}>{r.msg}</div>
            <div style={{fontSize:11,opacity:.7,marginBottom:14}}>{r.detail}</div>
            <div style={{display:'flex',justifyContent:'center',gap:32,marginBottom:14}}>
              <div><div style={{fontSize:10,opacity:.6}}>Vous+Nord</div>
                <div style={{color:'#2ecc71',fontWeight:'bold',fontSize:24}}>+{r.rp[0]}</div></div>
              <div><div style={{fontSize:10,opacity:.6}}>Ouest+Est</div>
                <div style={{color:'#e74c3c',fontWeight:'bold',fontSize:24}}>+{r.rp[1]}</div></div>
            </div>
            <div style={{fontSize:18,fontWeight:'bold',marginBottom:18}}>
              <span style={{color:'#2ecc71'}}>Vous+Nord : {G.scores[0]}</span>
              <span style={{opacity:.3}}> | </span>
              <span style={{color:'#e74c3c'}}>Adv. : {G.scores[1]}</span>
            </div>
          </>}
          {G.phase==='GAME_OVER'?(
            <div>
              <div style={{fontSize:15,marginBottom:14}}>{G.scores[0]>=1000?'🎉 Vous gagnez !':'😔 Les adversaires gagnent.'}</div>
              <button onClick={()=>setG(initRound())} style={BS('#27ae60')}>Nouvelle partie</button>
            </div>
          ):(
            <button onClick={()=>setG(initRound(G.scores,nd))} style={BS('#2980b9')}>
              Manche suivante → Donneur : {PNAME[nd]}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── ENCHÈRES
  if(G.phase==='BIDDING'){
    const isH=G.bidIdx===0;
    return(
      <div style={TABLE}>
        <div style={{position:'absolute',top:8,left:0,right:0,
          display:'flex',justifyContent:'space-between',padding:'0 16px',zIndex:10}}>
          <div style={{background:'rgba(0,0,0,.55)',borderRadius:20,padding:'4px 14px',fontSize:12}}>
            🃏 <strong>BELOTA</strong>
          </div>
          <div style={{background:'rgba(0,0,0,.55)',borderRadius:20,padding:'4px 14px',fontSize:12}}>
            <span style={{color:'#2ecc71',fontWeight:'bold'}}>{G.scores[0]}</span>
            <span style={{opacity:.4}}> – </span>
            <span style={{color:'#e74c3c',fontWeight:'bold'}}>{G.scores[1]}</span>
          </div>
          <div style={{background:'rgba(0,0,0,.55)',borderRadius:20,padding:'4px 14px',fontSize:11,opacity:.8}}>
            Don: {PNAME[G.dealer]}
          </div>
        </div>
        <div style={{position:'absolute',top:'10%',left:'50%',transform:'translateX(-50%)',zIndex:5}}>
          <PlayerChip name="Nord" cards={(G.hands[2]||[]).length} active={G.bidIdx===2} dealer={G.dealer===2} team={0}/>
          {G.bidIdx===2&&<div style={{textAlign:'center',fontSize:11,opacity:.7,marginTop:3}}>réfléchit…</div>}
        </div>
        <div style={{position:'absolute',top:'42%',left:'4%',transform:'translateY(-50%)',zIndex:5}}>
          <PlayerChip name="Ouest" cards={(G.hands[1]||[]).length} active={G.bidIdx===1} dealer={G.dealer===1} team={1}/>
          {G.bidIdx===1&&<div style={{textAlign:'center',fontSize:11,opacity:.7,marginTop:3}}>réfléchit…</div>}
        </div>
        <div style={{position:'absolute',top:'42%',right:'4%',transform:'translateY(-50%)',zIndex:5}}>
          <PlayerChip name="Est" cards={(G.hands[3]||[]).length} active={G.bidIdx===3} dealer={G.dealer===3} team={1}/>
          {G.bidIdx===3&&<div style={{textAlign:'center',fontSize:11,opacity:.7,marginTop:3}}>réfléchit…</div>}
        </div>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-60%)',zIndex:5,textAlign:'center'}}>
          <div style={{fontSize:11,opacity:.7,marginBottom:6,textShadow:'0 1px 4px rgba(0,0,0,.9)'}}>Carte retournée</div>
          <CardView card={G.flipCard} W={70} H={100}/>
        </div>
        {isH&&(
          <div style={{position:'absolute',top:'55%',left:'50%',
            transform:'translateX(-50%)',zIndex:99,textAlign:'center',
            background:'rgba(0,0,0,.78)',borderRadius:16,
            padding:'12px 20px',border:'2px solid rgba(255,255,255,.25)',
            boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}>
            <div style={{fontSize:14,fontWeight:'bold',marginBottom:10,color:'white'}}>
              {G.bidRound===1?`Prendre à ${SUIT_FR[G.flipCard?.s]} ?`:"Choisissez l'atout :"}
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
              {G.bidRound===1?(<>
                <button onClick={()=>humanBid(G.flipCard.s)}
                  style={{...BS('#27ae60'),fontSize:15,padding:'10px 22px'}}>
                  ✓ Prendre {G.flipCard.s}
                </button>
                <button onClick={()=>humanBid(null)}
                  style={{...BS('#7f8c8d'),fontSize:15,padding:'10px 22px'}}>
                  Passer
                </button>
              </>):(<>
                {SUITS.filter(s=>s!==G.flipCard?.s).map(s=>(
                  <button key={s} onClick={()=>humanBid(s)}
                    style={{...BS(RED_S(s)?'#c0392b':'#2c3e50'),fontSize:14,padding:'10px 16px'}}>
                    {s} {SUIT_FR[s]}
                  </button>
                ))}
                <button onClick={()=>humanBid(null)}
                  style={{...BS('#7f8c8d'),fontSize:14,padding:'10px 16px'}}>
                  Passer
                </button>
              </>)}
            </div>
          </div>
        )}
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:8}}>
          <FanHand hand={hand0} trump={null} cw={62} ch={88} pv={280}/>
        </div>
      </div>
    );
  }

  // ── JEU
  const pliNum=G.done.length+1;
  return(
    <div style={TABLE}>
      {/* Infos coins */}
      <div style={{position:'absolute',top:6,left:10,zIndex:20,
        background:'rgba(0,0,0,.6)',borderRadius:20,padding:'4px 12px',fontSize:11}}>
        <strong style={{color:ac}}>{G.trump} {G.trump?SUIT_FR[G.trump]:''}</strong>
        <span style={{opacity:.55,fontSize:9}}> {G.takerTeam===0?'(vous+N)':'(adv.)'}</span>
      </div>
      <div style={{position:'absolute',top:6,left:'50%',transform:'translateX(-50%)',zIndex:20,
        background:'rgba(0,0,0,.6)',borderRadius:20,padding:'4px 14px',
        fontSize:12,color:isDone?'#f1c40f':'rgba(255,255,255,.85)',fontWeight:'bold'}}>
        {G.announce||(isDone?`Pli ${pliNum}/8 ⏳`:`Pli ${pliNum}/8`)}
      </div>
      <div style={{position:'absolute',top:6,right:10,zIndex:20,
        background:'rgba(0,0,0,.6)',borderRadius:20,padding:'4px 12px',fontSize:11}}>
        <span style={{color:'#2ecc71',fontWeight:'bold'}}>{G.scores[0]}</span>
        <span style={{opacity:.4}}> – </span>
        <span style={{color:'#e74c3c',fontWeight:'bold'}}>{G.scores[1]}</span>
        <span style={{opacity:.35,fontSize:9}}> {t0}-{t1}</span>
      </div>

      {/* Chips joueurs */}
      <div style={{position:'absolute',top:'5%',left:'50%',transform:'translateX(-50%)',zIndex:10}}>
        <PlayerChip name="Nord" cards={(G.hands[2]||[]).filter(c=>c&&c.id).length}
          active={G.curPlayer===2&&!isDone} dealer={G.dealer===2} team={0}/>
      </div>
      <div style={{position:'absolute',top:'45%',left:'2%',transform:'translateY(-50%)',zIndex:10}}>
        <PlayerChip name="Ouest" cards={(G.hands[1]||[]).filter(c=>c&&c.id).length}
          active={G.curPlayer===1&&!isDone} dealer={G.dealer===1} team={1}/>
      </div>
      <div style={{position:'absolute',top:'45%',right:'2%',transform:'translateY(-50%)',zIndex:10}}>
        <PlayerChip name="Est" cards={(G.hands[3]||[]).filter(c=>c&&c.id).length}
          active={G.curPlayer===3&&!isDone} dealer={G.dealer===3} team={1}/>
      </div>

      {/* ── GRILLE DU PLI : CSS grid 3×3 centrée — positions 100% garanties ── */}
      <div style={{
        position:'absolute',
        top:'10%',
        left:'50%',
        transform:'translateX(-50%)',
        zIndex:1000,
        display:'grid',
        gridTemplateColumns:`${PC_W}px 48px ${PC_W}px`,
        gridTemplateRows:`${PC_H}px 24px ${PC_H}px`,
        gap:'6px',
        alignItems:'center',
        justifyItems:'center',
      }}>
        {/* Rang 1: [vide] [Nord=p2] [vide] */}
        <div/>
        <div>{trickMap[2]?<CardView card={trickMap[2]} W={PC_W} H={PC_H}/>:<Slot W={PC_W} H={PC_H}/>}</div>
        <div/>
        {/* Rang 2: [Ouest=p1] [info] [Est=p3] */}
        <div>{trickMap[1]?<CardView card={trickMap[1]} W={PC_W} H={PC_H}/>:<Slot W={PC_W} H={PC_H}/>}</div>
        <div style={{textAlign:'center',fontSize:9,color:isDone?'#f1c40f':'rgba(255,255,255,.3)'}}>
          {isDone&&G.pendingWin!==null
            ? <span style={{background:'rgba(0,0,0,.7)',borderRadius:4,padding:'2px 5px'}}>{PNAME[G.pendingWin]}✓</span>
            : G.ltWin!==null&&!G.trick.length
              ? <span style={{opacity:.35}}>{PNAME[G.ltWin]}</span>
              : null}
        </div>
        <div>{trickMap[3]?<CardView card={trickMap[3]} W={PC_W} H={PC_H}/>:<Slot W={PC_W} H={PC_H}/>}</div>
        {/* Rang 3: [vide] [Vous=p0] [vide] */}
        <div/>
        <div>{trickMap[0]?<CardView card={trickMap[0]} W={PC_W} H={PC_H}/>:<Slot W={PC_W} H={PC_H}/>}</div>
        <div/>
      </div>
      {/* Label joueur */}
      <div style={{position:'absolute',bottom:'23%',left:'50%',
        transform:'translateX(-50%)',zIndex:20,whiteSpace:'nowrap'}}>
        <div style={{
          background:G.curPlayer===0&&!isDone?'rgba(46,204,113,.2)':'rgba(0,0,0,.5)',
          borderRadius:20,padding:'4px 14px',fontSize:11,
          border:G.curPlayer===0&&!isDone?'1px solid rgba(46,204,113,.7)':'1px solid rgba(255,255,255,.1)',
          color:G.curPlayer===0&&!isDone?'#2ecc71':'rgba(255,255,255,.7)',
          fontWeight:G.curPlayer===0&&!isDone?'bold':'normal'}}>
          {isDone?`⏳ ${PNAME[G.pendingWin]} remporte…`
            :G.curPlayer===0?`🎯 Jouez${G.takerTeam===0?' (vous avez pris)':''}`
            :`${PNAME[G.curPlayer]} joue…`}
        </div>
      </div>

      {/* Éventail */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:8}}>
        <FanHand hand={hand0} legalIDs={legalIDs} onPlay={humanPlay}
          trump={G.trump} cw={62} ch={88} pv={280}/>
      </div>
    </div>
  );
}

export default function Belota(){
  return <ErrorBoundary><BelotaInner/></ErrorBoundary>;
}

function BelotaInner(){
  return <ErrorBoundary><BelotaGame/></ErrorBoundary>;
}
