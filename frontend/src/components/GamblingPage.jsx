import { useState } from "react";
import steakLogo from "@/assets/steak.com.png";

const games = ["Roulette", "Blackjack", "Mines"];
const deck = ["A♠", "K♥", "Q♣", "J♦", "10♠", "9♥", "8♣", "7♦", "6♠", "5♥"];
const value = (card) => Number.parseInt(card, 10) || ({ A: 11, K: 10, Q: 10, J: 10 }[card[0]] ?? 10);
function handTotal(cards) {
  let total = cards.reduce((sum, card) => sum + value(card), 0);
  let aces = cards.filter((card) => card[0] === "A").length;
  while (total > 21 && aces--) total -= 10;
  return total;
}

export default function GamblingPage({ username, points, onBack, onPoints }) {
  const [game, setGame] = useState("Roulette");
  const [wager, setWager] = useState(10);
  const [choice, setChoice] = useState(18);
  const [rouletteBet, setRouletteBet] = useState("number");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState([]);
  const [cards, setCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [mineBoard, setMineBoard] = useState([]);

  function changeGame(name) {
    setGame(name); setResult(null); setRevealed([]); setMineBoard([]); setCards([]); setDealerCards([]); setBusy(false);
  }

  async function play(extraChoice = Number(choice), selectedOverride = revealed, mineOverride = mineBoard) {
    const amount = Number(wager);
    if (!Number.isInteger(amount) || amount < 1 || amount > points) return setResult({ error: "Enter a valid wager within your balance." });
    setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/gamble", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: game.toLowerCase(), wager: amount, choice: extraChoice, bet_type: rouletteBet, selected: game === "Mines" ? selectedOverride : [], mines: game === "Mines" ? mineOverride : [] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not place bet");
      setResult(data);
      onPoints(data.points);
    } catch (error) { setResult({ error: error.message }); }
    finally { setBusy(false); }
  }

  function deal() {
    const next = [deck[Math.floor(Math.random() * deck.length)], deck[Math.floor(Math.random() * deck.length)]];
    setCards(next); setDealerCards([deck[Math.floor(Math.random() * deck.length)], "🂠"]); setResult(null);
  }

  function pickMine(i) {
    if (busy) return;
    if (result) { setResult(null); setRevealed([i]); return; }
    let board = mineBoard;
    if (!board.length) {
      board = [...Array(25)].map((_, index) => index).sort(() => Math.random() - 0.5).slice(0, 3);
      setMineBoard(board);
    }
    if (board.includes(i)) {
      const selected = [...new Set([...revealed, i])];
      play(selected.length, selected, board);
    } else if (!revealed.includes(i)) setRevealed((current) => [...current, i]);
  }

  function hit() {
    const next = [...cards, deck[Math.floor(Math.random() * deck.length)]];
    setCards(next);
    if (handTotal(next) > 21) play(handTotal(next));
  }

  const blackjackTotal = handTotal(cards);
  const blackjackReady = cards.length > 1 && blackjackTotal <= 21;

  return <div className="casino-page">
    <header className="casino-header"><button className="casino-brand" onClick={onBack} aria-label="Back to events"><img src={steakLogo} alt="Steak" /><span>STEAK<span>.COM</span></span></button><div className="casino-user"><strong>{username}</strong><strong>🪙 {points.toLocaleString()}</strong></div></header>
    <nav className="game-tabs">{games.map((name) => <button type="button" className={game === name ? "active" : ""} onClick={() => changeGame(name)} key={name}>{name}</button>)}</nav>
    <main className="casino-main">
      <section className="casino-hero"><div className="dragon dragon-left">🐉</div><div><p className="casino-kicker">THE HOUSE OF CHANCE</p><h1>Play to win.</h1><p>Turn your campus points into legendary wins.</p></div><div className="dragon dragon-right">🐲</div></section>
      <section className="game-card"><div className="game-card-heading"><div><span className="casino-kicker">LIVE TABLE</span><h2>{game}</h2></div><span className="fair-badge">● Provably fair</span></div>

        {game === "Roulette" && <><div className={`roulette-wheel ${busy ? "spinning" : ""}`}><div className="wheel-number">{result?.rolled ?? "?"}</div><small>{busy ? "SPINNING" : "PICK A BET"}</small></div><div className="roulette-bets"><button type="button" className={rouletteBet === "red" ? "selected" : ""} onClick={() => setRouletteBet("red")}>Red</button><button type="button" className={rouletteBet === "black" ? "selected" : ""} onClick={() => setRouletteBet("black")}>Black</button><button type="button" className={rouletteBet === "number" ? "selected" : ""} onClick={() => setRouletteBet("number")}>Number</button></div><div className="roulette-numbers">{[...Array(37)].map((_, i) => <button type="button" className={Number(choice) === i ? "selected" : ""} onClick={() => setChoice(i)} key={i}>{i}</button>)}</div></>}
        {game === "Blackjack" && (
          <div className="blackjack-table">
            <div className="dealer-hand"><small>DEALER</small><span>{result?.dealerCards?.[0] ?? (dealerCards.length ? dealerCards[0] : "?")} {result?.dealerCards?.[1] ?? "🂠"}</span>{result?.dealer && <small>Dealer total: {result.dealer}</small>}</div>
            <div className="playing-cards">{cards.length ? cards.join("  ") : "♠ ♥ ♣ ♦"}</div>
            <strong>{cards.length ? `Your hand: ${blackjackTotal}` : "Deal your hand"}</strong>
            <div className="table-actions"><button type="button" onClick={deal}>Deal</button><button type="button" disabled={!blackjackReady || busy} onClick={hit}>Hit</button><button type="button" disabled={cards.length < 2 || busy} onClick={() => play(blackjackTotal)}>Stand</button></div>
          </div>
        )}
        {game === "Mines" && <><div className="mines-grid">{[...Array(25)].map((_, i) => <button type="button" className={revealed.includes(i) ? "revealed" : ""} onClick={() => pickMine(i)} key={i}>{result?.mines?.includes(i) ? "💣" : revealed.includes(i) ? "💎" : ""}</button>)}</div><p className="game-hint">Pick tiles, then cash out before the house catches you.</p></>}
        <div className="bet-controls"><label>Wager<input type="number" min="1" max={points} value={wager} onChange={(e) => setWager(e.target.value)} /><span>🪙</span></label>{game === "Mines" ? <button className="play-button" onClick={() => play(revealed.length)} disabled={busy || !revealed.length || Boolean(result)}>{busy ? "Checking…" : `Cash out ${revealed.length} tile${revealed.length === 1 ? "" : "s"}`}</button> : game !== "Blackjack" && <button className="play-button" onClick={() => play()} disabled={busy}>{busy ? (game === "Roulette" ? "Spinning…" : "Dropping…") : `${game === "Roulette" ? "Spin" : "Drop ball"} · ${wager} points`}</button>}</div>
        {result && <div className={`game-result ${result.push ? "push" : result.won ? "won" : "lost"}`}>{result.error || <><strong>{result.push ? "PUSH" : result.won ? "YOU WON" : "HOUSE WINS"}</strong><span>{result.color && ` ${result.rolled} ${result.color} ·`}{result.multiplier ? ` ${result.payout} points` : result.net > 0 ? ` +${result.net} points` : ` ${result.net} points`}</span></>}</div>}
      </section><p className="responsible-play">Play responsibly · Points have no cash value</p>
    </main>
  </div>;
}
