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
  cancel: 'Anuluj',
  sides: { ussr: 'ZSRR', us: 'USA' },
  tabs: { log: 'Dziennik', cards: 'Karty' },

  cards: {
    turn: 'Tura',
    turnOf: (n: number) => `Tura ${n} z 10`,
    nextTurn: 'Następna tura',
    /** The next-turn button for a while after a new turn: a tap takes it back. */
    undoTurn: 'Cofnij turę',
    reshuffled: (n: number) => `Przetasowano: wraca ${cards(n)}`,
    deckRanOut: 'Talia wyczerpana, nie ma czego przetasować',
    deck: 'Talia',
    deckCount: (n: number) => `Talia: ${cards(n)}`,
    inHand: 'Na ręce',
    pickTitle: {
      43: 'Negocjacje SALT: karta do ręki',
      77: '„Nie pytajcie…”: odrzucone karty',
      108: 'Teheran: odrzucone karty',
    },
    picked: (n: number, max: number) => `${n} / ${max}`,
    ok: 'OK',
    pick: (name: string) => `Wybierz: ${name}`,
    drewWithout: (n: number) => `Odrzucono ${cards(n)}, dobrano bez tasowania`,
    drewReshuffled: (n: number, back: number) => `Odrzucono ${cards(n)}, przetasowano: wraca ${cards(back)}`,
    tehran: (n: number, back: number) =>
      back > 0 ? `Przetasowano: wraca ${cards(back)}. Teheran: odrzucono ${cards(n)}` : `Teheran: odrzucono ${cards(n)}`,
    toHand: (name: string) => `Do ręki: ${name}`,
    nothingTaken: 'Negocjacje SALT: bez karty',
    states: { available: 'Dostępne', in_play: 'W grze', discarded: 'Odrzucone', removed: 'Usunięte' },
    withShuttle: 'z kartą w grze',
    state: { available: 'dostępna', in_play: 'w grze', discarded: 'odrzucona', removed: 'usunięta' },
    counts: 'Stan kart',
    countFor: (state: string, ussr: number, us: number, neutral: number) =>
      `${state}: ZSRR ${ussr}, USA ${us}, neutralne ${neutral}`,
    withInPlay: (count: string) => `${count}; w grze: Dyplomacja Wahadłowa`,
    sides: { ussr: 'ZSRR', us: 'USA', neutral: 'N' },
    phases: { early: 'Początek', mid: 'Apogeum', late: 'Schyłek' },
    filters: 'Filtry',
    filterGroups: { player: 'Strona', phase: 'Faza', state: 'Stan', value: 'PO', order: 'Układ', screen: 'Ekran', swipe: 'Gest' },
    clearFilters: 'Wyczyść',
    playedLast: 'Zagrane na dół',
    handFirst: 'Na ręce na górę',
    /** The order chips' visible labels: their arrows say which way. */
    playedLastShort: 'Zagrane',
    handFirstShort: 'Na ręce',
    singleScreen: 'Jeden ekran',
    multiScreen: 'Dwa ekrany',
    /** The screen chips' visible labels: their icons show the footer or its absence. */
    singleScreenShort: 'Jeden',
    multiScreenShort: 'Dwa',
    swipeCards: 'Przesunięcie zmienia kartę',
    swipeScreens: 'Przesunięcie zmienia ekran',
    /** The swipe chips' visible labels: what a sideways swipe moves. */
    swipeCardsShort: 'Karty',
    swipeScreensShort: 'Ekrany',
    /** The footer tabs of the two-screen mode, each showing one half of the list; not shown, the tabs carry icons. */
    piles: { available: 'Dostępne / W grze', played: 'Odrzucone / Usunięte' },
    list: 'Karty',
    noMatches: 'Brak kart',
    scoring: '–',
    ops: (value: number) => (value === 0 ? 'karta punktacji' : `${value} PO`),
    important: 'Ważna',
    permanent: 'Usuwana po zagraniu zdarzenia',
    discard: (name: string) => `Odrzuć: ${name}`,
    remove: (name: string) => `Usuń: ${name}`,
    putInPlay: (name: string) => `Zagraj zdarzenie, zostaje w grze: ${name}`,
    restore: (name: string) => `Przywróć: ${name}`,
    restoreLabel: 'Przywróć',
    changed: (name: string, state: string) => `${name}: ${state}`,
  },

  fourOps: {
    title: 'Karty 4 PO',
    add: (side: string) => `Dodaj kartę 4 PO: ${side}`,
    remove: (side: string) => `Odejmij kartę 4 PO: ${side}`,
    count: (side: string) => `Zagrane karty 4 PO: ${side}`,
    whoPlayed: 'Kto zagrał kartę 4 PO?',
    playedBy: (text: string, side: string) => `${text} (${side})`,
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
