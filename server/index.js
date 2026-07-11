const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// ── DICCIONARIOS (solo A-Z, sin tildes) ──────────────────────────────────────
const DICTS = {
  NEGOCIOS:    ['ACTIVO','PASIVO','RENTA','VENTA','LIDER','METAS','EXITO','BONOS','VALOR','DEUDA','BOLSA','PRECIO','OFERTA','MARCA','GASTO','COSTO','FONDO','SOCIO','INGRESO','CARGO'],
  ANIMALES:    ['TIGRE','LEON','PERRO','GATO','ZEBRA','OSO','AGUILA','LOBO','LINCE','PUMA','ZORRO','BUHO','CIERVO','BISONTE','NUTRIA','CASTOR','MAPACHE','COYOTE','JAGUAR','PANDA'],
  PAISES:      ['MEXICO','CHILE','PERU','CHINA','JAPON','ITALIA','RUSIA','INDIA','SUIZA','EGIPTO','BRASIL','GRECIA','CANADA','FRANCIA','TURQUIA','POLONIA','AUSTRIA','NORUEGA','SUECIA','IRAN'],
  DEPORTES:    ['FUTBOL','TENIS','BOXEO','GOLF','RUGBY','NATACION','BEISBOL','CICLISMO','KARATE','VOLEIBOL','ATLETISMO','ESQUI','CRICKET','POLO','SURF','JUDO','HOCKEY','ESGRIMA','REMO','LUCHA'],
  COLORES:     ['ROJO','AZUL','VERDE','NEGRO','BLANCO','GRIS','ROSA','MORADO','NARANJA','CELESTE','DORADO','PLATEADO','CAFE','TURQUESA','INDIGO','VIOLETA','COBRE','BEIGE','ESCARLATA','CIAN'],
  FRUTAS:      ['MANGO','PERA','LIMON','MELON','FRESA','UVAS','PAPAYA','CIRUELA','PLATANO','KIWI','SANDIA','CEREZA','DURAZNO','GUAYABA','MANDARINA','FRAMBUESA','GRANADA','HIGO','COCO','TAMARINDO'],
  PROFESIONES: ['MEDICO','PILOTO','MAESTRO','ABOGADO','DENTISTA','POLICIA','SOLDADO','BOMBERO','MUSICO','ACTOR','CHEF','INGENIERO','ARQUITECTO','CONTADOR','QUIMICO','FILOSOFO','GEOLOGO','ASTRONOMO','BIÓLOGO','FISICO'],
  TECNOLOGIA:  ['CELULAR','LAPTOP','TABLET','ROBOT','DRONE','CABLE','CAMARA','PANTALLA','TECLADO','RATON','DISCO','SENSOR','SERVIDOR','ROUTER','ANTENA','BATERIA','MEMORIA','CODIGO','NUBE','PIXEL'],
  MUSICA:      ['PIANO','FLAUTA','VIOLIN','TAMBOR','GUITARRA','BATERIA','TROMPETA','SAXOFON','ARPA','CELLO','CLARINETE','OBOE','BANJO','TUBA','MANDOLINA','ACORDEON','BOMBO','CONGA','MARIMBA','LAUD'],
  CIENCIA:     ['ATOMO','CELULA','PLASMA','ORBITA','NEUTRON','PROTON','ENERGIA','OXIGENO','LITIO','CARBONO','NITROGENO','FOSFORO','ENZIMA','QUASAR','PULSAR','FUSION','LASER','ELECTRON','ISOTOPO','FOTÓN'],
  HISTORIA:    ['FARAON','PIRAMIDE','GLADIADOR','VIKINGO','SAMURAI','AZTECA','MAYA','INCA','FEUDAL','CRUZADA','COLONIA','REPUBLICA','SENADO','LEGION','CASTILLO','CABALLERO','MONARCA','DINASTIA','IMPERIO','TRIBUNO'],
  NATURALEZA:  ['VOLCAN','OCEANO','DESIERTO','SELVA','GLACIAR','TORNADO','TSUNAMI','TERREMOTO','LAGUNA','PANTANO','SABANA','BOSQUE','FIORDO','MESETA','ARRECIFE','CENOTE','MANANTIAL','TUNDRA','PAMPA','DELTA'],
  COCINA:      ['PASTA','SOPA','TACOS','PIZZA','SUSHI','TAMALES','ARROZ','CALDO','ENCHILADA','BURRITO','POZOLE','MOLE','CEVICHE','PAELLA','RAMEN','CURRY','LASAGNA','FONDUE','WONTON','CREPA'],
  ROPA:        ['CAMISA','PANTALON','VESTIDO','ABRIGO','ZAPATOS','CORBATA','SOMBRERO','BUFANDA','CINTURON','GUANTES','TRAJE','FALDA','PIJAMA','OVEROL','KIMONO','PONCHO','CAPA','CHALECO','TURBANTE','BLUSA'],
  TRANSPORTE:  ['AVION','BARCO','TREN','METRO','CAMION','MOTO','BICICLETA','TAXI','HELICOPTERO','COHETE','TRANVIA','FERRY','SUBMARINO','GLOBO','TRINEO','CANOA','LANCHA','FUNICULAR','ZEPPELIN','PATÍN']
};

