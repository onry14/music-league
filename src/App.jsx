// src/App.jsx
import { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function App() {
  const [step, setStep] = useState("join"); // join, lobby, submit, vote, leaderboard, finished
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [movieChoice, setMovieChoice] = useState("");
  const [voteChoice, setVoteChoice] = useState("");

  // Join or create room
  async function joinRoom() {
    let code = roomCode.trim().toUpperCase();
    if (!code) code = generateRoomCode();
    setRoomCode(code);
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    let players = {};
    if (!roomSnap.exists()) {
      // Create room
      players = {};
      await setDoc(roomRef, {
        currentRound: 1,
        status: "submitting",
        players: {},
        submissions: {},
        votes: {},
      });
    } else {
      players = roomSnap.data().players || {};
      if (Object.keys(players).length >= 6) {
        alert("Room full!");
        return;
      }
    }
    // Add player
    const id = Math.random().toString(36).substring(2, 10);
    setPlayerId(id);
    await updateDoc(roomRef, {
      [`players.${id}`]: {
        nickname,
        score: 0,
        hasSubmitted: false,
        hasVoted: false,
      },
    });
    setStep("lobby");

    // Listen for room updates
    onSnapshot(roomRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      setRoomData(data);

      // Progress game phases automatically
      const totalPlayers = Object.keys(data.players || {}).length;
      if (
        data.status === "submitting" &&
        Object.values(data.players).filter((p) => p.hasSubmitted).length ===
          totalPlayers &&
        totalPlayers > 0
      ) {
        updateDoc(roomRef, { status: "voting" });
      }
      if (
        data.status === "voting" &&
        Object.values(data.players).filter((p) => p.hasVoted).length ===
          totalPlayers &&
        totalPlayers > 0
      ) {
        // Calculate scores and move to next round or finish
        let newScores = { ...data.players };
        const round = data.currentRound;

        // Count votes - one vote per player for a movie/player
        const votesForRound = data.votes?.[round] || {};
        const submissionsForRound = data.submissions?.[round] || {};

        // Increment score of voted player
        Object.values(votesForRound).forEach((votedPlayerId) => {
          if (newScores[votedPlayerId]) {
            newScores[votedPlayerId].score += 1;
          }
        });

        // Prepare new players map with reset hasSubmitted and hasVoted flags
        const resetPlayers = {};
        for (const pid in newScores) {
          resetPlayers[pid] = {
            ...newScores[pid],
            hasSubmitted: false,
            hasVoted: false,
          };
        }

        if (round >= 6) {
          updateDoc(roomRef, {
            status: "finished",
            players: resetPlayers,
          });
        } else {
          updateDoc(roomRef, {
            currentRound: increment(1),
            status: "submitting",
            players: resetPlayers,
          });
        }
      }
    });
  }

  async function submitMovie() {
    if (!movieChoice.trim()) return alert("Enter a movie title");
    const roomRef = doc(db, "rooms", roomCode);
    await updateDoc(roomRef, {
      [`submissions.${roomData.currentRound}.${playerId}`]: movieChoice.trim(),
      [`players.${playerId}.hasSubmitted`]: true,
    });
    setStep("wait-vote");
  }

  async function submitVote() {
    if (!voteChoice) return alert("Select a movie to vote");
    const roomRef = doc(db, "rooms", roomCode);
    await updateDoc(roomRef, {
      [`votes.${roomData.currentRound}.${playerId}`]: voteChoice,
      [`players.${playerId}.hasVoted`]: true,
    });
    setStep("wait-next");
  }

  if (step === "join") {
    return (
      <div style={{ padding: 20 }}>
        <h1>🎬 Movie League</h1>
        <input
          placeholder="Enter nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <input
          placeholder="Room code (leave empty to create)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button disabled={!nickname.trim()} onClick={joinRoom}>
          Join / Create Room
        </button>
      </div>
    );
  }

  if (!roomData) return <p>Loading room...</p>;

  if (step === "lobby") {
    return (
      <div style={{ padding: 20 }}>
        <h2>Room: {roomCode}</h2>
        <h3>Players:</h3>
        <ul>
          {Object.values(roomData.players).map((p, i) => (
            <li key={i}>{p.nickname}</li>
          ))}
        </ul>
        <p>Waiting for all players to submit movies...</p>
      </div>
    );
  }

  if (step === "wait-vote") {
    return (
      <div style={{ padding: 20 }}>
        <h2>Waiting for others to submit movies...</h2>
      </div>
    );
  }

  if (roomData.status === "submitting" && !roomData.players[playerId]?.hasSubmitted) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Round {roomData.currentRound} — Submit your movie</h2>
        <input
          placeholder="Movie title"
          value={movieChoice}
          onChange={(e) => setMovieChoice(e.target.value)}
        />
        <button onClick={submitMovie}>Submit</button>
      </div>
    );
  }

  if (roomData.status === "voting" && !roomData.players[playerId]?.hasVoted) {
    // Show all submissions except your own for voting
    const round = roomData.currentRound;
    const submissions = roomData.submissions?.[round] || {};
    const options = Object.entries(submissions)
      .filter(([pid]) => pid !== playerId)
      .map(([pid, movie]) => ({ pid, movie }));

    return (
      <div style={{ padding: 20 }}>
        <h2>Round {round} — Vote for the best movie</h2>
        {options.length === 0 ? (
          <p>No movies to vote on</p>
        ) : (
          <ul>
            {options.map(({ pid, movie }) => (
              <li key={pid}>
                <label>
                  <input
                    type="radio"
                    name="vote"
                    value={pid}
                    onChange={(e) => setVoteChoice(e.target.value)}
                  />{" "}
                  {movie}
                </label>
              </li>
            ))}
          </ul>
        )}
        <button disabled={!voteChoice} onClick={submitVote}>
          Submit Vote
        </button>
      </div>
    );
  }

  if (roomData.status === "finished") {
    // Show leaderboard
    const players = Object.values(roomData.players || {}).sort(
      (a, b) => b.score - a.score
    );
    return (
      <div style={{ padding: 20 }}>
        <h2>Game Over — Leaderboard</h2>
        <ol>
          {players.map((p, i) => (
            <li key={i}>
              {p.nickname} — {p.score} point{p.score !== 1 ? "s" : ""}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <p>Waiting for others...</p>
    </div>
  );
}
