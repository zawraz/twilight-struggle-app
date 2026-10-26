// Every word the app shows or announces, in Polish.

/** "1 rzut", "2 rzuty", "5 rzutów", "22 rzuty", "12 rzutów". */
export function rolls(n: number): string {
  const lastDigit = n % 10
  const lastTwo = n % 100
  if (n === 1) return '1 rzut'
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} rzuty`
  return `${n} rzutów`
}

/** "1 karta", "2 karty", "5 kart", "22 karty", "12 kart". */
export function cards(n: number): string {
  const lastDigit = n % 10
  const lastTwo = n % 100
  if (n === 1) return '1 karta'
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} karty`
  return `${n} kart`
}

/** Text for one roll-tracking section; each function takes the side's label (ZSRR, USA). */
export interface TrackerCopy {
  title: string
  wheel: (side: string) => string
  submit: (side: string) => string
  /** The same button while its cooldown runs: a tap takes the roll back. */
  undo: (side: string) => string
  log: (side: string) => string
  result: string
  resultFor: (side: string) => string
}

export const copy = {
  appTitle: 'Twilight Struggle',
  end: 'Zakończ grę',
  newGame: 'Nowa gra',
  confirmQuestion: 'Potwierdź?',
  undo: 'Cofnij',
  sides: { ussr: 'ZSRR', us: 'USA' },
  tabs: { log: 'Dziennik', cards: 'Karty' },

  cards: {
    turn: 'Tura',
    turnOf: (n: number) => `Tura ${n} z 10`,
    nextTurn: 'Następna tura',
    previousTurn: 'Poprzednia tura',
    reshuffled: (n: number) => `Przetasowano: wraca ${cards(n)}`,
    deck: 'Talia',
    deckCount: (n: number) => `Talia: ${cards(n)}`,
    inHand: 'Na ręce',
    states: { available: 'Dostępne', discarded: 'Odrzucone', removed: 'Usunięte' },
    state: { available: 'dostępna', discarded: 'odrzucona', removed: 'usunięta' },
    counts: 'Stan kart',
    countFor: (state: string, ussr: number, us: number, neutral: number) =>
      `${state}: ZSRR ${ussr}, USA ${us}, neutralne ${neutral}`,
    sides: { ussr: 'ZSRR', us: 'USA', neutral: 'N' },
    phases: { early: 'Początek', mid: 'Apogeum', late: 'Schyłek' },
    filters: 'Filtry',
    filterGroups: { player: 'Strona', phase: 'Faza', state: 'Stan', value: 'PO' },
    clearFilters: 'Wyczyść',
    playedLast: 'Zagrane na dół',
    handFirst: 'Na ręce na górę',
    list: 'Karty',
    noMatches: 'Brak kart',
    scoring: '–',
    ops: (value: number) => (value === 0 ? 'karta punktacji' : `${value} PO`),
    important: 'Ważna',
    permanent: 'Usuwana po zagraniu zdarzenia',
    discard: (name: string) => `Odrzuć: ${name}`,
    remove: (name: string) => `Usuń: ${name}`,
    restore: (name: string) => `Przywróć: ${name}`,
    restoreLabel: 'Przywróć',
    changed: (name: string, state: string) => `${name}: ${state}`,
  },

  fourOps: {
    title: 'Karty 4 PO',
    add: (side: string) => `Dodaj kartę 4 PO: ${side}`,
    remove: (side: string) => `Odejmij kartę 4 PO: ${side}`,
    count: (side: string) => `Zagrane karty 4 PO: ${side}`,
  },

  success: {
    title: 'Rzuty na sukces',
    wheel: (side) => `Rzut na sukces: ${side}`,
    submit: (side) => `Potwierdź rzut na sukces: ${side}`,
    undo: (side) => `Cofnij rzut na sukces: ${side}`,
    log: (side) => `Ostatnie rzuty na sukces: ${side}`,
    result: 'Suma',
    resultFor: (side) => `Suma: ${side}`,
  } satisfies TrackerCopy,

  dice: {
    title: 'EV rzutów',
    wheel: (side) => `Rzut kością: ${side}`,
    submit: (side) => `Potwierdź rzut kością: ${side}`,
    undo: (side) => `Cofnij rzut kością: ${side}`,
    log: (side) => `Ostatnie rzuty kością: ${side}`,
    result: 'Średnia',
    resultFor: (side) => `Średnia: ${side}`,
  } satisfies TrackerCopy,

  lastRolls: 'Ostatnie 3 rzuty:',
  noRolls: 'Brak rzutów',
  added: (value: string) => `Dodano ${value}`,
  undone: (value: string) => `Cofnięto ${value}`,
}