const CAT_NAMES = Object.keys(DICTS);
const PLAYER_COLORS = ['#E63946','#2A9D8F','#F4A261','#8338EC','#3A86FF','#FB5607','#06D6A0','#FF006E','#FFD60A','#E040FB'];
const MIN_PLAYERS = 2;
const WORDS_PER_ROUND = 15;
const DIRS = [
  {dr:0,dc:1},{dr:0,dc:-1},{dr:1,dc:0},{dr:-1,dc:0},
  {dr:1,dc:1},{dr:1,dc:-1},{dr:-1,dc:1},{dr:-1,dc:-1}
];

let usedWords = {};
let roundTimer = null;
let colorIdx = 0;
const HISTORY_FILE = path.join(__dirname, 'tournament-history.json');
let tournamentHistory = loadHistory();
let G = freshState();

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch (_) {
    return [];
  }
}

function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(tournamentHistory.slice(0, 50), null, 2));
}

function freshState() {
  return {
    phase: 'LOBBY',
    config: { rounds: 3, category: 'ALEATORIO', timePerRound: 300, tournamentName: defaultTournamentName() },
    currentRound: 0, adminId: null, players: {},
    participants: {}, finalResults: [],
    board: [], words: [], wordCoords: {},
    foundWords: [], foundBy: {},
    winner: null, winReason: null, roundEndsAt: null,
    scores: [],
    history: tournamentHistory
  };
}

function defaultTournamentName() {
  return `Torneo ${new Date().toLocaleDateString('es-MX')}`;
}

function clean(w) {
  return (w || '').toUpperCase()
    .replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E')
    .replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O')
    .replace(/[ÚÙÜÛ]/g,'U').replace(/[Ñ]/g,'N')
    .replace(/[^A-Z]/g,'');
}

