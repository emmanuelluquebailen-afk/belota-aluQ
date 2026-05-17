// BELOTA — Jeu de belote solo vs 3 IA
// Équipes : Vous (Sud) + Nord vs Ouest + Est
// Sens horaire : S(0) → O(1) → N(2) → E(3)
// Distribution : 3 puis 2 cartes, retourne la suivante
// Main joueur : éventail (demi-cercle)

import { useState, useEffect, useCallback } from "react";

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const SUITS    = ['♠','♥','♦','♣'];
const RED_S    = s => s === '♥' || s === '♦';
const SUIT_FR  = { '♠':'Pique', '♥':'Cœur', '♦':'Carreau', '♣':'Trèfle' };
const RANKS    = ['7','8','9','10','J','Q','K','A'];
const DISP     = { '7':'7','8':'8','9':'9','10':'10','J':'V','Q':'D','K':'R','A':'A' };
const PNAME    = ['Vous','Ouest','Nord','Est'];

const TS = { J:7, '9':6, A:5, '10':4, K:3, Q:2, '8':1, '7':0 }; // atout force
const NS = { A:7, '10':6, K:5, Q:4, J:3, '9':2, '8':1, '7':0 }; // normale force
const TP = { J:20, '9':14, A:11, '10':10, K:4, Q:3, '8':0, '7':0 }; // atout points
const NP = { A:11, '10':10, K:4, Q:3, J:2, '9':0, '8':0, '7':0 }; // normale points

const teamOf = p => (p === 0 || p === 2) ? 0 : 1;
const cStr   = (c, t) => c.s === t ? TS[c.r] : NS[c.r];
const cPts   = (c, t) => c.s === t ? TP[c.r] : NP[c.r];
const CW     = p => (p + 1) % 4; // sens horaire : S(0)→O(1)→N(2)→E(3)

// ─── DECK ────────────────────────────────────────────────────────────────────

function mkDeck() {
  return SUITS.flatMap(s => RANKS.map(r => ({ s, r, id: `${r}${s}` })));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortHand(hand, trump) {
  const order = trump ? [trump, ...SUITS.filter(s => s !== trump)] : SUITS;
  return [...hand].sort((a, b) => {
    const sd = order.indexOf(a.s) - order.indexOf(b.s);
    return sd || cStr(b, trump || 'X') - cStr(a, trump || 'X');
  });
}

// Distribution : 3 puis 2 cartes (S→O→N→E), retourne la suivante du talon
function dealInitial() {
  const d = shuffle(mkDeck());
  const hands = [[], [], [], []];
  let idx = 0;
  for (const p of [0, 1, 2, 3]) for (let i = 0; i < 3; i++) hands[p].push(d[idx++]);
  for (const p of [0, 1, 2, 3]) for (let i = 0; i < 2; i++) hands[p].push(d[idx++]);
  const flipCard = d[idx++];
  const rest = d.slice(idx); // 11 cartes
  return { hands, flipCard, rest };
}

// Complète les mains à 8 après la prise
// Preneur : carte retournée + 2 du talon  |  Autres : 3 chacun
function completeHands(hands, flipCard, rest, taker) {
  const nh = hands.map(h => [...h]);
  nh[taker].push(flipCard);
  let idx = 0, p = taker;
  for (let i = 0; i < 4; i++) {
    const n = p === taker ? 2 : 3;
    for (let j = 0; j < n; j++) nh[p].push(rest[idx++]);
    p = CW(p);
  }
  return nh;
}

// ─── RÈGLES ──────────────────────────────────────────────────────────────────

function trickWinner(trick, trump) {
  const lead = trick[0].c.s;
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const [b, c] = [best.c, t.c];
    if (c.s === trump && b.s !== trump)                       { best = t; continue; }
    if (c.s === trump && b.s === trump && TS[c.r] > TS[b.r]) { best = t; continue; }
    if (c.s === lead  && b.s !== trump && NS[c.r] > NS[b.r]) { best = t; }
  }
  return best.p;
}

