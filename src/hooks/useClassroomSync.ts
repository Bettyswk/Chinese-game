import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_GROUPS,
  DEFAULT_SETTINGS,
  DEFAULT_VOCAB,
} from '../data/curriculum.ts';
import type {
  ClassroomState,
  GameSettings,
  GroupDeck,
  TeamProgress,
  TeamStatus,
  VocabItem,
} from '../types/game.ts';

function buildFallbackTeams(): Record<number, TeamProgress> {
  const teams: Record<number, TeamProgress> = {};
  for (let i = 1; i <= 8; i++) {
    teams[i] = {
      groupId: i,
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

const FALLBACK_STATE: ClassroomState = {
  settings: DEFAULT_SETTINGS,
  vocab: DEFAULT_VOCAB,
  groups: DEFAULT_GROUPS,
  session: {
    phase: 'LOBBY',
    countdownEndsAt: null,
    startedAt: null,
    teams: buildFallbackTeams(),
  },
};

export function useClassroomSync() {
  const [state, setState] = useState<ClassroomState>(FALLBACK_STATE);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/classroom/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ClassroomState | null) => {
        if (active && data) {
          setState(data);
        }
      })
      .catch(() => {});

    const es = new EventSource('/api/classroom/events');
    es.onopen = () => {
      if (active) setConnected(true);
    };
    es.onmessage = (event) => {
      if (!active) return;
      try {
        const parsed = JSON.parse(event.data) as ClassroomState;
        setState(parsed);
        setConnected(true);
      } catch {
        // Ignore malformed SSE frame
      }
    };
    es.onerror = () => {
      if (active) setConnected(false);
    };

    return () => {
      active = false;
      es.close();
    };
  }, []);

  const updateTeam = useCallback(
    async (payload: {
      groupId: number;
      status: TeamStatus;
      currentQ: number;
      totalQ: number;
      wrongCount: number;
      elapsedMs: number | null;
      penaltyMs: number;
      finalMs: number | null;
    }) => {
      setState((prev) => ({
        ...prev,
        session: {
          ...prev.session,
          teams: {
            ...prev.session.teams,
            [payload.groupId]: {
              ...(prev.session.teams[payload.groupId] ?? {
                groupId: payload.groupId,
                finishOrder: null,
              }),
              ...payload,
              finishOrder:
                payload.status === 'FINISHED'
                  ? prev.session.teams[payload.groupId]?.finishOrder ?? null
                  : null,
              updatedAt: Date.now(),
            },
          },
        },
      }));

      try {
        await fetch('/api/classroom/team/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // Local optimistic state remains functional offline
      }
    },
    []
  );

  const triggerTeacherStart = useCallback(async (countdownSec = 3) => {
    try {
      await fetch('/api/classroom/teacher/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countdownSec }),
      });
    } catch {
      // Ignore network errors
    }
  }, []);

  const triggerTeacherReset = useCallback(async () => {
    try {
      await fetch('/api/classroom/teacher/reset', {
        method: 'POST',
      });
    } catch {
      // Ignore network errors
    }
  }, []);

  const updateSettings = useCallback(async (settings: Partial<GameSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
    try {
      await fetch('/api/classroom/teacher/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch {
      // Ignore network errors
    }
  }, []);

  const updateContent = useCallback(
    async (payload: {
      vocab?: VocabItem[];
      groups?: GroupDeck[];
      resetToDefaults?: boolean;
    }) => {
      try {
        const res = await fetch('/api/classroom/teacher/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = (await res.json()) as { state?: ClassroomState };
          if (json.state) {
            setState(json.state);
          }
        }
      } catch {
        // Ignore network errors
      }
    },
    []
  );

  return {
    state,
    connected,
    updateTeam,
    triggerTeacherStart,
    triggerTeacherReset,
    updateSettings,
    updateContent,
  };
}