function genBoard(cat, size = 14) {
  const grid = Array(size).fill(null).map(() => Array(size).fill(''));
  const raw = DICTS[cat] || DICTS.NEGOCIOS;
  if (!usedWords[cat]) usedWords[cat] = [];

  let available = [...new Set(raw.map(clean))]
    .filter(w => w.length >= 3 && w.length <= size - 2 && !usedWords[cat].includes(w));

  if (available.length < WORDS_PER_ROUND) {
    const usedAll = new Set(Object.values(usedWords).flat());
    const fallback = Object.entries(DICTS)
      .filter(([name]) => name !== cat)
      .flatMap(([, words]) => words.map(clean))
      .filter(w => w.length >= 3 && w.length <= size - 2 && !usedAll.has(w) && !available.includes(w));
    available = [...available, ...new Set(fallback)];
  }

  if (available.length < WORDS_PER_ROUND) {
    const recycled = [...new Set(raw.map(clean))]
      .filter(w => w.length >= 3 && w.length <= size - 2 && !available.includes(w));
    available = [...available, ...recycled];
  }

  const selected = available.sort(() => Math.random() - .5).slice(0, WORDS_PER_ROUND);
  usedWords[cat].push(...selected);

  const placed = [], coords = {};

  for (const w of selected) {
    let ok = false, att = 0;
    const dirs = [...DIRS].sort(() => Math.random() - .5);
    while (!ok && att++ < 600) {
      const dir = dirs[att % dirs.length];
      const r0 = Math.floor(Math.random() * size);
      const c0 = Math.floor(Math.random() * size);
      let can = true;
      for (let i = 0; i < w.length; i++) {
        const r = r0 + dir.dr * i, c = c0 + dir.dc * i;
        if (r < 0 || r >= size || c < 0 || c >= size || (grid[r][c] && grid[r][c] !== w[i])) { can = false; break; }
      }
      if (can) {
        const wc = [];
        for (let i = 0; i < w.length; i++) {
          const r = r0 + dir.dr * i, c = c0 + dir.dc * i;
          grid[r][c] = w[i]; wc.push({ r, c });
        }
        placed.push(w); coords[w] = wc; ok = true;
      }
    }
  }

  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!grid[r][c]) grid[r][c] = ABC[Math.floor(Math.random() * 26)];

  return { grid, words: placed, coords };
}

function startRound() {
  if (roundTimer) clearTimeout(roundTimer);
  G.currentRound++;
  G.phase = 'PLAYING';
  G.foundWords = [];
  G.foundBy = {};
  Object.values(G.players).forEach(p => { p.score = 0; p.wordsFound = 0; p.myFoundWords = []; });
  const { grid, words, coords } = genBoard(G.config.category);
  G.board = grid; G.words = words; G.wordCoords = coords;
  G.roundEndsAt = Date.now() + G.config.timePerRound * 1000;
  io.emit('state', G);
  roundTimer = setTimeout(() => endRound('time'), G.config.timePerRound * 1000);
}

function syncParticipants() {
  Object.values(G.players).forEach(p => {
    G.participants[p.id] = {
      id: p.id,
      name: p.name,
      color: p.color,
      totalScore: p.totalScore || 0,
      totalWords: p.totalWords || 0,
      score: p.score || 0,
      wordsFound: p.wordsFound || 0,
      left: false,
      active: true
    };
  });
}

function resultsFromParticipants() {
  syncParticipants();
  return Object.values(G.participants)
    .map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      totalScore: p.totalScore || 0,
      totalWords: p.totalWords || 0,
      left: !!p.left,
      active: !!p.active
    }))
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
}

function finishTournament(reason, winnerIds = null, winReason = '') {
  if (roundTimer) { clearTimeout(roundTimer); roundTimer = null; }
  G.roundEndsAt = null;
  G.phase = 'END';
  G.finalResults = resultsFromParticipants();
  const winners = winnerIds
    ? G.finalResults.filter(p => winnerIds.includes(p.id))
    : G.finalResults.filter(p => p.totalScore === Math.max(...G.finalResults.map(x => x.totalScore || 0)));
  G.winner = winners.map(p => p.name).join(' y ') || 'Nadie';
  G.winReason = winReason || (G.config.rounds > 1 ? 'Campeón del torneo' : reason);

  const record = {
    id: Date.now().toString(36),
    date: new Date().toISOString(),
    tournamentName: G.config.tournamentName || defaultTournamentName(),
    category: G.config.category,
    rounds: G.config.rounds,
    timePerRound: G.config.timePerRound,
    winner: G.winner,
    reason: G.winReason,
    results: G.finalResults.map(({ name, totalScore, totalWords, left, active }) => ({ name, totalScore, totalWords, left, active }))
  };
  tournamentHistory.unshift(record);
  tournamentHistory = tournamentHistory.slice(0, 50);
  saveHistory();
  G.history = tournamentHistory;
  io.emit('state', G);
}

