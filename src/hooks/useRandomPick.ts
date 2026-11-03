import { useState } from 'react'

/** Who came up, and whether everyone had a turn first (a new round began). */
export type RandomPick<TItem> = { item: TItem; restarted: boolean }

/** This round's picks for one class: who's had a turn, and who was last. */
type Round = { drawn: ReadonlySet<string>; lastId: string | null }

const EMPTY: Round = { drawn: new Set(), lastId: null }

// Each class's round, in memory only: it lasts while the app is open (across
// switching classes, and the presenter's class view coming and going) and is
// gone on reload. Never saved, so no student ids are left behind on a shared
// school computer.
const rounds = new Map<string, Round>()

/**
 * Picking at random, like drawing names from a hat: everyone comes up once
 * before anyone comes up again. Read through the list given, so students who
 * have left the roster (or groups that are gone) don't count.
 *
 * key names the hat: the class's id for its students, and something else
 * (`${classroomId}:groups`) for its groups, so the two rounds stay apart.
 */
export function useRandomPick<TItem extends { id: string }>(
  key: string,
  items: Array<TItem>,
) {
  // Mirrors this hat's entry in `rounds`, so a pick re-renders.
  const [state, setState] = useState(() => ({
    key,
    round: rounds.get(key) ?? EMPTY,
  }))
  const round = state.key === key ? state.round : (rounds.get(key) ?? EMPTY)

  function save(next: Round) {
    rounds.set(key, next)
    setState({ key, round: next })
  }

  const left = items.filter((s) => !round.drawn.has(s.id))

  /** Picks the next one, or null with nothing in the hat. */
  function draw(): RandomPick<TItem> | null {
    if (items.length === 0) return null
    const restarted = left.length === 0
    const hat = restarted ? items : left
    // Never the same one twice in a row (after a new round or Start over),
    // unless it's the only one.
    const pool = hat.length > 1 ? hat.filter((s) => s.id !== round.lastId) : hat
    const item = pool[Math.floor(Math.random() * pool.length)]
    save({
      drawn: new Set(restarted ? [item.id] : [...round.drawn, item.id]),
      lastId: item.id,
    })
    return { item, restarted }
  }

  /** Puts everyone back in the hat. */
  function reset() {
    save({ drawn: new Set(), lastId: round.lastId })
  }

  return { draw, reset, left: left.length, total: items.length }
}