function legalMoves(hand, trick, trump, player) {
  if (!trick.length) return hand;
  const lead = trick[0].c.s;
  const tc   = hand.filter(c => c.s === trump);
  const lc   = hand.filter(c => c.s === lead);

  if (lead === trump) {
    if (!tc.length) return hand;
    const bt = trick.filter(t => t.c.s === trump).reduce((b, t) => TS[t.c.r] > TS[b.c.r] ? t : b);
    const hi = tc.filter(c => TS[c.r] > TS[bt.c.r]);
    return hi.length ? hi : tc;
  }

  if (lc.length) return lc;
  if (!tc.length) return hand;

  const win = trickWinner(trick, trump);
  if (win === (player + 2) % 4) return hand; // partenaire gagne → libre

  const pt = trick.filter(t => t.c.s === trump);
  if (pt.length) {
    const bt = pt.reduce((b, t) => TS[t.c.r] > TS[b.c.r] ? t : b);
    const hi = tc.filter(c => TS[c.r] > TS[bt.c.r]);
    if (hi.length) return hi;
  }
  return tc;
}

// ─── IA ──────────────────────────────────────────────────────────────────────

function aiShouldTake(hand, suit, round) {
  const tc   = hand.filter(c => c.s === suit);
  const hasJ = tc.some(c => c.r === 'J');
  const has9 = tc.some(c => c.r === '9');
  return round === 1
    ? (hasJ || (tc.length >= 3 && has9) || tc.length >= 4)
    : (hasJ || tc.length >= 3);
}

function aiPickSuit(hand, excluded) {
  let best = null, bestVal = -1;
  for (const s of SUITS) {
    if (s === excluded) continue;
    const val = hand.filter(c => c.s === s).reduce((a, c) => a + TS[c.r], 0)
              + hand.filter(c => c.s === s).length * 2;
    if (val > bestVal) { bestVal = val; best = s; }
  }
  return best;
}

function aiPickCard(hand, trick, trump, player) {
  const moves   = legalMoves(hand, trick, trump, player);
  const partner = (player + 2) % 4;

  if (!trick.length) {
    const jT = moves.find(c => c.s === trump && c.r === 'J');
    if (jT) return jT;
    const nt = moves.filter(c => c.s !== trump);
    if (nt.length) return nt.reduce((b, c) => cStr(c, trump) > cStr(b, trump) ? c : b);
    return moves.reduce((b, c) => cStr(c, trump) < cStr(b, trump) ? c : b);
  }

  const win = trickWinner(trick, trump);
  if (win === partner)
    return moves.reduce((b, c) => cStr(c, trump) < cStr(b, trump) ? c : b);
  return moves.reduce((b, c) => cStr(c, trump) > cStr(b, trump) ? c : b);
}

// ─── ÉTAT ────────────────────────────────────────────────────────────────────

function initRound(scores = [0, 0]) {
  const { hands, flipCard, rest } = dealInitial();
  return {
    phase:       'BIDDING',  // BIDDING | PLAYING | ROUND_END | GAME_OVER
    hands,                   // 4 mains (5 cartes pendant enchères, 8 en jeu)
    flipCard,
    rest,
    trump:       null,
    bidRound:    1,          // 1 = couleur imposée, 2 = couleur libre
    bidIdx:      0,          // joueur dont c'est le tour d'enchérir
    bidCount:    0,          // nombre de passes dans ce tour
    taker:       null,
    takerTeam:   null,
    trick:       [],         // pli en cours [{p, c}]
    done:        [],         // plis terminés [{winner, cards}]
    curPlayer:   0,
    scores,
    announce:    '',         // 'Belote !' | 'Rebelote !'
    belB:        [0, 0],     // bonus Belote/Rebelote par équipe
    belH:        null,       // qui a R+D d'atout (boolean[4])
    belP:        [0, 0, 0, 0],
    roundResult: null,
    ltWin:       null,       // gagnant du dernier pli
  };
}

function applyPlayCard(G, player, card) {
  const newHands = G.hands.map((h, i) => i === player ? h.filter(c => c.id !== card.id) : h);
  const newTrick = [...G.trick, { p: player, c: card }];

  // Belote / Rebelote
  let ann = '', bb = [...G.belB], bp = [...G.belP];
  if (G.belH?.[player] && card.s === G.trump && (card.r === 'K' || card.r === 'Q')) {
    bp = [...bp]; bp[player]++;
    if (bp[player] === 1) ann = 'Belote !';
    if (bp[player] === 2) { ann = 'Rebelote !'; bb = [...bb]; bb[teamOf(player)] += 20; }
  }

  if (newTrick.length < 4) {
    return { ...G, hands: newHands, trick: newTrick, curPlayer: CW(player), announce: ann, belB: bb, belP: bp };
  }

  const win     = trickWinner(newTrick, G.trump);
  const newDone = [...G.done, { winner: win, cards: newTrick.map(t => t.c) }];

  if (newDone.length === 8) {
    return computeResult({ ...G, hands: newHands, trick: [], done: newDone, announce: ann, belB: bb, belP: bp, ltWin: win });
  }
  return { ...G, hands: newHands, trick: [], done: newDone, curPlayer: win, announce: ann, belB: bb, belP: bp, ltWin: win };
}

