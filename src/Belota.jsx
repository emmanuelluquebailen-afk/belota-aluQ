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

// ── Constantes ────────────────────────────────────────────────────────────────
const SUITS=['♠','♥','♦','♣'];
const RED=s=>s==='♥'||s==='♦';
const SFR={'♠':'Pique','♥':'Cœur','♦':'Carreau','♣':'Trèfle'};
const RANKS=['7','8','9','10','J','Q','K','A'];
const DIS={'7':'7','8':'8','9':'9','10':'10','J':'V','Q':'D','K':'R','A':'A'};
const PN=['Vous','Ouest','Nord','Est'];
const SORD=['♠','♥','♣','♦'];
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

// Tailles
const PW=48,PH=68;  // cartes du pli
const HW=68,HH=98;  // cartes de la main

const AI_DELAY=1400;
const SHOW_TRICK_MS=2500; // durée d'affichage du pli complet
const BID_DELAY=900;

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

// ── IA ────────────────────────────────────────────────────────────────────────
function aiTake(hand,suit,r){
  const tc=hand.filter(c=>c.s===suit);
  return r===1?(tc.some(c=>c.r==='J')||(tc.length>=3&&tc.some(c=>c.r==='9'))||tc.length>=4):(tc.some(c=>c.r==='J')||tc.length>=3);
}
function aiSuit(hand,ex){
  let best=null,bv=-1;
  for(const s of SUITS){if(s===ex)continue;const v=hand.filter(c=>c.s===s).reduce((a,c)=>a+TS[c.r],0)+hand.filter(c=>c.s===s).length*2;if(v>bv){bv=v;best=s;}}
  return best;
}
function aiCard(hand,trick,trump,player){
  const mv=legal(hand,trick,trump,player);if(!mv.length)return hand[0];
  const par=(player+2)%4;
  if(!trick.length){
    const j=mv.find(c=>c.s===trump&&c.r==='J');if(j)return j;
    const nt=mv.filter(c=>c.s!==trump);
    if(nt.length)return nt.reduce((b,c)=>cs(c,trump)>cs(b,trump)?c:b);
    return mv.reduce((b,c)=>cs(c,trump)<cs(b,trump)?c:b);
  }
  const w=tWin(trick,trump);
  return w===par?mv.reduce((b,c)=>cs(c,trump)<cs(b,trump)?c:b):mv.reduce((b,c)=>cs(c,trump)>cs(b,trump)?c:b);
}

// ── État ──────────────────────────────────────────────────────────────────────
function init(scores,dealer){
  const sc=scores||[0,0],dl=dealer!==undefined?dealer:3,fp=nxt(dl);
  const{hands,flip,rest}=deal(fp);
  return{phase:'BID',hands,flip,rest,dealer:dl,fp,trump:null,
    br:1,bi:fp,bc:0,taker:null,tt:null,
    trick:[],
    snap:[null,null,null,null],
    waiting:false, 
    winner:null,
    done:[],cur:fp,scores:sc,ann:'',
    bB:[0,0],bH:null,bP:[0,0,0,0],result:null,lw:null};
}

function doPlay(G,player,card){
  const nh=G.hands.map((h,i)=>i===player?h.filter(c=>c&&c.id&&c.id!==card.id):h.filter(c=>c&&c.id));
  const nt=[...(G.trick||[]),{p:player,c:card}];
  const ns=[...G.snap];
  ns[player]=card;
  let ann='',bb=[...G.bB],bp=[...G.bP];
  if(G.bH&&G.bH[player]&&card.s===G.trump&&(card.r==='K'||card.r==='Q')){
    bp=[...bp];bp[player]++;
    if(bp[player]===1)ann='Belote !';
    if(bp[player]===2){ann='Rebelote !';bb=[...bb];bb[team(player)]+=20;}
  }
  
  if (nt.length < 4) {
    return { ...G, hands: nh, trick: nt, snap: ns, cur: nxt(player), ann, bB: bb, bP: bp };
  }
  
  const win = tWin(nt, G.trump);
  const frozenSnap = [...ns]; // 💡 Sécurité : On fige le tapis avec ses 4 cartes
  
  return {
    ...G,
    hands: nh,
    trick: nt,
    snap: frozenSnap,
    waiting: true, // 💡 On déclenche la pause de fin de pli
    winner: win,
    ann,
    bB: bb,
    bP: bp
  };
}

