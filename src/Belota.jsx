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
const PN=['Sud','Ouest','Nord','Est']; 
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
const PW=52, PH=76;  
const HW=72, HH=106; 

const AI_DELAY=1400;
const SHOW_TRICK_MS=2500; 
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
  if (G.waiting) return G;
  
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
  
  const cartesPosees = ns.filter(c => c !== null).length;
  if (cartesPosees < 4) {
    return { ...G, hands: nh, trick: nt, snap: ns, cur: nxt(player), ann, bB: bb, bP: bp };
  }
  
  const win = tWin(nt, G.trump);
  return {
    ...G,
    hands: nh,
    trick: nt,
    snap: ns,
    waiting: true, 
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
    snap: [null, null, null, null], 
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
  else for(let i=0;i<8;i++){const d=G.done[i],tm=team(d.winner);pts[tm]+= d.cards.reduce((s,c)=>s+cp(c,G.trump),0);if(i===7)pts[tm]+=10;}
  const tt=G.tt,ot=1-tt;
  let rp=[0,0],res;
  if(pts[tt]>pts[ot]){res='ok';rp=[...pts];}
  else if(pts[tt]===pts[ot]){res='litige';rp=tt===0?[0,162]:[162,0];}
  else{res='chute';rp=tt===0?[0,162]:[162,0];}
  rp=[rp[0]+G.bB[0],rp[1]+G.bB[1]];
  const ns=[G.scores[0]+rp[0],G.scores[1]+rp[1]];
  const go=ns[0]>=1000||ns[1]>=1000;
  const tn=G.taker===0?'Vous gagnez la':G.taker===2?'Nord gagne la':G.taker===1?'Ouest gagne la':'Est gagne la';
  const ttn=tt===0?'Vous+Nord':'Ouest+Est',dtn=tt===0?'Ouest+Est':'Vous+Nord';
  let msg,detail;
  if(res==='ok'){msg=`✅ Enchère réussie !`;detail=`${ttn} ${pts[tt]} pts | ${dtn} ${pts[ot]} pts`;}
  else if(res==='litige'){msg=`🟡 Litige — ${dtn} prend 162`;detail=`${pts[0]}-${pts[1]}`;}
  else{msg=`❌ CHUTE ! ${dtn} prend 162`;detail=`${ttn} ${pts[tt]} pts | ${dtn} ${pts[ot]} pts`;}
  return{...G,phase:go?'END':'OVER',scores:ns,result:{pts,rp,res,msg,detail},ann:''};
}

