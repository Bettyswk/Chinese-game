import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  CURRICULUM_VERSION,
  DEFAULT_GROUPS,
  DEFAULT_SETTINGS,
  DEFAULT_VOCAB,
  GROUP_IDS,
} from './src/data/curriculum.ts';
import type {
  ClassroomState,
  GameSettings,
  GroupDeck,
  TeamProgress,
  TeamStatus,
  VocabItem,
} from './src/types/game.ts';

const PORT = 3000;
const STATE_FILE = path.resolve(process.cwd(), '.classroom-state.json');

function createInitialTeams(): Record<number, TeamProgress> {
  const teams: Record<number, TeamProgress> = {};
  for (const id of GROUP_IDS) {
    teams[id] = {
      groupId: id,
      status: 'IDLE',
      currentQ: 0,
      totalQ: 3,
      wrongCount: 0,
      elapsedMs: null,
      penaltyMs: 0,
      finalMs: null,
      finishOrder: null,
      updatedAt: Date.now(),
    };
  }
  return teams;
}

function createDefaultState(): ClassroomState {
  return {
    curriculumVersion: CURRICULUM_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    vocab: DEFAULT_VOCAB.map((v) => ({ ...v })),
    groups: DEFAULT_GROUPS.map((g) => ({
      ...g,
      questions: g.questions.map((q) => ({ ...q })),
    })),
    session: {
      phase: 'LOBBY',
      countdownEndsAt: null,
      startedAt: null,
      teams: createInitialTeams(),
    },
  };
}

function loadState(): ClassroomState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ClassroomState>;
      if (parsed.curriculumVersion !== CURRICULUM_VERSION) {
        return createDefaultState();
      }
      const base = createDefaultState();
      return {
        curriculumVersion: CURRICULUM_VERSION,
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        vocab: Array.isArray(parsed.vocab) && parsed.vocab.length > 0 ? parsed.vocab : base.vocab,
        groups: Array.isArray(parsed.groups) && parsed.groups.length > 0 ? parsed.groups : base.groups,
        session: {
          phase: parsed.session?.phase ?? 'LOBBY',
          countdownEndsAt: parsed.session?.countdownEndsAt ?? null,
          startedAt: parsed.session?.startedAt ?? null,
          teams: { ...base.session.teams, ...(parsed.session?.teams ?? {}) },
        },
      };
    }
  } catch {
    // Fallback to clean state if persisted JSON is malformed
  }
  return createDefaultState();
}

let state: ClassroomState = loadState();
const sseClients = new Set<express.Response>();

function persistState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore disk write issues in ephemeral containers
  }
}