function resolve(G) {
  const win = G.winner;
  const nd = [...G.done, { winner: win, cards: G.snap.filter(c => c && c.s) }];
  
  return {
    ...G,
    trick: [], 
    snap: [null, null, null, null], // 💡 Le tapis se vide proprement ICI, après les 2.5s
    waiting: false,
    winner: null,
    done: nd,
    phase: 'PLAY',
    lw: win,
    ann: '',
    cur: win
  };
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
  rp=[rp[0]+G.bB[0],rp[1]+G.bB[1]];
  const ns=[G.scores[0]+rp[0],G.scores[1]+rp[1]];
  const go=ns[0]>=1000||ns[1]>=1000;
  const tn=G.taker===0?'Vous avez':G.taker===2?'Nord a':G.taker===1?'Ouest a':'Est a';
  const ttn=tt===0?'Vous+Nord':'Ouest+Est',dtn=tt===0?'Ouest+Est':'Vous+Nord';
  let msg,detail;
  if(res==='ok'){msg=`✅ ${tn} pris — ${ttn} réussit !`;detail=`${ttn} ${pts[tt]} pts | ${dtn} ${pts[ot]} pts`;}
  else if(res==='litige'){msg=`🟡 Litige — ${dtn} prend 162`;detail=`${pts[0]}-${pts[1]}`;}
  else{msg=`❌ ${tn} pris — CHUTE ! ${dtn} prend 162`;detail=`${ttn} ${pts[tt]} pts | ${dtn} ${pts[ot]} pts`;}
  return{...G,phase:go?'END':'OVER',scores:ns,result:{pts,rp,res,msg,detail},ann:''};
}

// ── Carte ─────────────────────────────────────────────────────────────────────
function Crd({card,ok,W=54,H=76,onClick}){
  // 💡 Si la carte n'a pas encore chargé ses données ou est incomplète, on affiche un dos de carte
  // au lieu de crash ou de retourner "null" (ce qui créait le bug visuel de l'IA)
  if(!card || !card.s || !card.r) {
    return (
      <div style={{
        width:W,height:H,borderRadius:6,
        background:'#1a3580',border:'2px solid #2244aa',
        backgroundImage:'repeating-linear-gradient(45deg,#1a3580,#1a3580 4px,#243fa0 4px,#243fa0 8px)',
        boxShadow:'0 3px 6px rgba(0,0,0,.3)'
      }}/>
    );
  }
  
  const tc=RED(card.s)?'#c0392b':'#111';
  const fs=W<50?8:W<65?10:11, ms=W<50?14:W<65?18:22;
  return(
    <div onClick={ok?onClick:undefined} style={{
      width:W,height:H,borderRadius:6,position:'relative',overflow:'hidden',
      background:'white',flexShrink:0,
      border:ok?'3px solid #4caf50':'2px solid #ddd',
      boxShadow:ok?'0 0 14px rgba(76,175,80,.9)':'0 3px 10px rgba(0,0,0,.5)',
      cursor:ok?'pointer':'default',
      opacity:ok===false?0.38:1,
      filter:ok===false?'grayscale(50%)':'none',
    }}>
      <div style={{position:'absolute',top:2,left:3,fontSize:fs,fontWeight:700,color:tc,lineHeight:1.1}}>
        {DIS[card.r]}<br/>{card.s}
      </div>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:ms,color:tc}}>
        {card.s}
      </div>
      <div style={{position:'absolute',bottom:2,right:3,fontSize:fs,fontWeight:700,color:tc,lineHeight:1.1,transform:'rotate(180deg)'}}>
        {DIS[card.r]}<br/>{card.s}
      </div>
    </div>
  );
}