function computeResult(G) {
  const t0 = G.done.filter(d => teamOf(d.winner) === 0).length;
  let pts = [0, 0];
  if      (t0 === 8) pts = [250, 0];
  else if (t0 === 0) pts = [0, 250];
  else {
    for (let i = 0; i < 8; i++) {
      const d = G.done[i], tm = teamOf(d.winner);
      pts[tm] += d.cards.reduce((s, c) => s + cPts(c, G.trump), 0);
      if (i === 7) pts[tm] += 10; // dix de der
    }
  }

  const tt = G.takerTeam, ot = 1 - tt;
  let rp = [0, 0], res;
  if      (pts[tt] > pts[ot])  { res = 'success'; rp = [...pts]; }
  else if (pts[tt] === pts[ot]){ res = 'litige';  rp = tt === 0 ? [0, 162] : [162, 0]; }
  else                         { res = 'chute';   rp = tt === 0 ? [0, 162] : [162, 0]; }

  rp = [rp[0] + G.belB[0], rp[1] + G.belB[1]];
  const ns = [G.scores[0] + rp[0], G.scores[1] + rp[1]];
  const go = ns[0] >= 1000 || ns[1] >= 1000;

  const tn = tt === 0 ? 'Vous avez' : 'Les adversaires ont';
  let msg;
  if      (res === 'success') msg = `${tn} réussi votre prise ! (${pts[tt]}-${pts[ot]})`;
  else if (res === 'litige')  msg = `Litige à ${pts[0]}-${pts[1]}. Défenseurs prennent 162.`;
  else                        msg = tt === 0 ? `Chute ! Les adversaires gagnent 162.` : `Adversaires chutés ! Vous gagnez 162.`;

  return { ...G, phase: go ? 'GAME_OVER' : 'ROUND_END', scores: ns, roundResult: { pts, rp, res, msg }, announce: '' };
}

// ─── COMPOSANT CARTE ─────────────────────────────────────────────────────────

function Card({ card, faceDown = false, isLegal = false, small = false, onClick }) {
  const W = small ? 42 : 62, H = small ? 60 : 88;

  if (faceDown || !card) {
    return (
      <div style={{
        width: W, height: H, borderRadius: 6, flexShrink: 0,
        background: '#1a3580', border: '2px solid #2244aa',
        backgroundImage: 'repeating-linear-gradient(45deg,#1a3580,#1a3580 4px,#243fa0 4px,#243fa0 8px)',
        boxShadow: '0 2px 5px rgba(0,0,0,.4)',
      }} />
    );
  }

  const tc = RED_S(card.s) ? '#c0392b' : '#1a1a2e';
  const fs = small ? 9 : 11;

  return (
    <div
      onClick={isLegal ? onClick : undefined}
      style={{
        width: W, height: H, borderRadius: 6, flexShrink: 0,
        position: 'relative', overflow: 'hidden',
        background: 'white',
        border: `2px solid ${isLegal ? '#27ae60' : '#ccc'}`,
        boxShadow: isLegal ? '0 0 12px rgba(39,174,96,.65)' : '0 2px 5px rgba(0,0,0,.3)',
        cursor: isLegal ? 'pointer' : 'default',
      }}
    >
      <div style={{ position:'absolute', top:2, left:3, fontSize:fs, fontWeight:700, color:tc, lineHeight:1.15 }}>
        {DISP[card.r]}<br/>{card.s}
      </div>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize: small ? 18 : 24, color:tc }}>
        {card.s}
      </div>
      <div style={{ position:'absolute', bottom:2, right:3, fontSize:fs, fontWeight:700, color:tc, lineHeight:1.15, transform:'rotate(180deg)' }}>
        {DISP[card.r]}<br/>{card.s}
      </div>
    </div>
  );
}