function endRound(reason) {
  if (roundTimer) { clearTimeout(roundTimer); roundTimer = null; }
  G.roundEndsAt = null;

  Object.values(G.players).forEach(p => {
    p.totalScore = (p.totalScore || 0) + (p.score || 0);
    p.totalWords = (p.totalWords || 0) + (p.wordsFound || 0);
  });
  syncParticipants();

  const pls = Object.values(G.players);
  let roundWinner = 'Nadie', winReason = '';

  if (reason === 'complete') {
    const max = Math.max(...pls.map(p => p.wordsFound || 0));
    roundWinner = pls.filter(p => p.wordsFound === max).map(p => p.name).join(' y ');
    winReason = '¡Todas las palabras fueron encontradas!';
  } else {
    const max = Math.max(...pls.map(p => p.score || 0));
    if (max > 0) {
      roundWinner = pls.filter(p => p.score === max).map(p => p.name).join(' y ');
      winReason = 'Tiempo agotado — ganó por más puntos';
    } else {
      winReason = 'Nadie encontró palabras';
    }
  }

  if (G.currentRound >= G.config.rounds) {
    finishTournament(winReason);
  } else {
    G.phase = 'INTERMISSION';
    G.winner = roundWinner;
    G.winReason = winReason;
    io.emit('state', G);
    roundTimer = setTimeout(startRound, 6000);
  }
}

function checkSoloWinner() {
  if (!['PLAYING', 'INTERMISSION'].includes(G.phase)) return false;
  const active = Object.values(G.players);
  const totalParticipants = Object.keys(G.participants).length || active.length;
  if (active.length === 1 && totalParticipants > 1) {
    const survivor = active[0];
    syncParticipants();
    finishTournament('abandono', [survivor.id], 'Ganó porque los demás abandonaron la partida');
    return true;
  }
  return false;
}

function removePlayer(socketId, left) {
  if (G.players[socketId]) {
    const p = G.players[socketId];
    G.participants[socketId] = {
      ...(G.participants[socketId] || {}),
      id: socketId,
      name: p.name,
      color: p.color,
      totalScore: p.totalScore || 0,
      totalWords: p.totalWords || 0,
      left: !!left,
      active: false
    };
    delete G.players[socketId];
  }

  if (G.adminId === socketId) {
    const nxt = Object.values(G.players)[0];
    if (nxt) { nxt.isAdmin = true; G.adminId = nxt.id; }
    else G.adminId = null;
  }

  if (!Object.keys(G.players).length && roundTimer) {
    clearTimeout(roundTimer); roundTimer = null;
  }
}