// ── Main horizontale ──────────────────────────────────────────────────────────
function Hand({hand,okIds,onPlay,trump}){
  const ids=okIds||new Set();
  const hasOk=okIds!==null&&okIds!==undefined;
  const sorted=sortH(hand,trump);
  const n=sorted.length;if(!n)return null;
  const STEP=Math.min(HW-4,Math.floor(340/Math.max(n-1,1)));
  const totalW=HW+(n-1)*STEP;
  return(
    <div style={{position:'relative',height:HH+20,width:totalW,margin:'0 auto'}}>
      {sorted.map((card,i)=>{
        const ok=hasOk?ids.has(card.id):undefined;
        return(
          <div key={card.id} onClick={ok?()=>onPlay(card):undefined}
            style={{position:'absolute',left:i*STEP,bottom:0,width:HW,height:HH,
              zIndex:ok?i+30:i+1,
              transform:ok?'translateY(-12px)':'none',
              transition:'transform .1s',cursor:ok?'pointer':'default'}}>
            <Crd card={card} ok={ok} W={HW} H={HH} onClick={()=>onPlay(card)}/>
          </div>
        );
      })}
    </div>
  );
}

// ── Slot pli (emplacement d'une carte) ────────────────────────────────────────
function Slot({card,label}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
      <div style={{fontSize:9,opacity:.6,color:'white',height:12,lineHeight:'12px'}}>{label}</div>
      <div style={{width:PW,height:PH,borderRadius:6,
        background: card?'transparent':'rgba(255,255,255,.08)',
        border: card?'none':'1px dashed rgba(255,255,255,.2)',
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        {card?<Crd card={card} W={PW} H={PH}/>:null}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App(){
  const[G,setG]=useState(()=>init());
  const timer=useRef(null);
  const[ls,setLs]=useState(()=>typeof window!=='undefined'&&window.innerWidth>window.innerHeight);
  useEffect(()=>{const u=()=>setLs(window.innerWidth>window.innerHeight);window.addEventListener('resize',u);return()=>window.removeEventListener('resize',u);},[]);

  // Résolution automatique du pli après SHOW_TRICK_MS (2,5 secondes)
  useEffect(() => {
    if (!G.waiting) return;
    if (timer.current) clearTimeout(timer.current);
    
    timer.current = setTimeout(() => {
      setG(p => p.waiting ? resolve(p) : p);
    }, SHOW_TRICK_MS);
    
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [G.waiting]); 

  // IA enchères
  useEffect(()=>{
    if(G.phase!=='BID'||G.bi===0)return;
    const t=setTimeout(()=>{
      setG(prev=>{
        if(prev.phase!=='BID'||prev.bi===0)return prev;
        const p=prev.bi,hand=prev.hands[p].filter(c=>c&&c.id);
        const take=suit=>({...prev,phase:'PLAY',trump:suit,taker:p,tt:team(p),cur:prev.fp,trick:[],snap:[null,null,null,null],waiting:false,winner:null,
          hands:complete(prev.hands,prev.flip,prev.rest,p),
          bH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))});
        if(prev.br===1){if(aiTake(hand,prev.flip.s,1))return take(prev.flip.s);}
        else{const s=aiSuit(hand,prev.flip.s);if(s&&aiTake(hand,s,2))return take(s);}
        const nc=prev.bc+1;
        if(nc>=4){if(prev.br===1)return{...prev,br:2,bi:prev.fp,bc:0};const nd=deal(prev.fp);return{...prev,...nd,br:1,bi:prev.fp,bc:0,trump:null};}
        return{...prev,bi:nxt(prev.bi),bc:nc};
      });
    },BID_DELAY);
    return()=>clearTimeout(t);
  },[G.phase,G.bi,G.br]);

  // IA jeu — bloqué si waiting=true
  useEffect(() => {
    if (G.phase !== 'PLAY' || G.cur === 0 || G.waiting) return;
    
    const t = setTimeout(() => {
      setG(prev => {
        if (prev.phase !== 'PLAY' || prev.cur === 0 || prev.waiting) return prev;
        const p = prev.cur, hand = prev.hands[p].filter(c => c && c.id);
        return doPlay(prev, p, aiCard(hand, prev.trick || [], prev.trump, p));
      });
    }, AI_DELAY);
    
    return () => clearTimeout(t);
  }, [G.phase, G.cur, G.waiting]); 

  function bid(suit){
    if(suit!==null){
      setG(prev=>({...prev,phase:'PLAY',trump:suit,taker:0,tt:0,cur:prev.fp,trick:[],snap:[null,null,null,null],waiting:false,winner:null,
        hands:complete(prev.hands,prev.flip,prev.rest,0),
        bH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))}));
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
    <div style={{height:'100dvh',background:'#1a5020',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',color:'white',fontFamily:'Georgia,serif',textAlign:'center',gap:16}}>
      <div style={{fontSize:48}}>📱</div>
      <div style={{fontSize:20,fontWeight:'bold'}}>Retourne ton téléphone</div>
      <div style={{fontSize:14,opacity:.7}}>BELOTA se joue en mode paysage</div>
    </div>
  );

  const TABLE={position:'fixed',inset:0,
    background:`radial-gradient(circle at 50% 40%,#2f7d3a 0%,#1f5d2b 45%,#143b1c 75%,#0b2411 100%)`,
    fontFamily:'Georgia,serif',color:'white',overflow:'hidden',userSelect:'none'};

  const hand0=(G.hands[0]||[]).filter(c=>c&&c.id);
  const myTurn=G.phase==='PLAY'&&G.cur===0&&!G.waiting;
  let okIds=null;
  if(myTurn&&G.trump){try{okIds=new Set(legal(hand0,G.trick||[],G.trump,0).map(c=>c.id));}catch(e){}}
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  const t1=G.done.filter(d=>team(d.winner)===1).length;
  const ac=G.trump&&RED(G.trump)?'#ffcdd2':'#e8f5e9';

  // ── FIN ──────────────────────────────────────────────────────────────────────
  if(G.phase==='OVER'||G.phase==='END'){
    const r=G.result,nd=nxt(G.dealer);
    return(
      <div style={{...TABLE,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'rgba(0,0,0,.8)',borderRadius:16,padding:24,maxWidth:460,
          width:'90%',textAlign:'center',border:'1px solid rgba(255,255,255,.2)'}}>
          <div style={{fontSize:16,fontWeight:'bold',marginBottom:14}}>
            {G.phase==='END'?'🏆 Partie terminée !':'✓ Fin de manche'}
          </div>
          {r&&<>
            <div style={{fontSize:15,fontWeight:'bold',marginBottom:6}}>{r.msg}</div>
            <div style={{fontSize:11,opacity:.7,marginBottom:12}}>{r.detail}</div>
            <div style={{display:'flex',justifyContent:'center',gap:32,marginBottom:12}}>
              <div><div style={{fontSize:10,opacity:.6}}>Vous+Nord</div>
                <div style={{color:'#4caf50',fontWeight:'bold',fontSize:22}}>+{r.rp[0]}</div></div>
              <div><div style={{fontSize:10,opacity:.6}}>Ouest+Est</div>
                <div style={{color:'#ef5350',fontWeight:'bold',fontSize:22}}>+{r.rp[1]}</div></div>
            </div>
            <div style={{fontSize:18,fontWeight:'bold',marginBottom:16}}>
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

  // ── ENCHÈRES ──────────────────────────────────────────────────────────────────
  if(G.phase==='BID'){
    const myTurnBid=G.bi===0;
    return(
      <div style={TABLE}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:30,background:'rgba(0,0,0,.5)',
          display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 14px',zIndex:10}}>
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
          style={{position:'absolute',top:'45%',left:'14%',transform:'translateY(-50%)',zIndex:5}}/>
        <PL name="Est" n={(G.hands[3]||[]).length} active={G.bi===3} dealer={G.dealer===3}
          style={{position:'absolute',top:'45%',right:'14%',transform:'translateY(-50%)',zIndex:5}}/>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-68%)',zIndex:5}}>
          <Crd card={G.flip} W={80} H={114}/>
        </div>
        {!myTurnBid&&(
          <div style={{position:'absolute',bottom:'34%',left:'50%',transform:'translateX(-50%)',
            zIndex:10,background:'rgba(0,0,0,.55)',borderRadius:20,padding:'4px 14px',fontSize:11}}>
            ⏳ {PN[G.bi]} réfléchit…
          </div>
        )}
        {myTurnBid&&(
          <div style={{position:'absolute',bottom:'28%',left:'50%',
            transform:'translateX(-50%)',zIndex:20,display:'flex',gap:10,alignItems:'center'}}>
            {G.br===1?(<>
              <button onClick={()=>bid(G.flip.s)} style={suitBtn(RED(G.flip?.s)?'rgba(140,20,20,.9)':'rgba(20,50,20,.9)',true)}>
                {G.flip.s}
              </button>
              <button onClick={()=>bid(null)} style={passBtn()}>Passer</button>
            </>):(<>
              {SUITS.filter(s=>s!==G.flip?.s).map(s=>(
                <button key={s} onClick={()=>bid(s)} style={suitBtn(RED(s)?'rgba(140,20,20,.9)':'rgba(20,40,80,.9)',false)}>
                  {s}
                </button>
              ))}
              <button onClick={()=>bid(null)} style={passBtn()}>Passer</button>
            </>)}
          </div>
        )}
        <div style={{position:'absolute',bottom:10,left:0,right:0,zIndex:6,textAlign:'center'}}>
          <Hand hand={hand0} trump={null} okIds={null}/>
        </div>
      </div>
    );
  }

  // ── JEU ───────────────────────────────────────────────────────────────────────
  return(
    <div style={TABLE}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>

      {/* Barre top */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:28,
        background:'rgba(0,0,0,.55)',display:'flex',justifyContent:'space-between',
        alignItems:'center',padding:'0 12px',zIndex:10}}>
        <div style={{fontSize:11}}>
          <span style={{color:ac,fontWeight:'bold'}}>{G.trump} {G.trump?SFR[G.trump]:''}</span>
          <span style={{opacity:.5,fontSize:9}}> {G.tt===0?'V+N':'Adv.'}</span>
        </div>
        <div style={{fontSize:12,color:G.waiting?'#ffd54f':'rgba(255,255,255,.85)',fontWeight:'bold'}}>
          {G.ann||`Pli ${G.done.length+1}/8`}
        </div>
        <div style={{fontSize:11}}>
          <span style={{color:'#4caf50',fontWeight:'bold'}}>{G.scores[0]}</span>
          <span style={{opacity:.4}}> — </span>
          <span style={{color:'#ef5350',fontWeight:'bold'}}>{G.scores[1]}</span>
          <span style={{opacity:.35,fontSize:9}}> {t0}-{t1}</span>
        </div>
      </div>

      {/* Labels joueurs */}
      <PL name="Nord" n={(G.hands[2]||[]).filter(c=>c&&c.id).length}
        active={G.cur===2&&!G.waiting} dealer={G.dealer===2}
        style={{position:'absolute',top:32,left:'50%',transform:'translateX(-50%)',zIndex:10}}/>
      <PL name="Ouest" n={(G.hands[1]||[]).filter(c=>c&&c.id).length}
        active={G.cur===1&&!G.waiting} dealer={G.dealer===1}
        style={{position:'absolute',top:'44%',left:'2%',transform:'translateY(-50%)',zIndex:10}}/>
      <PL name="Est" n={(G.hands[3]||[]).filter(c=>c&&c.id).length}
        active={G.cur===3&&!G.waiting} dealer={G.dealer===3}
        style={{position:'absolute',top:'44%',right:'2%',transform:'translateY(-50%)',zIndex:10}}/>

      {/* ZONE DE PLI — En croix */}
      <div style={{
        position:'absolute',
        top:30, left:'15%', right:'15%', bottom:140,
        zIndex:100,
        display:'grid',
        gridTemplateColumns:'1fr 1fr 1fr',
        gridTemplateRows:'1fr 1fr 1fr',
        alignItems:'center',
        justifyItems:'center',
        pointerEvents:'none',
      }}>
        <div/><Slot card={G.snap[2]} label="Nord"/><div/>
        <Slot card={G.snap[1]} label="Ouest"/>
        <div style={{fontSize:10,color:'#ffd54f',fontWeight:'bold',textAlign:'center'}}>
          {G.waiting&&G.winner!==null?`${PN[G.winner]} ✓`:''}
        </div>
        <Slot card={G.snap[3]} label="Est"/>
        <div/><Slot card={G.snap[0]} label="Vous"/><div/>
      </div>

      {/* Indicateur de tour */}
      <div style={{position:'absolute',bottom:128,left:'50%',transform:'translateX(-50%)',
        zIndex:50,whiteSpace:'nowrap'}}>
        {G.waiting?(
          <div style={{background:'rgba(0,0,0,.55)',border:'1px solid #ffd54f',
            borderRadius:20,padding:'3px 12px',fontSize:11,color:'#ffd54f'}}>
            {G.winner!==null?`${PN[G.winner]} remporte ce pli`:'…'}
          </div>
        ):myTurn?(
          <div style={{background:'rgba(27,94,32,.95)',border:'2px solid #66bb6a',
            borderRadius:20,padding:'4px 14px',fontSize:12,fontWeight:'bold',
            animation:'pulse 1.2s infinite'}}>
            🎯 À vous — jouez une carte
          </div>
        ):(
          <div style={{background:'rgba(0,0,0,.5)',borderRadius:20,
            padding:'3px 12px',fontSize:11,opacity:.8}}>
            ▶ {PN[G.cur]} joue…
          </div>
        )}
      </div>

      {/* Main joueur */}
      <div style={{position:'absolute',bottom:10,left:0,right:0,zIndex:8,textAlign:'center'}}>
        <Hand hand={hand0} okIds={okIds} onPlay={playCard} trump={G.trump}/>
      </div>
    </div>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────
function PL({name,n,active,dealer,style={}}){
  return(
    <div style={{textAlign:'center',...style}}>
      <div style={{fontSize:active?12:10,fontWeight:active?'bold':'normal',
        color:active?'#ffd54f':'rgba(255,255,255,.75)',textShadow:'0 1px 4px rgba(0,0,0,.9)',marginBottom:2}}>
        {active?'▼ ':''}{name}{dealer?' 🔴':''}
      </div>
      <div style={{background:active?'rgba(46,125,50,.7)':'rgba(0,0,0,.45)',
        borderRadius:20,padding:'2px 10px',fontSize:11,display:'inline-block',
        border:'1px solid rgba(255,255,255,.2)'}}>
        {n}🂠
      </div>
    </div>
  );
}

function Btn({children,onClick,bg}){
  return(
    <button onClick={onClick} style={{background:bg,color:'white',border:'none',
      borderRadius:22,padding:'9px 20px',fontSize:13,cursor:'pointer',fontWeight:'bold',
      boxShadow:'0 3px 8px rgba(0,0,0,.4)'}}>
      {children}
    </button>
  );
}
function suitBtn(bg,big){
  return{background:bg,color:'white',border:'1px solid rgba(255,255,255,.35)',
    borderRadius:'50%',width:big?64:52,height:big?64:52,fontSize:big?28:22,
    display:'flex',alignItems:'center',justifyContent:'center',
    cursor:'pointer',fontWeight:'bold',boxShadow:'0 3px 10px rgba(0,0,0,.5)',flexShrink:0};
}
function passBtn(){
  return{background:'rgba(50,50,50,.75)',color:'rgba(255,255,255,.8)',
    border:'1px solid rgba(255,255,255,.2)',borderRadius:20,padding:'8px 18px',
    fontSize:13,cursor:'pointer',fontWeight:'normal',boxShadow:'0 2px 8px rgba(0,0,0,.4)'};
}

export default function Belota(){
  return <EB><App/></EB>;
}