// ─── ÉVENTAIL ────────────────────────────────────────────────────────────────
// Toutes les cartes partagent le même point de pivot PIVOT px sous leur bord bas.
// La rotation crée un demi-cercle naturel, comme une main tenue.
// Les cartes jouables se soulèvent (translateY dans le repère local = sortie radiale).

const FAN_CW   = 62;   // largeur carte
const FAN_CH   = 88;   // hauteur carte
const FAN_PIVOT= 400;  // distance du pivot sous le bas de la carte (px)

function FanHand({ hand, legalIDs = new Set(), onPlay, trump }) {
  const sorted = sortHand(hand, trump);
  const n      = sorted.length;
  if (!n) return <div style={{ height: 110 }} />;

  const spread = n <= 1 ? 0 : Math.min(n * 6, 48); // amplitude totale °
  const step   = n > 1 ? spread / (n - 1) : 0;
  const start  = -spread / 2;

  // hauteur du conteneur : carte + déplacement vertical des extrémités
  const containerH = FAN_CH
    + Math.round((1 - Math.cos(spread / 2 * Math.PI / 180)) * (FAN_PIVOT + FAN_CH))
    + 18;

  return (
    <div style={{ position:'relative', height: Math.max(containerH, 110), width:'100%', maxWidth:540 }}>
      {sorted.map((card, i) => {
        const angle   = start + i * step;
        const isLegal = legalIDs.has(card.id);
        return (
          <FanCard
            key={card.id}
            card={card}
            angle={angle}
            isLegal={isLegal}
            zIndex={i + 1}
            onClick={() => isLegal && onPlay(card)}
          />
        );
      })}
    </div>
  );
}