io.on('connection', socket => {
  // ── JOIN ──
  socket.on('join', name => {
    if (G.phase !== 'LOBBY') return;
    const isFirst = !Object.keys(G.players).length;
    G.players[socket.id] = {
      id: socket.id,
      name: clean(name).slice(0,16) || (name||'').trim().slice(0,16) || 'Jugador',
      score: 0, totalScore: 0, wordsFound: 0, totalWords: 0,
      myFoundWords: [],
      color: PLAYER_COLORS[colorIdx++ % PLAYER_COLORS.length],
      isAdmin: isFirst
    };
    // Preservar nombre original (con tildes)
    G.players[socket.id].name = (name||'').trim().slice(0,16) || 'Jugador';
    G.participants[socket.id] = {
      id: socket.id,
      name: G.players[socket.id].name,
      color: G.players[socket.id].color,
      totalScore: 0,
      totalWords: 0,
      left: false,
      active: true
    };
    if (isFirst) G.adminId = socket.id;
    io.emit('state', G);
  });

  // ── START ──
  socket.on('start', cfg => {
    if (socket.id !== G.adminId) return;
    if (Object.keys(G.players).length < MIN_PLAYERS) {
      socket.emit('error_msg', `Necesitas mínimo ${MIN_PLAYERS} jugadores para iniciar`);
      return;
    }
    const cat = cfg.category === 'ALEATORIO'
      ? CAT_NAMES[Math.floor(Math.random() * CAT_NAMES.length)]
      : (DICTS[cfg.category] ? cfg.category : 'NEGOCIOS');

    G.config = {
      rounds: Math.max(1, Math.min(10, +cfg.rounds || 3)),
      category: cat,
      timePerRound: Math.max(60, Math.min(1800, +cfg.timePerRound || 300)),
      tournamentName: String(cfg.tournamentName || defaultTournamentName()).trim().slice(0, 40)
    };
    G.currentRound = 0; G.winner = null; G.winReason = null;
    G.finalResults = [];
    usedWords = {};
    Object.values(G.players).forEach(p => {
      p.totalScore = 0; p.score = 0; p.wordsFound = 0; p.totalWords = 0; p.myFoundWords = [];
      G.participants[p.id] = { id: p.id, name: p.name, color: p.color, totalScore: 0, totalWords: 0, left: false, active: true };
    });
    startRound();
  });

  // ── WORD ──
  socket.on('word', ({ word, coords }) => {
    if (G.phase !== 'PLAYING' || !G.players[socket.id]) return;
    const w = clean(word || '');
    if (!w || !G.words.includes(w)) return;
    const p = G.players[socket.id];
    if (!p.myFoundWords) p.myFoundWords = [];
    if (p.myFoundWords.includes(w)) return;

    // Validar coordenadas contra las reales del servidor
    const real = G.wordCoords[w];
    if (coords && real) {
      const cf = coords.map(c => `${c.r},${c.c}`).join('|');
      const cr = [...coords].reverse().map(c => `${c.r},${c.c}`).join('|');
      const rv = real.map(c => `${c.r},${c.c}`).join('|');
      if (cf !== rv && cr !== rv) return;
    }

    p.myFoundWords.push(w);
    p.wordsFound = p.myFoundWords.length;
    const pts = w.length * 5;
    p.score = (p.score || 0) + pts;
    syncParticipants();

    if (!G.foundWords.includes(w)) {
      G.foundWords.push(w);
      G.foundBy[w] = socket.id;
    }

    io.emit('found', { word: w, by: socket.id, name: p.name, pts, color: p.color, wordsFound: p.wordsFound, total: G.words.length });
    io.emit('state', G);

    if (G.foundWords.length >= G.words.length) {
      setTimeout(() => {
        if (G.phase === 'PLAYING') endRound('complete');
      }, 500);
    }
  });

  // ── RESET — corregido: vuelve al LOBBY manteniendo jugadores ──
  socket.on('reset', () => {
    if (socket.id !== G.adminId) return;
    if (roundTimer) { clearTimeout(roundTimer); roundTimer = null; }

    // Guardar jugadores actuales
    const prevPlayers = Object.values(G.players).map(p => ({
      ...p, score: 0, totalScore: 0, wordsFound: 0, totalWords: 0, myFoundWords: [], isAdmin: false
    }));
    const prevAdmin = G.adminId;

    // Reset completo del estado
    G = freshState();
    G.history = tournamentHistory;
    usedWords = {};
    colorIdx = 0;

    // Restaurar jugadores en el nuevo estado
    prevPlayers.forEach(p => {
      p.isAdmin = (p.id === prevAdmin);
      G.players[p.id] = p;
    });
    G.adminId = prevAdmin;

    // Emitir nuevo estado LOBBY a todos — todos verán la sala de espera
    io.emit('state', G);
    io.emit('reset_to_lobby'); // señal explícita para el cliente
  });

  // ── LEAVE ──
  socket.on('leave', ack => {
    removePlayer(socket.id, true);
    if (!checkSoloWinner()) io.emit('state', G);
    if (typeof ack === 'function') ack();
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    removePlayer(socket.id, G.phase !== 'LOBBY');
    if (!checkSoloWinner()) io.emit('state', G);
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1');
server.listen(PORT, HOST, () => {
  console.log(`\n✅ Word Hunters en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log('📲 En hosting, comparte la URL pública del servicio.\n');
});
