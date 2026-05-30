import { useState, useEffect, useRef, Component } from "react";

// ── Error boundary ────────────────────────────────────────────────────────────
class EB extends Component {
  constructor(p){super(p);this.state={e:null};}
  static getDerivedStateFromError(e){return{e};}
  render(){
    if(this.state.e)return(
      <div style={{background:'#111',color:'white',padding:20,minHeight:'100dvh',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
        <div style={{fontSize:16,color:'#e74c3c',fontWeight:'bold'}}>Erreur : {this.state.e.message}</div>
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
// Couleurs alternées : noir-rouge-noir-rouge
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
const AI=1200,TP2=2500,BD=800;
const PW=90,PH=130; // taille cartes du pli

// ── Tri main ──────────────────────────────────────────────────────────────────
function sortH(hand,trump){
  const safe=(hand||[]).filter(c=>c&&c.s&&c.r);
  if(!safe.length)return[];
  const ord=trump?[trump,...SORD.filter(s=>s!==trump)]:[...SORD];
  const str=c=>(c.s===trump?TST:PST)[c.r]||0;
  return[...safe].sort((a,b)=>{
    const d=ord.indexOf(a.s)-ord.indexOf(b.s);
    return d!==0?d:str(b)-str(a);
  });
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
  for(let k=0;k<4;k++){
    const n=p===taker?2:3;
    for(let j=0;j<n;j++){const c=rest[ri++];if(c)nh[p].push(c);}
    p=nxt(p);
  }
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
  if(!trick.length)return h;
  const lead=trick[0].c.s;
  const tc=h.filter(c=>c.s===trump),lc=h.filter(c=>c.s===lead);
  if(lead===trump){
    if(!tc.length)return h;
    const bt=trick.filter(t=>t.c.s===trump).reduce((b,t)=>TS[t.c.r]>TS[b.c.r]?t:b);
    const hi=tc.filter(c=>TS[c.r]>TS[bt.c.r]);return hi.length?hi:tc;
  }
  if(lc.length)return lc;if(!tc.length)return h;
  const w=tWin(trick,trump);
  if(w===(player+2)%4)return h;
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
  const mv=legal(hand,trick,trump,player);
  if(!mv.length)return hand[0];
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
    br:1,bi:fp,bc:0,taker:null,tteam:null,
    trick:[],done:[],cur:fp,scores:sc,ann:'',
    bB:[0,0],bH:null,bP:[0,0,0,0],result:null,lw:null,pw:null};
}
function play(G,player,card){
  const nh=G.hands.map((h,i)=>i===player?h.filter(c=>c&&c.id&&c.id!==card.id):h.filter(c=>c&&c.id));
  const nt=[...G.trick,{p:player,c:card}];
  let ann='',bb=[...G.bB],bp=[...G.bP];
  if(G.bH&&G.bH[player]&&card.s===G.trump&&(card.r==='K'||card.r==='Q')){
    bp=[...bp];bp[player]++;
    if(bp[player]===1)ann='Belote !';
    if(bp[player]===2){ann='Rebelote !';bb=[...bb];bb[team(player)]+=20;}
  }
  if(nt.length<4)return{...G,hands:nh,trick:nt,cur:nxt(player),ann,bB:bb,bP:bp};
  const win=tWin(nt,G.trump);
  return{...G,hands:nh,trick:nt,phase:'PAUSE',pw:win,ann,bB:bb,bP:bp};
}
function resolve(G){
  const win=G.pw;
  const nd=[...G.done,{winner:win,cards:G.trick.map(t=>t.c)}];
  const base={...G,trick:[],done:nd,phase:'PLAY',pw:null,lw:win,ann:''};
  return nd.length===8?calcR(base):{...base,cur:win};
}
function calcR(G){
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  let pts=[0,0];
  if(t0===8)pts=[250,0];else if(t0===0)pts=[0,250];
  else for(let i=0;i<8;i++){const d=G.done[i],tm=team(d.winner);pts[tm]+=d.cards.reduce((s,c)=>s+cp(c,G.trump),0);if(i===7)pts[tm]+=10;}
  const tt=G.tteam,ot=1-tt;
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
function Crd({card,fd,ok,W=54,H=76,onClick}){
  if(fd||!card||!card.s)return(
    <div style={{width:W,height:H,borderRadius:5,background:'#1a3580',
      border:'2px solid #2244aa',flexShrink:0,
      backgroundImage:'repeating-linear-gradient(45deg,#1a3580,#1a3580 4px,#243fa0 4px,#243fa0 8px)'}}/>
  );
  const tc=RED(card.s)?'#c0392b':'#111',fs=W<48?8:10,ms=W<48?14:20;
  return(
    <div onClick={ok?onClick:undefined} style={{
      width:W,height:H,borderRadius:5,flexShrink:0,position:'relative',
      overflow:'hidden',background:'white',
      border:ok?'3px solid #2ecc71':'2px solid #ccc',
      boxShadow:ok?'0 0 18px rgba(46,204,113,.9)':'0 3px 10px rgba(0,0,0,.5)',
      cursor:ok?'pointer':'default',
      opacity:(ok===false)?0.35:1,
      filter:(ok===false)?'grayscale(55%)':'none',
      transition:'opacity .2s, filter .2s'}}>
      <div style={{position:'absolute',top:2,left:3,fontSize:fs,fontWeight:700,color:tc,lineHeight:1.1}}>
        {DIS[card.r]}<br/>{card.s}
      </div>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',
        justifyContent:'center',fontSize:ms,color:tc}}>{card.s}</div>
      <div style={{position:'absolute',bottom:2,right:3,fontSize:fs,fontWeight:700,
        color:tc,lineHeight:1.1,transform:'rotate(180deg)'}}>
        {DIS[card.r]}<br/>{card.s}
      </div>
    </div>
  );
}

// ── Éventail ──────────────────────────────────────────────────────────────────
function Fan({hand,okIds,onPlay,trump,cw=60,ch=86,pv=260,showGray=true}){
  const ids=okIds||new Set();
  const sorted=sortH(hand,trump);
  const n=sorted.length;if(!n)return<div style={{height:ch+10}}/>;
  const spread=n<=1?0:Math.min(n*5,38);
  const step=n>1?spread/(n-1):0,start=-spread/2;
  const fh=Math.min(ch+140,ch+Math.round((1-Math.cos(spread/2*Math.PI/180))*(pv+ch))+10);
  return(
    <div style={{position:'relative',height:Math.max(fh,ch+10),width:'100%',pointerEvents:'none'}}>
      {sorted.map((card,i)=>{
        const a=start+i*step,ok=ids.has(card.id);
        return(
          <div key={card.id} onClick={ok?()=>onPlay(card):undefined}
            style={{position:'absolute',bottom:0,left:`calc(50% - ${cw/2}px)`,
              width:cw,height:ch,transformOrigin:`50% ${ch+pv}px`,
              transform:`rotate(${a}deg) translateY(${ok?-14:0}px)`,
              zIndex:ok?i+20:i,transition:'transform .12s',
              cursor:ok?'pointer':'default',pointerEvents:'auto'}}>
            <Crd card={card} ok={showGray?ok:null} W={cw} H={ch} onClick={()=>onPlay(card)}/>
          </div>
        );
      })}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
function App(){
  const[G,setG]=useState(()=>init());
  const timer=useRef(null);
  const[ls,setLs]=useState(()=>typeof window!=='undefined'&&window.innerWidth>window.innerHeight);
  useEffect(()=>{const u=()=>setLs(window.innerWidth>window.innerHeight);window.addEventListener('resize',u);return()=>window.removeEventListener('resize',u);},[]);

  // Pause pli
  useEffect(()=>{
    if(G.phase!=='PAUSE')return;
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>setG(p=>p.phase==='PAUSE'?resolve(p):p),TP2);
    return()=>{if(timer.current)clearTimeout(timer.current);};
  },[G.phase,G.pw]);

  // IA enchères
  useEffect(()=>{
    if(G.phase!=='BID'||G.bi===0)return;
    const t=setTimeout(()=>{
      setG(prev=>{
        if(prev.phase!=='BID'||prev.bi===0)return prev;
        const p=prev.bi,hand=prev.hands[p].filter(c=>c&&c.id);
        const take=suit=>({...prev,phase:'PLAY',trump:suit,taker:p,tteam:team(p),
          cur:prev.fp,
          hands:complete(prev.hands,prev.flip,prev.rest,p),
          bH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))});
        if(prev.br===1){if(aiTake(hand,prev.flip.s,1))return take(prev.flip.s);}
        else{const s=aiSuit(hand,prev.flip.s);if(s&&aiTake(hand,s,2))return take(s);}
        const nc=prev.bc+1;
        if(nc>=4){
          if(prev.br===1)return{...prev,br:2,bi:prev.fp,bc:0};
          const nd=deal(prev.fp);return{...prev,...nd,br:1,bi:prev.fp,bc:0,trump:null};
        }
        return{...prev,bi:nxt(prev.bi),bc:nc};
      });
    },BD);
    return()=>clearTimeout(t);
  },[G.phase,G.bi,G.br]);

  // IA jeu
  useEffect(()=>{
    if(G.phase!=='PLAY'||G.cur===0)return;
    const t=setTimeout(()=>{
      setG(prev=>{
        if(prev.phase!=='PLAY'||prev.cur===0)return prev;
        const p=prev.cur,hand=prev.hands[p].filter(c=>c&&c.id);
        return play(prev,p,aiCard(hand,prev.trick,prev.trump,p));
      });
    },AI);
    return()=>clearTimeout(t);
  },[G.phase,G.cur,G.trick.length]);

  function bid(suit){
    if(suit!==null){
      setG(prev=>({...prev,phase:'PLAY',trump:suit,taker:0,tteam:0,cur:prev.fp,
        hands:complete(prev.hands,prev.flip,prev.rest,0),
        bH:prev.hands.map(h=>h.some(c=>c&&c.s===suit&&c.r==='K')&&h.some(c=>c&&c.s===suit&&c.r==='Q'))}));
      return;
    }
    setG(prev=>{
      const nc=prev.bc+1;
      if(nc>=4){
        if(prev.br===1)return{...prev,br:2,bi:prev.fp,bc:0};
        const nd=deal(prev.fp);return{...prev,...nd,br:1,bi:prev.fp,bc:0,trump:null};
      }
      return{...prev,bi:nxt(prev.bi),bc:nc};
    });
  }
  function playCard(card){
    if((G.phase!=='PLAY'&&G.phase!=='PAUSE')||G.cur!==0)return;
    if(G.phase==='PAUSE')return;
    const hand=G.hands[0].filter(c=>c&&c.id);
    if(!legal(hand,G.trick,G.trump,0).some(c=>c.id===card.id))return;
    setG(prev=>play(prev,0,card));
  }

  // Portrait
  if(!ls)return(
    <div style={{height:'100dvh',background:'#1a5020',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',color:'white',fontFamily:'Georgia,serif',
      textAlign:'center',gap:16}}>
      <div style={{fontSize:48}}>📱</div>
      <div style={{fontSize:20,fontWeight:'bold'}}>Retourne ton iPhone</div>
      <div style={{fontSize:14,opacity:.7}}>BELOTA se joue en paysage</div>
    </div>
  );

  const TABLE={
    position:'fixed',
    top:0,left:0,right:0,bottom:0,
    // Plein écran iPhone — couvre les bandes blanches
    margin:0,padding:0,
    WebkitOverflowScrolling:'touch',
    background:`radial-gradient(circle at 50% 40%,
      #2f7d3a 0%, #1f5d2b 45%, #143b1c 75%, #0b2411 100%)`,
    fontFamily:'Georgia,serif',color:'white',overflow:'hidden',userSelect:'none',
  };
  const hand0=(G.hands[0]||[]).filter(c=>c&&c.id);
  const isDone=G.phase==='PAUSE';
  const trickMap=Object.fromEntries((G.trick||[]).filter(t=>t&&t.c).map(t=>[t.p,t.c]));
  let okIds=new Set();
  if(G.phase==='PLAY'&&G.cur===0&&G.trump){
    try{okIds=new Set(legal(hand0,G.trick,G.trump,0).map(c=>c.id));}catch(e){}
  }
  const t0=G.done.filter(d=>team(d.winner)===0).length;
  const t1=G.done.filter(d=>team(d.winner)===1).length;
  const ac=G.trump&&RED(G.trump)?'#ffcdd2':'white';

  // ── FIN DE MANCHE ───────────────────────────────────────────────────────────
  if(G.phase==='OVER'||G.phase==='END'){
    const r=G.result,nd=nxt(G.dealer);
    return(
      <div style={{...TABLE,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'rgba(0,0,0,.75)',borderRadius:16,padding:24,
          maxWidth:460,width:'90%',textAlign:'center',border:'1px solid rgba(255,255,255,.2)'}}>
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
            ?<><div style={{fontSize:15,marginBottom:14}}>{G.scores[0]>=1000?'🎉 Vous gagnez !':'😔 Les adversaires gagnent.'}</div>
              <Btn bg="#388e3c" onClick={()=>setG(init())}>Nouvelle partie</Btn></>
            :<Btn bg="#1976d2" onClick={()=>setG(init(G.scores,nd))}>Manche suivante → Don: {PN[nd]}</Btn>}
        </div>
      </div>
    );
  }

  // ── ENCHÈRES ────────────────────────────────────────────────────────────────
  if(G.phase==='BID'){
    const myTurn=G.bi===0;
    // Qui parle en ce moment
    const speaker=PN[G.bi];
    return(
      <div style={TABLE}>
        {/* Barre top */}
        <div style={{position:'absolute',top:0,left:0,right:0,
          background:'rgba(0,0,0,.5)',padding:'6px 16px',
          display:'flex',justifyContent:'space-between',alignItems:'center',zIndex:10}}>
          <div style={{fontWeight:'bold',fontSize:13}}>🃏 BELOTA</div>
          <div style={{fontSize:12}}>
            <span style={{color:'#4caf50',fontWeight:'bold'}}>{G.scores[0]}</span>
            <span style={{opacity:.4}}> — </span>
            <span style={{color:'#ef5350',fontWeight:'bold'}}>{G.scores[1]}</span>
          </div>
          <div style={{fontSize:11,opacity:.7}}>Donneur : {PN[G.dealer]}</div>
        </div>

        {/* IA qui réfléchit */}
        {!myTurn&&(
          <div style={{position:'absolute',top:40,left:'50%',transform:'translateX(-50%)',
            zIndex:10,background:'rgba(0,0,0,.5)',borderRadius:20,
            padding:'3px 12px',fontSize:11,opacity:.8}}>
            ⏳ {speaker} réfléchit…
          </div>
        )}

        {/* Joueurs */}
        <PLabel name="Nord" n={(G.hands[2]||[]).length} pos={{top:'8%',left:'50%',transform:'translateX(-50%)'}} active={G.bi===2} dealer={G.dealer===2}/>
        <PLabel name="Ouest" n={(G.hands[1]||[]).length} pos={{top:'50%',left:'13%',transform:'translateY(-50%)'}} active={G.bi===1} dealer={G.dealer===1}/>
        <PLabel name="Est" n={(G.hands[3]||[]).length} pos={{top:'50%',right:'13%',transform:'translateY(-50%)'}} active={G.bi===3} dealer={G.dealer===3}/>

        {/* Carte retournée — grande, centrée */}
        <div style={{position:'absolute',top:'50%',left:'50%',
          transform:'translate(-50%,-68%)',zIndex:5,textAlign:'center'}}>
          <Crd card={G.flip} W={90} H={128}/>
        </div>

        {/* Boutons enchères — petits, discrets, bas gauche */}
        {myTurn&&(
          <div style={{position:'absolute',bottom:'30%',left:'50%',
            transform:'translateX(-50%)',zIndex:20,
            display:'flex',gap:8,alignItems:'center'}}>
            {G.br===1?(
              // Simple : juste le symbole de l'atout + Passer
              <>
                <button onClick={()=>bid(G.flip.s)} style={{
                  background:'rgba(30,70,30,.95)',color:'white',
                  border:'2px solid #66bb6a',borderRadius:28,
                  padding:'10px 22px',fontSize:16,cursor:'pointer',fontWeight:'bold',
                  boxShadow:'0 4px 12px rgba(0,0,0,.4)',
                  display:'flex',alignItems:'center',gap:8,
                }}>
                  <span style={{fontSize:22,lineHeight:1}}>{G.flip.s}</span>
                  <span>Prendre</span>
                </button>
                <button onClick={()=>bid(null)} style={{
                  background:'rgba(0,0,0,.6)',color:'white',
                  border:'1px solid rgba(255,255,255,.3)',borderRadius:28,
                  padding:'10px 22px',fontSize:14,cursor:'pointer',
                  boxShadow:'0 4px 12px rgba(0,0,0,.4)',
                }}>
                  Passer
                </button>
              </>
            ):(
              // Tour 2 : boutons pour chaque couleur
              <>
                {SUITS.filter(s=>s!==G.flip?.s).map(s=>(
                  <button key={s} onClick={()=>bid(s)} style={{
                    background:RED(s)?'rgba(120,20,20,.9)':'rgba(20,40,80,.9)',
                    color:'white',border:'2px solid rgba(255,255,255,.4)',
                    borderRadius:28,padding:'10px 18px',fontSize:18,cursor:'pointer',
                    boxShadow:'0 4px 12px rgba(0,0,0,.4)',
                  }}>{s}</button>
                ))}
                <button onClick={()=>bid(null)} style={{
                  background:'rgba(0,0,0,.6)',color:'white',
                  border:'1px solid rgba(255,255,255,.3)',borderRadius:28,
                  padding:'10px 20px',fontSize:14,cursor:'pointer',
                }}>
                  Passer
                </button>
              </>
            )}
          </div>
        )}

        {/* Main éventail */}
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:6}}>
          <Fan hand={hand0} trump={null} showGray={false}/>
        </div>
      </div>
    );
  }

  // ── JEU ──────────────────────────────────────────────────────────────────────
  const curName=PN[G.cur];
  const myTurn=G.phase==='PLAY'&&G.cur===0;
  const pliN=G.done.length+1;

  return(
    <div style={TABLE}>
      <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 28px rgba(102,187,106,.7); }
          50% { box-shadow: 0 0 42px rgba(102,187,106,1), 0 0 60px rgba(102,187,106,.4); }
        }
      `}</style>

      {/* ── BARRE TOP ── */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:10,
        background:'rgba(0,0,0,.55)',
        display:'flex',justifyContent:'space-between',alignItems:'center',
        padding:'5px 14px'}}>
        <div style={{fontSize:11}}>
          <span style={{color:ac,fontWeight:'bold'}}>{G.trump} {G.trump?SFR[G.trump]:''}</span>
          <span style={{opacity:.5,fontSize:9}}> {G.tteam===0?'(V+N)':'(Adv.)'}</span>
        </div>
        <div style={{fontSize:12,color:isDone?'#ffd54f':'#fff',fontWeight:'bold'}}>
          {G.ann||`Pli ${pliN}/8`}
        </div>
        <div style={{fontSize:11}}>
          <span style={{color:'#4caf50',fontWeight:'bold'}}>{G.scores[0]}</span>
          <span style={{opacity:.4}}> — </span>
          <span style={{color:'#ef5350',fontWeight:'bold'}}>{G.scores[1]}</span>
          <span style={{opacity:.35,fontSize:9}}> {t0}-{t1}</span>
        </div>
      </div>

      {/* ── BANDEAU TOUR (très visible) ── */}
      <div style={{position:'absolute',top:32,left:'50%',transform:'translateX(-50%)',
        zIndex:10,textAlign:'center',whiteSpace:'nowrap'}}>
        {isDone?(
          <div style={{background:'rgba(255,193,7,.25)',border:'2px solid #ffd54f',
            borderRadius:24,padding:'6px 20px',fontSize:13,color:'#ffd54f',fontWeight:'bold',
            boxShadow:'0 0 16px rgba(255,193,7,.4)'}}>
            ⏳ {PN[G.pw]} remporte ce pli…
          </div>
        ):myTurn?(
          <div style={{
            background:'rgba(27,94,32,.97)',
            border:'2.5px solid #66bb6a',
            borderRadius:24,padding:'7px 24px',fontSize:15,fontWeight:'bold',
            boxShadow:'0 0 28px rgba(102,187,106,.7)',
            letterSpacing:'.5px',
            animation:'pulse 1.2s ease-in-out infinite',
          }}>
            🎯 À VOUS DE JOUER
          </div>
        ):(
          <div style={{background:'rgba(0,0,0,.6)',borderRadius:24,padding:'5px 18px',
            fontSize:12,opacity:.9,border:'1px solid rgba(255,255,255,.15)'}}>
            ▶ {curName} joue…
          </div>
        )}
      </div>

      {/* ── JOUEURS AUX 4 POSITIONS ── */}
      <PLabel name="Nord" n={(G.hands[2]||[]).filter(c=>c&&c.id).length}
        pos={{top:'8%',left:'50%',transform:'translateX(-50%)'}}
        active={G.cur===2&&!isDone} dealer={G.dealer===2} team0={true}/>
      <PLabel name="Ouest" n={(G.hands[1]||[]).filter(c=>c&&c.id).length}
        pos={{top:'48%',left:'12%',transform:'translateY(-50%)'}}
        active={G.cur===1&&!isDone} dealer={G.dealer===1} team0={false}/>
      <PLabel name="Est" n={(G.hands[3]||[]).filter(c=>c&&c.id).length}
        pos={{top:'48%',right:'12%',transform:'translateY(-50%)'}}
        active={G.cur===3&&!isDone} dealer={G.dealer===3} team0={false}/>

      {/* ── ZONE PLI (grille 3×3 CSS) ── */}
      <div style={{
        position:'absolute',top:'10%',left:'50%',transform:'translateX(-50%)',
        zIndex:50,
        padding:10,
        display:'grid',
        gridTemplateColumns:`${PW}px 70px ${PW}px`,
        gridTemplateRows:`${PH}px 35px ${PH}px`,
        gap:'10px',
        alignItems:'center',justifyItems:'center',
      }}>
        {/* Rang 1: vide | Nord | vide */}
        <div/><TSlot card={trickMap[2]}/><div/>
        {/* Rang 2: Ouest | info | Est */}
        <TSlot card={trickMap[1]}/>
        <div style={{textAlign:'center',fontSize:9,lineHeight:1.2}}>
          {isDone&&G.pw!==null?<span style={{color:'#ffd54f',fontWeight:'bold',
            background:'rgba(0,0,0,.7)',borderRadius:4,padding:'1px 4px'}}>
            {PN[G.pw]}✓</span>
          :G.lw!==null&&!G.trick.length?<span style={{opacity:.3}}>{PN[G.lw]}</span>
          :null}
        </div>
        <TSlot card={trickMap[3]}/>
        {/* Rang 3: vide | Vous | vide */}
        <div/><TSlot card={trickMap[0]}/><div/>
      </div>



      {/* ── MAIN JOUEUR + LABEL ── */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:8}}>

        <Fan hand={hand0} okIds={okIds} onPlay={playCard} trump={G.trump} cw={78} ch={112} pv={220}/>
      </div>

    </div>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────

// Label joueur sur le tapis
function PLabel({name,n,pos,active,dealer,team0}){
  return(
    <div style={{position:'absolute',...pos,zIndex:10,textAlign:'center'}}>
      {active&&<div style={{fontSize:9,color:'#ffd54f',fontWeight:'bold',marginBottom:2}}>▼ AU TOUR DE</div>}
      <div style={{fontSize:active?13:11,fontWeight:active?'bold':'normal',
        color:active?'#ffd54f':'rgba(255,255,255,.8)',
        textShadow:'0 1px 4px rgba(0,0,0,.9)',marginBottom:3}}>
        {name}{dealer?' 🔴':''}
      </div>
      <div style={{background:active?'rgba(46,125,50,.8)':'rgba(0,0,0,.5)',
        borderRadius:20,padding:'2px 10px',fontSize:11,display:'inline-block',
        border:`1px solid ${team0?'rgba(76,175,80,.4)':'rgba(239,83,80,.4)'}`,
        transition:'all .2s'}}>
        {n}🂠
      </div>
    </div>
  );
}

// Carte dans le pli (avec emplacement vide)
function TSlot({card}){
  // Rien quand vide — pas de cases grises
  if(!card||!card.s)return <div style={{width:PW,height:PH}}/>;
  return <Crd card={card} W={PW} H={PH}/>;
}

function Btn({children,onClick,bg}){
  return(
    <button onClick={onClick} style={{
      background:bg,color:'white',border:'none',borderRadius:22,
      padding:'9px 18px',fontSize:13,cursor:'pointer',fontWeight:'bold',
      boxShadow:'0 3px 8px rgba(0,0,0,.4)',whiteSpace:'nowrap'}}>
      {children}
    </button>
  );
}

export default function Belota(){
  return <EB><App/></EB>;
}