function FanCard({ card, angle, isLegal, zIndex, onClick }) {
  const [hovered, setHovered] = useState(false);
  const lift = isLegal ? (hovered ? -18 : -12) : 0;
  return (
    <div
      onClick={isLegal ? onClick : undefined}
      onMouseEnter={() => isLegal && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:        'absolute',
        bottom:          0,
        left:            `calc(50% - ${FAN_CW / 2}px)`,
        width:           FAN_CW,
        height:          FAN_CH,
        transformOrigin: `50% ${FAN_CH + FAN_PIVOT}px`,
        transform:       `rotate(${angle}deg) translateY(${lift}px)`,
        zIndex,
        transition:      'transform .12s',
        cursor:          isLegal ? 'pointer' : 'default',
      }}
    >
      <Card card={card} isLegal={isLegal} />
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────

export default function Belota() {
  const [G, setG] = useState(() => initRound());

  // Helpers d'état partagés
  const applyTake = useCallback((player, suit) => {
    setG(prev => ({
      ...prev,
      phase:     'PLAYING',
      trump:     suit,
      taker:     player,
      takerTeam: teamOf(player),
      hands:     completeHands(prev.hands, prev.flipCard, prev.rest, player),
      belH:      prev.hands.map(h =>
        h.some(c => c.s === suit && c.r === 'K') &&
        h.some(c => c.s === suit && c.r === 'Q')
      ),
    }));
  }, []);

  const passBid = useCallback(() => {
    setG(prev => {
      const newCount = prev.bidCount + 1;
      if (newCount >= 4) {
        if (prev.bidRound === 1) return { ...prev, bidRound:2, bidIdx:0, bidCount:0 };
        const { hands, flipCard, rest } = dealInitial();
        return { ...prev, hands, flipCard, rest, bidRound:1, bidIdx:0, bidCount:0, trump:null };
      }
      return { ...prev, bidIdx: CW(prev.bidIdx), bidCount: newCount };
    });
  }, []);

  // IA — enchères
  useEffect(() => {
    if (G.phase !== 'BIDDING' || G.bidIdx === 0) return;
    const t = setTimeout(() => {
      setG(prev => {
        if (prev.phase !== 'BIDDING' || prev.bidIdx === 0) return prev;
        const p = prev.bidIdx, hand = prev.hands[p];

        if (prev.bidRound === 1) {
          if (aiShouldTake(hand, prev.flipCard.s, 1)) {
            const suit = prev.flipCard.s;
            return { ...prev, phase:'PLAYING', trump:suit, taker:p, takerTeam:teamOf(p),
              hands: completeHands(prev.hands, prev.flipCard, prev.rest, p),
              belH: prev.hands.map(h => h.some(c => c.s===suit&&c.r==='K') && h.some(c => c.s===suit&&c.r==='Q')),
            };
          }
        } else {
          const suit = aiPickSuit(hand, prev.flipCard.s);
          if (suit && aiShouldTake(hand, suit, 2)) {
            return { ...prev, phase:'PLAYING', trump:suit, taker:p, takerTeam:teamOf(p),
              hands: completeHands(prev.hands, prev.flipCard, prev.rest, p),
              belH: prev.hands.map(h => h.some(c => c.s===suit&&c.r==='K') && h.some(c => c.s===suit&&c.r==='Q')),
            };
          }
        }

        // Passe
        const newCount = prev.bidCount + 1;
        if (newCount >= 4) {
          if (prev.bidRound === 1) return { ...prev, bidRound:2, bidIdx:0, bidCount:0 };
          const { hands, flipCard, rest } = dealInitial();
          return { ...prev, hands, flipCard, rest, bidRound:1, bidIdx:0, bidCount:0, trump:null };
        }
        return { ...prev, bidIdx: CW(prev.bidIdx), bidCount: newCount };
      });
    }, 700);
    return () => clearTimeout(t);
  }, [G.phase, G.bidIdx, G.bidRound]);

  // IA — jeu de carte
  useEffect(() => {
    if (G.phase !== 'PLAYING' || G.curPlayer === 0) return;
    const t = setTimeout(() => {
      setG(prev => {
        if (prev.phase !== 'PLAYING' || prev.curPlayer === 0) return prev;
        const p    = prev.curPlayer;
        const card = aiPickCard(prev.hands[p], prev.trick, prev.trump, p);
        return applyPlayCard(prev, p, card);
      });
    }, 680);
    return () => clearTimeout(t);
  }, [G.phase, G.curPlayer, G.trick.length]);

  // Actions humain
  function humanBid(suit) {
    if (suit !== null) { applyTake(0, suit); return; }
    passBid();
  }

  function humanPlay(card) {
    if (G.phase !== 'PLAYING' || G.curPlayer !== 0) return;
    const moves = legalMoves(G.hands[0], G.trick, G.trump, 0);
    if (!moves.some(c => c.id === card.id)) return;
    setG(prev => applyPlayCard(prev, 0, card));
  }

  // ─── STYLES COMMUNS ────────────────────────────────────────────────────────

  const BG = {
    minHeight:'100vh',
    background:'radial-gradient(ellipse at 50% 40%,#1b6b24 0%,#093d10 100%)',
    display:'flex', flexDirection:'column', alignItems:'center',
    padding:'8px', fontFamily:'Georgia,serif', color:'white',
    gap:8, userSelect:'none',
  };

  const Btn = ({ children, onClick, bg }) => (
    <button onClick={onClick} style={{
      background:bg, color:'white', border:'none', borderRadius:8,
      padding:'9px 16px', fontSize:13, cursor:'pointer', fontWeight:'bold',
      boxShadow:'0 2px 4px rgba(0,0,0,.3)',
    }}>
      {children}
    </button>
  );

  // ─── PHASE ENCHÈRES ────────────────────────────────────────────────────────

  if (G.phase === 'BIDDING') {
    const isHuman = G.bidIdx === 0;
    return (
      <div style={BG}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:23, fontWeight:'bold', letterSpacing:1 }}>🃏 BELOTA</div>
          <div style={{ fontSize:12, opacity:.6 }}>Vous {G.scores[0]} – {G.scores[1]} Adversaires</div>
        </div>

        <div style={{ background:'rgba(0,0,0,.38)', borderRadius:12, padding:22, maxWidth:380, width:'100%', textAlign:'center' }}>
          <div style={{ fontSize:12, opacity:.7, marginBottom:8 }}>Carte retournée — atout proposé</div>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
            <Card card={G.flipCard} />
          </div>
          {isHuman ? (
            <>
              <div style={{ fontSize:15, fontWeight:'bold', marginBottom:10 }}>
                {G.bidRound === 1 ? `Prenez-vous à ${SUIT_FR[G.flipCard?.s]} ?` : 'Choisissez votre atout :'}
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                {G.bidRound === 1 ? (
                  <>
                    <Btn onClick={() => humanBid(G.flipCard.s)} bg="#27ae60">Prendre {G.flipCard.s}</Btn>
                    <Btn onClick={() => humanBid(null)} bg="#7f8c8d">Passer</Btn>
                  </>
                ) : (
                  <>
                    {SUITS.filter(s => s !== G.flipCard?.s).map(s => (
                      <Btn key={s} onClick={() => humanBid(s)} bg={RED_S(s) ? '#c0392b' : '#2c3e50'}>
                        {s} {SUIT_FR[s]}
                      </Btn>
                    ))}
                    <Btn onClick={() => humanBid(null)} bg="#7f8c8d">Passer</Btn>
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize:14, opacity:.7, padding:8 }}>{PNAME[G.bidIdx]} réfléchit…</div>
          )}
        </div>

        {/* Main en éventail dès les enchères */}
        <div style={{ textAlign:'center', width:'100%' }}>
          <div style={{ fontSize:12, opacity:.55, marginBottom:4 }}>Votre main ({G.hands[0].length} cartes)</div>
          <FanHand hand={G.hands[0]} legalIDs={new Set()} onPlay={() => {}} trump={null} />
        </div>
      </div>
    );
  }

  // ─── FIN DE MANCHE / PARTIE ────────────────────────────────────────────────

  if (G.phase === 'ROUND_END' || G.phase === 'GAME_OVER') {
    const r = G.roundResult;
    return (
      <div style={BG}>
        <div style={{ fontSize:18, fontWeight:'bold', marginTop:8 }}>
          {G.phase === 'GAME_OVER' ? '🏆 Partie terminée !' : '✓ Fin de manche'}
        </div>
        <div style={{ background:'rgba(0,0,0,.38)', borderRadius:12, padding:24, maxWidth:380, width:'100%', textAlign:'center' }}>
          {r && <>
            <div style={{ fontSize:15, marginBottom:12, lineHeight:1.4 }}>{r.msg}</div>
            <div style={{ fontSize:13, opacity:.8, marginBottom:14 }}>
              Points de cartes : Vous {r.pts[0]} – {r.pts[1]} Adv.
              {(G.belB[0] > 0 || G.belB[1] > 0) && <><br/>Belote/Rebelote : +{G.belB[0]} / +{G.belB[1]}</>}.
              <br/>Ce tour : <strong style={{ color:'#2ecc71' }}>+{r.rp[0]}</strong> / <strong style={{ color:'#e74c3c' }}>+{r.rp[1]}</strong>
            </div>
            <div style={{ fontSize:22, fontWeight:'bold', marginBottom:18 }}>
              Vous {G.scores[0]} – {G.scores[1]} Adversaires
            </div>
          </>}
          {G.phase === 'GAME_OVER' ? (
            <>
              <div style={{ fontSize:17, marginBottom:16 }}>
                {G.scores[0] >= 1000 ? '🎉 Vous gagnez la partie !' : '😔 Les adversaires gagnent.'}
              </div>
              <Btn onClick={() => setG(initRound())} bg="#27ae60">Nouvelle partie</Btn>
            </>
          ) : (
            <Btn onClick={() => setG(initRound(G.scores))} bg="#2980b9">Manche suivante →</Btn>
          )}
        </div>
      </div>
    );
  }

  // ─── PHASE JEU ─────────────────────────────────────────────────────────────

  const legalIDs = G.curPlayer === 0
    ? new Set(legalMoves(G.hands[0], G.trick, G.trump, 0).map(c => c.id))
    : new Set();
  const trickMap = Object.fromEntries(G.trick.map(t => [t.p, t.c]));
  const t0 = G.done.filter(d => teamOf(d.winner) === 0).length;
  const t1 = G.done.filter(d => teamOf(d.winner) === 1).length;
  const ac = RED_S(G.trump) ? '#ff9090' : 'white';

  return (
    <div style={BG}>

      {/* En-tête */}
      <div style={{ display:'flex', justifyContent:'space-between', width:'100%', maxWidth:540, fontSize:13, flexWrap:'wrap', gap:4 }}>
        <div>Atout : <strong style={{ color:ac }}>{G.trump} {SUIT_FR[G.trump]}</strong></div>
        <div style={{ color:'#f1c40f', fontWeight:'bold', minHeight:18 }}>{G.announce || `Pli ${G.done.length + 1}/8`}</div>
        <div>Vous <strong>{G.scores[0]}</strong> — <strong>{G.scores[1]}</strong> Adv.</div>
      </div>

      {/* Nord (partenaire) */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:11, opacity:.65, marginBottom:3 }}>
          {G.curPlayer === 2 ? '🎯 ' : ''}Nord{G.takerTeam === 0 ? ' 🤝' : ''}
        </div>
        <div style={{ display:'flex', gap:3, justifyContent:'center' }}>
          {G.hands[2].map(c => <Card key={c.id} card={c} faceDown small />)}
        </div>
      </div>

      {/* Milieu : Ouest | Pli central | Est */}
      <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%', justifyContent:'center' }}>

        {/* Ouest */}
        <div style={{ textAlign:'center', minWidth:62 }}>
          <div style={{ fontSize:11, opacity:.65, marginBottom:3 }}>
            {G.curPlayer === 1 ? '🎯 ' : ''}Ouest{G.takerTeam === 1 ? ' ⚔️' : ''}
          </div>
          <div style={{ background:'rgba(0,0,0,.28)', borderRadius:8, padding:'5px 10px', fontSize:12 }}>
            {G.hands[1].length} cartes
          </div>
        </div>

        {/* Pli en cours */}
        <div style={{ position:'relative', width:188, height:158, flexShrink:0, background:'rgba(0,0,0,.18)', borderRadius:12 }}>
          {trickMap[2] && <div style={{ position:'absolute', top:4, left:'50%', transform:'translateX(-50%)' }}><Card card={trickMap[2]} small /></div>}
          {trickMap[1] && <div style={{ position:'absolute', left:4, top:'50%', transform:'translateY(-50%)' }}><Card card={trickMap[1]} small /></div>}
          {trickMap[3] && <div style={{ position:'absolute', right:4, top:'50%', transform:'translateY(-50%)' }}><Card card={trickMap[3]} small /></div>}
          {trickMap[0] && <div style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)' }}><Card card={trickMap[0]} small /></div>}
          {!G.trick.length && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', opacity:.4, fontSize:11, textAlign:'center', gap:2 }}>
              {G.ltWin !== null && <><div>Pli gagné par</div><div style={{ fontWeight:'bold' }}>{PNAME[G.ltWin]}</div></>}
            </div>
          )}
        </div>

        {/* Est */}
        <div style={{ textAlign:'center', minWidth:62 }}>
          <div style={{ fontSize:11, opacity:.65, marginBottom:3 }}>
            {G.curPlayer === 3 ? '🎯 ' : ''}Est{G.takerTeam === 1 ? ' ⚔️' : ''}
          </div>
          <div style={{ background:'rgba(0,0,0,.28)', borderRadius:8, padding:'5px 10px', fontSize:12 }}>
            {G.hands[3].length} cartes
          </div>
        </div>
      </div>

      {/* Sud — main en éventail */}
      <div style={{ textAlign:'center', width:'100%' }}>
        <div style={{
          fontSize:12, marginBottom:6,
          color:      G.curPlayer === 0 ? '#2ecc71' : 'rgba(255,255,255,.55)',
          fontWeight: G.curPlayer === 0 ? 'bold' : 'normal',
        }}>
          {G.curPlayer === 0
            ? `🎯 Votre tour — jouez une carte${G.takerTeam === 0 ? ' (preneur)' : ''}`
            : 'Votre main' + (G.takerTeam === 0 ? ' (preneur)' : '')}
        </div>
        <FanHand hand={G.hands[0]} legalIDs={legalIDs} onPlay={humanPlay} trump={G.trump} />
      </div>

      {/* Barre de score */}
      <div style={{
        width:'100%', maxWidth:540,
        display:'flex', justifyContent:'space-between',
        fontSize:12, opacity:.6,
        background:'rgba(0,0,0,.22)', borderRadius:8, padding:'5px 10px',
      }}>
        <span>Plis : Vous+Nord {t0} – {t1} Adv. &nbsp;↻ S→O→N→E</span>
        <span>{G.takerTeam === 0 ? 'Vous prenez ▲' : 'Adv. prennent ▲'}</span>
      </div>

    </div>
  );
}