// ── Vrais Graphismes de Cartes Vectoriels (SVG) Miroir Traditionnels ──────────
function Crd({card,ok,W=54,H=76,onClick}){
  if(!card||!card.s) return null;
  
  // 💡 FIXÉ : fs est défini de manière globale et sécurisée en tout début de composant
  const fs = W < 50 ? 8 : W < 65 ? 10 : 11;
  const tc = RED(card.s) ? '#d63031' : '#2d3436';
  const isFig = ['J','Q','K'].includes(card.r);

  let portraitSvg = null;
  if (isFig) {
    let coatColor = card.r==='K' ? '#e17055' : card.r==='Q' ? '#fdcb6e' : '#0984e3';
    let sColor = tc;
    portraitSvg = (
      <svg viewBox="0 0 40 60" style={{position:'absolute',inset:'12px 6px',width:'calc(100% - 12px)',height:'calc(100% - 24px)',borderRadius:2,background:'#f5f6fa',border:'1px solid #dfe6e9'}}>
        <g stroke="#2d3436" strokeWidth="0.6" fill="none">
          {/* Partie Haute */}
          <path d="M 10,22 C 10,12 30,12 30,22 L 28,30 L 12,30 Z" fill={coatColor} />
          <circle cx="20" cy="17" r="4" fill="#ffeaa7" />
          <path d="M 17,14 L 20,11 L 23,14 Z" fill="#fdcb6e" stroke="#2d3436" /> 
          <text x="20" y="27" fontSize="8" textAnchor="middle" fill={sColor} stroke="none" fontWeight="bold">{card.s}</text>
          
          {/* Ligne miroir */}
          <line x1="4" y1="30" x2="36" y2="30" stroke="#b2bec3" strokeWidth="0.5" strokeDasharray="2,1" />
          
          {/* Partie Basse */}
          <g transform="rotate(180 20 30)">
            <path d="M 10,22 C 10,12 30,12 30,22 L 28,30 L 12,30 Z" fill={coatColor} />
            <circle cx="20" cy="17" r="4" fill="#ffeaa7" />
            <path d="M 17,14 L 20,11 L 23,14 Z" fill="#fdcb6e" stroke="#2d3436" />
            <text x="20" y="27" fontSize="8" textAnchor="middle" fill={sColor} stroke="none" fontWeight="bold">{card.s}</text>
          </g>
        </g>
      </svg>
    );
  } else {
    const icons = [];
    const maxIcons = card.r === 'A' ? 1 : card.r === '10' ? 4 : 2;
    for(let k=0; k<maxIcons; k++) {
      icons.push(<span key={k} style={{fontSize: card.r==='A'?26:14, margin: card.r==='A'?0:1}}>{card.s}</span>);
    }
    portraitSvg = (
      <div style={{position:'absolute',inset:'12px 6px',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'center',color:tc,lineHeight:1}}>
        {icons}
      </div>
    );
  }

  return(
    <div onClick={ok?onClick:undefined} style={{
      width:W,height:H,borderRadius:5,position:'relative',overflow:'hidden',
      background:'#ffffff',flexShrink:0,
      border:ok?'2.5px solid #2ecc71':'1px solid #b2bec3',
      boxShadow:ok?'0 0 12px rgba(46,204,113,0.8)':'0 2px 6px rgba(0,0,0,0.3)',
      cursor:ok?'pointer':'default',
      opacity:ok===false?0.45:1,
    }}>
      {/* Index Supérieur Gauche */}
      <div style={{position:'absolute',top:2,left:4,fontSize:fs,fontWeight:'900',color:tc,lineHeight:1,textAlign:'center',fontFamily:'sans-serif'}}>
        {DIS[card.r]}<br/><span style={{fontSize:fs-2,lineHeight:0.8}}>{card.s}</span>
      </div>
      
      {/* Corps Visuel Principal */}
      {portraitSvg}

      {/* Index Inférieur Droit inversé */}
      <div style={{position:'absolute',bottom:2,right:4,fontSize:fs,fontWeight:'900',color:tc,lineHeight:1,transform:'rotate(180deg)',textAlign:'center',fontFamily:'sans-serif'}}>
        {DIS[card.r]}<br/><span style={{fontSize:fs-2,lineHeight:0.8}}>{card.s}</span>
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
  const STEP=Math.min(HW-12,Math.floor(360/Math.max(n-1,1)));
  const totalW=HW+(n-1)*STEP;
  return(
    <div style={{position:'relative',height:HH+20,width:totalW,margin:'0 auto'}}>
      {sorted.map((card,i)=>{
        const ok=hasOk?ids.has(card.id):undefined;
        return(
          <div key={card.id} onClick={ok?()=>onPlay(card):undefined}
            style={{position:'absolute',left:i*STEP,bottom:0,width:HW,height:HH,
              zIndex:ok?i+30:i+1,
              transform:ok?'translateY(-14px)':'none',
              transition:'transform .15s ease-out',cursor:ok?'pointer':'default'}}>
            <Crd card={card} ok={ok} W={HW} H={HH} onClick={()=>onPlay(card)}/>
          </div>
        );
      })}
    </div>
  );
}

function Slot({card,label}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <div style={{fontSize:10,opacity:0.5,color:'white',height:12,fontWeight:'bold'}}>{label}</div>
      <div style={{width:PW,height:PH,borderRadius:5,
        background: card?'transparent':'rgba(0,0,0,0.15)',
        border: card?'none':'1px dashed rgba(255,255,255,0.15)',
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        {card?<Crd card={card} W={PW} H={PH}/>:null}
      </div>
    </div>
  );
}

// ── App Principale ────────────────────────────────────────────────────────────
function App(){
  const[G,setG]=useState(()=>init());
  const timer=useRef(null);
  const[ls,setLs]=useState(()=>typeof window!=='undefined'&&window.innerWidth>window.innerHeight);
  useEffect(()=>{const u=()=>setLs(window.innerWidth>window.innerHeight);window.addEventListener('resize',u);return()=>window.removeEventListener('resize',u);},[]);

  useEffect(() => {
    if (!G.waiting) return;
    if (timer.current) clearTimeout(timer.current);
    
    timer.current = setTimeout(() => {
      setG(p => p.waiting ? resolve(p) : p);
    }, SHOW_TRICK_MS);
    
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [G.waiting]); 

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
    <div style={{height:'100dvh',background:'#1b4d22',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'sans-serif',textAlign:'center',gap:16}}>
      <div style={{fontSize:48}}>📱</div>
      <div style={{fontSize:20,fontWeight:'bold'}}>Retourne ton téléphone</div>
      <div style={{fontSize:14,opacity:.7}}>BELOTA se joue en mode paysage</div>
    </div>
  );

  const TABLE={
    position:'fixed',inset:0,
    paddingLeft: 'max(24px, env(safe-area-inset-left))',
    paddingRight: 'max(24px, env(safe-area-inset-right))',
    background: '#1b4d22',
    backgroundImage: 'radial-gradient(circle at 50% 50%, #226b30 0%, #143b1c 70%, #0d2b13 100%)',
    boxShadow: 'inset 0 0 100px rgba(0,0,0,0.6)',
    fontFamily:'sans-serif',color:'white',overflow:'hidden',userSelect:'none'
  };

  const hand0=(G.hands[0]||[]).filter(c=>c&&c.id);
  const myTurn=G.phase==='PLAY'&&G.cur===0&&!G.waiting;
  let okIds=null;
  if(myTurn&&G.trump){try{okIds=new Set(legal(hand0,G.trick||[],G.trump,0).map(c=>c.id));}catch(e){}}
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  const t1=G.done.filter(d=>team(d.winner)===1).length;
  const ac=G.trump&&RED(G.trump)?'#ff7675':'#74b9ff';

  if(G.phase==='OVER'||G.phase==='END'){
    const r=G.result,nd=nxt(G.dealer);
    return(
      <div style={{...TABLE,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'rgba(16,28,19,0.95)',borderRadius:16,padding:28,maxWidth:420,width:'90%',textAlign:'center',border:'1px solid rgba(255,255,255,0.15)',boxShadow:'0 10px 30px rgba(0,0,0,0.5)'}}>
          <div style={{fontSize:18,fontWeight:'bold',marginBottom:14,letterSpacing:0.5}}>
            {G.phase==='END'?'🏆 PARTIE TERMINÉE !':'✓ FIN DE MANCHE'}
          </div>
          {r&&<>
            <div style={{fontSize:15,fontWeight:'600',color:'#ffd54f',marginBottom:6}}>{r.msg}</div>
            <div style={{fontSize:12,opacity:0.6,marginBottom:16}}>{r.detail}</div>
            <div style={{display:'flex',justifyContent:'center',gap:40,marginBottom:16}}>
              <div><div style={{fontSize:11,opacity:0.5}}>Vous + Nord</div>
                <div style={{color:'#2ecc71',fontWeight:'bold',fontSize:24}}>+{r.rp[0]}</div></div>
              <div><div style={{fontSize:11,opacity:0.5}}>Ouest + Est</div>
                <div style={{color:'#ff7675',fontWeight:'bold',fontSize:24}}>+{r.rp[1]}</div></div>
            </div>
            <div style={{fontSize:18,fontWeight:'bold',background:'rgba(255,255,255,0.05)',padding:'8px 12px',borderRadius:8,marginBottom:20}}>
              <span style={{color:'#2ecc71'}}>Vous {G.scores[0]}</span>
              <span style={{opacity:0.2,margin:'0 10px'}}>—</span>
              <span style={{color:'#ff7675'}}>Adv. {G.scores[1]}</span>
            </div>
          </>}
          {G.phase==='END'
            ?<><Btn bg="#2ecc71" onClick={()=>setG(init())}>Nouvelle partie</Btn></>
            :<Btn bg="#0984e3" onClick={()=>setG(init(G.scores,nd))}>Manche suivante</Btn>}
        </div>
      </div>
    );
  }

  return (
    <div style={TABLE}>
      {/* HUD Supérieur */}
      <div style={{position:'absolute',top:12,left:24,right:24,display:'flex',justifyContent:'space-between',alignItems:'center',zIndex:10,fontSize:13,opacity:0.85}}>
        <div>{G.trump ? <span style={{background:'rgba(0,0,0,0.3)',padding:'4px 10px',borderRadius:12,fontWeight:'bold',color:ac}}>{G.trump} Atout {SFR[G.trump]}</span> : 'Enchères'}</div>
        <div style={{fontWeight:'bold',fontSize:14,letterSpacing:0.5}}>{G.phase==='PLAY'?`Pli ${G.done.length+1} / 8`:'Annonces'}</div>
        <div style={{background:'rgba(0,0,0,0.3)',padding:'4px 12px',borderRadius:12,fontWeight:'bold'}}>
          <span style={{color:'#2ecc71'}}>{G.scores[0]}</span><span style={{opacity:0.3,margin:'0 4px'}}>:</span><span style={{color:'#ff7675'}}>{G.scores[1]}</span>
        </div>
      </div>

      {/* Profils Joueurs */}
      <PL name="Nord" n={(G.hands[2]||[]).filter(c=>c&&c.id).length} active={G.cur===2&&G.phase==='PLAY'} style={{position:'absolute',top:42,left:'50%',transform:'translateX(-50%)'}}/>
      <PL name="Ouest" n={(G.hands[1]||[]).filter(c=>c&&c.id).length} active={G.cur===1&&G.phase==='PLAY'} style={{position:'absolute',top:'45%',left:16,transform:'translateY(-50%)'}}/>
      <PL name="Est" n={(G.hands[3]||[]).filter(c=>c&&c.id).length} active={G.cur===3&&G.phase==='PLAY'} style={{position:'absolute',top:'45%',right:16,transform:'translateY(-50%)'}}/>

      {/* ZONE CENTRALE */}
      {G.phase==='BID' ? (
        <div style={{position:'absolute',top:'46%',left:'50%',transform:'translate(-50%,-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:16,zIndex:100}}>
          <Crd card={G.flip} W={84} H={120}/>
          
          {G.bi === 0 ? (
            <div style={{display:'flex',background:'rgba(0,0,0,0.75)',padding:'6px 10px',borderRadius:30,boxShadow:'0 8px 24px rgba(0,0,0,0.4)',alignItems:'center',gap:8}}>
              {G.br===1 ? (
                <button onClick={()=>bid(G.flip.s)} style={{background:'#ffffff',color:'#2d3436',border:'none',borderRadius:20,padding:'8px 22px',fontSize:14,fontWeight:'bold',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{color:RED(G.flip.s)?'#d63031':'#2d3436',fontSize:18}}>{G.flip.s}</span> Prendre
                </button>
              ) : (
                SUITS.filter(s=>s!==G.flip?.s).map(s=>(
                  <button key={s} onClick={()=>bid(s)} style={{background:'#ffffff',color:'#2d3436',border:'none',borderRadius:20,padding:'6px 14px',fontSize:16,fontWeight:'bold',cursor:'pointer'}}>
                    <span style={{color:RED(s)?'#d63031':'#2d3436'}}>{s}</span>
                  </button>
                ))
              )}
              <button onClick={()=>bid(null)} style={{background:'rgba(255,255,255,0.15)',color:'#ffffff',border:'none',borderRadius:20,padding:'8px 22px',fontSize:14,fontWeight:'500',cursor:'pointer'}}>
                Passer
              </button>
            </div>
          ) : (
            <div style={{fontSize:12,opacity:0.6,fontStyle:'italic'}}>Tour de rôle : {PN[G.bi]} réfléchit...</div>
          )}
        </div>
      ) : (
        /* TAPIS DE JEU */
        <div style={{position:'absolute',top:'44%',left:'50%',transform:'translate(-50%,-50%)',width:240,height:210,zIndex:90,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr 1fr',alignItems:'center',justifyItems:'center',pointerEvents:'none'}}>
          <div/><Slot card={G.snap[2]} label="Nord"/><div/>
          <Slot card={G.snap[1]} label="Ouest"/>
          
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:11,color:'#ffd54f',fontWeight:'bold',textAlign:'center'}}>
              {G.waiting&&G.winner!==null?`${PN[G.winner]} ✓`:''}
            </div>
            {G.waiting && G.winner !== null && (
              <div style={{background:'rgba(0,0,0,0.8)',border:'1px solid #ffd54f',borderRadius:12,padding:'3px 10px',fontSize:9,color:'#ffd54f',marginTop:4,boxShadow:'0 4px 10px rgba(0,0,0,0.3)'}}>
                remporte le pli
              </div>
            )}
          </div>
          
          <Slot card={G.snap[3]} label="Est"/>
          <div/><Slot card={G.snap[0]} label="Vous"/><div/>
        </div>
      )}

      {/* Main Joueur (Sud) */}
      <div style={{position:'absolute',bottom:14,left:0,right:0,zIndex:110,textAlign:'center'}}>
        <Hand hand={hand0} okIds={okIds} onPlay={playCard} trump={G.trump}/>
      </div>
    </div>
  );
}

function PL({name,n,active,style={}}){
  return(
    <div style={{textAlign:'center',...style,transition:'transform 0.2s',transform:active?'scale(1.06)':'scale(1)'}}>
      <div style={{fontSize:11,fontWeight:active?'bold':'500',color:active?'#ffd54f':'rgba(255,255,255,0.6)',marginBottom:4,textShadow:'0 1px 3px rgba(0,0,0,0.5)'}}>
        {active?'● ':''}{name}
      </div>
      <div style={{background:active?'rgba(46,204,113,0.25)':'rgba(0,0,0,0.3)',borderRadius:14,padding:'4px 12px',fontSize:11,display:'inline-block',border:active?'1px solid #2ecc71':'1px solid rgba(255,255,255,0.1)',boxShadow:'0 2px 6px rgba(0,0,0,0.2)'}}>
        {n} 🂠
      </div>
    </div>
  );
}

function Btn({children,onClick,bg}){
  return(
    <button onClick={onClick} style={{background:bg,color:'white',border:'none',borderRadius:20,padding:'10px 24px',fontSize:13,cursor:'pointer',fontWeight:'bold',boxShadow:'0 4px 12px rgba(0,0,0,0.3)',letterSpacing:0.3}}>{children}</button>
  );
}

export default function Belota(){
  return <EB><App/></EB>;
}
