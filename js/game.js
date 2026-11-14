import { decryptPayload } from './crypto.js';

const GROUP_PREFIXES = ['11', '12', '13', '14'];

// DOM Elements
const unlockScreen = document.getElementById('unlock-screen');
const unlockForm = document.getElementById('unlock-form');
const passwordInput = document.getElementById('password-input');
const unlockBtn = document.getElementById('unlock-btn');
const unlockError = document.getElementById('unlock-error');

const gameScreen = document.getElementById('game-screen');
const guessInput = document.getElementById('guess-input');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const actionBtn = document.getElementById('action-btn');
const boardBody = document.getElementById('board-body');

// Game State
let peopleById = {};
let lookupMap = new Map(); // normalized string -> id
let guessedIds = new Set();
let cellById = new Map();  // id -> <td> element for the name
let totalCount = 0;

let timerInterval = null;
let startTime = null;
let gameEnded = false;

function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatTime(ms) {
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function startTimer() {
  if (timerInterval !== null) return;
  startTime = performance.now();
  timerInterval = setInterval(() => {
    timerEl.textContent = formatTime(performance.now() - startTime);
  }, 50);
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (startTime !== null) {
    timerEl.textContent = formatTime(performance.now() - startTime);
  }
}

function updateScore() {
  scoreEl.textContent = `${guessedIds.size}/${totalCount}`;
}

function initGame(data) {
  peopleById = data;
  lookupMap.clear();
  cellById.clear();

  const ids = Object.keys(data).sort();
  totalCount = ids.length;

  for (const id of ids) {
    const entry = data[id];
    const terms = [entry.name, ...(entry.aliases ?? [])];
    for (const term of terms) {
      const norm = normalize(term);
      if (norm) {
        lookupMap.set(norm, id);
      }
    }
  }

  buildTable(ids);
  resetGame();

  unlockScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  guessInput.focus();
}

function buildTable(sortedIds) {
  boardBody.innerHTML = '';

  const columns = GROUP_PREFIXES.map((prefix) =>
    sortedIds.filter((id) => id.startsWith(prefix))
  );
  const maxRows = Math.max(...columns.map((col) => col.length));

  for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
    const tr = document.createElement('tr');

    for (const colIds of columns) {
      const id = colIds[rowIdx];
      const tdId = document.createElement('td');
      const tdName = document.createElement('td');

      if (id) {
        tdId.className = 'col-id';
        tdId.textContent = id;

        tdName.className = 'col-name';
        cellById.set(id, tdName);
      } else {
        tdId.className = 'col-id col-empty';
        tdName.className = 'col-name col-empty';
      }

      tr.append(tdId, tdName);
    }

    boardBody.appendChild(tr);
  }
}

function handleGuess() {
  if (gameEnded) return;

  const query = normalize(guessInput.value);
  if (!query) return;

  const matchedId = lookupMap.get(query);
  if (!matchedId || guessedIds.has(matchedId)) return;

  // First correct guess starts the timer
  if (guessedIds.size === 0) {
    startTimer();
  }

  guessedIds.add(matchedId);
  guessInput.value = '';

  const cell = cellById.get(matchedId);
  if (cell) {
    cell.textContent = peopleById[matchedId].name;
    cell.classList.remove('name-missed');
    cell.classList.add('name-guessed');
  }

  updateScore();

  if (guessedIds.size === totalCount) {
    endGame();
  }
}

function endGame() {
  gameEnded = true;
  stopTimer();
  guessInput.disabled = true;
  actionBtn.textContent = 'Reset';
}

function giveUp() {
  if (gameEnded) return;

  for (const [id, cell] of cellById.entries()) {
    if (!guessedIds.has(id)) {
      cell.textContent = peopleById[id].name;
      cell.classList.add('name-missed');
    }
  }

  endGame();
}

function resetGame() {
  stopTimer();
  startTime = null;
  gameEnded = false;
  guessedIds.clear();

  for (const cell of cellById.values()) {
    cell.textContent = '';
    cell.classList.remove('name-guessed', 'name-missed');
  }

  timerEl.textContent = '0:00.0';
  updateScore();

  guessInput.value = '';
  guessInput.disabled = false;
  actionBtn.textContent = 'Give Up';
  guessInput.focus();
}

// Event Listeners
unlockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  unlockError.textContent = '';
  unlockBtn.disabled = true;

  try {
    const res = await fetch('./data.enc', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Could not load data.enc');
    }
    const encryptedPayload = await res.json();
    const decrypted = await decryptPayload(encryptedPayload, passwordInput.value.trim());
    initGame(decrypted);
  } catch (err) {
    unlockError.textContent =
      err.name === 'OperationError'
        ? 'Incorrect passphrase.'
        : 'Failed to load or decrypt data.';
    passwordInput.select();
  } finally {
    unlockBtn.disabled = false;
  }
});

guessInput.addEventListener('input', handleGuess);

actionBtn.addEventListener('click', () => {
  if (gameEnded) {
    resetGame();
  } else {
    giveUp();
  }
});