function broadcastState() {
  persistState();
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

let countdownTimer: ReturnType<typeof setTimeout> | null = null;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/classroom/state', (_req, res) => {
    res.json(state);
  });

  app.get('/api/classroom/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`data: ${JSON.stringify(state)}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.post('/api/classroom/team/update', (req, res) => {
    const body = req.body as {
      groupId?: number;
      status?: TeamStatus;
      currentQ?: number;
      totalQ?: number;
      wrongCount?: number;
      elapsedMs?: number | null;
      penaltyMs?: number;
      finalMs?: number | null;
    };

    const groupId = Number(body.groupId);
    if (!Number.isInteger(groupId) || !(GROUP_IDS as readonly number[]).includes(groupId)) {
      res.status(400).json({ error: 'Invalid groupId' });
      return;
    }

    const existing = state.session.teams[groupId] ?? {
      groupId,
      status: 'IDLE' as TeamStatus,
      currentQ: 0,
      totalQ: 3,
      wrongCount: 0,
      elapsedMs: null,
      penaltyMs: 0,
      finalMs: null,
      finishOrder: null,
      updatedAt: Date.now(),
    };

    let finishOrder = existing.finishOrder;
    if (body.status === 'FINISHED' && existing.status !== 'FINISHED') {
      const finishedCount = Object.values(state.session.teams).filter(
        (t) => t.status === 'FINISHED' && t.groupId !== groupId
      ).length;
      finishOrder = finishedCount + 1;
    } else if (body.status && body.status !== 'FINISHED') {
      finishOrder = null;
    }

    state.session.teams[groupId] = {
      ...existing,
      status: body.status ?? existing.status,
      currentQ: body.currentQ ?? existing.currentQ,
      totalQ: body.totalQ ?? existing.totalQ,
      wrongCount: body.wrongCount ?? existing.wrongCount,
      elapsedMs: body.elapsedMs !== undefined ? body.elapsedMs : existing.elapsedMs,
      penaltyMs: body.penaltyMs ?? existing.penaltyMs,
      finalMs: body.finalMs !== undefined ? body.finalMs : existing.finalMs,
      finishOrder,
      updatedAt: Date.now(),
    };

    broadcastState();
    res.json({ ok: true, team: state.session.teams[groupId] });
  });

  app.post('/api/classroom/teacher/start', (req, res) => {
    const body = req.body as { countdownSec?: number };
    const countdownSec = Math.max(0, Math.min(10, Number(body?.countdownSec ?? 3)));

    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }

    const now = Date.now();
    // Reset finished or idle teams cleanly for synchronized round if requested
    for (const id of GROUP_IDS) {
      const team = state.session.teams[id];
      if (team && team.status === 'FINISHED') {
        state.session.teams[id] = {
          ...team,
          status: 'READY',
          currentQ: 0,
          wrongCount: 0,
          elapsedMs: null,
          penaltyMs: 0,
          finalMs: null,
          finishOrder: null,
          updatedAt: now,
        };
      }
    }

    if (countdownSec === 0) {
      state.session.phase = 'ACTIVE';
      state.session.countdownEndsAt = null;
      state.session.startedAt = now;
      broadcastState();
      res.json({ ok: true, state });
      return;
    }

    const endsAt = now + countdownSec * 1000;
    state.session.phase = 'COUNTDOWN';
    state.session.countdownEndsAt = endsAt;
    state.session.startedAt = null;
    broadcastState();

    countdownTimer = setTimeout(() => {
      state.session.phase = 'ACTIVE';
      state.session.countdownEndsAt = null;
      state.session.startedAt = Date.now();
      broadcastState();
      countdownTimer = null;
    }, countdownSec * 1000);

    res.json({ ok: true, state });
  });

  app.post('/api/classroom/teacher/reset', (_req, res) => {
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
    state.session = {
      phase: 'LOBBY',
      countdownEndsAt: null,
      startedAt: null,
      teams: createInitialTeams(),
    };
    broadcastState();
    res.json({ ok: true, state });
  });

  app.post('/api/classroom/teacher/settings', (req, res) => {
    const incoming = req.body as Partial<GameSettings>;
    state.settings = {
      lockSeconds:
        typeof incoming.lockSeconds === 'number'
          ? Math.max(0, Math.min(10, incoming.lockSeconds))
          : state.settings.lockSeconds,
      penaltySeconds:
        typeof incoming.penaltySeconds === 'number'
          ? Math.max(0, Math.min(15, incoming.penaltySeconds))
          : state.settings.penaltySeconds,
      revealDelayMs:
        typeof incoming.revealDelayMs === 'number'
          ? Math.max(500, Math.min(4000, incoming.revealDelayMs))
          : state.settings.revealDelayMs,
      shoutWord:
        typeof incoming.shoutWord === 'string' && incoming.shoutWord.trim().length > 0
          ? incoming.shoutWord.trim().slice(0, 24)
          : state.settings.shoutWord,
      showContextHints:
        typeof incoming.showContextHints === 'boolean'
          ? incoming.showContextHints
          : state.settings.showContextHints,
    };
    broadcastState();
    res.json({ ok: true, settings: state.settings });
  });

  app.post('/api/classroom/teacher/content', (req, res) => {
    const body = req.body as {
      vocab?: VocabItem[];
      groups?: GroupDeck[];
      resetToDefaults?: boolean;
    };

    if (body.resetToDefaults) {
      const fresh = createDefaultState();
      state.vocab = fresh.vocab;
      state.groups = fresh.groups;
      broadcastState();
      res.json({ ok: true, state });
      return;
    }

    if (Array.isArray(body.vocab) && body.vocab.length > 0) {
      state.vocab = body.vocab;
    }
    if (Array.isArray(body.groups) && body.groups.length === GROUP_IDS.length) {
      state.groups = body.groups;
    }
    broadcastState();
    res.json({ ok: true, state });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
