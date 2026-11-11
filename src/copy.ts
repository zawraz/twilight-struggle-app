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
  /** The one wheel both players submit from. */
  wheel: string
  submit: (side: string) => string
  log: (side: string) => string
  result: string
  resultFor: (side: string) => string
}

export const copy = {
  appTitle: 'Zimna Wojna',
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
    reshuffled: (n: number) => `Przetasowano: wraca ${cards(n)}`,
    deckRanOut: 'Talia wyczerpana, nie ma czego przetasować',
    deck: 'Talia',
    deckCount: (n: number) => `Talia: ${cards(n)}`,
    inHand: 'Na ręce',
    /** A card this player marked as held, with a long press; seen on this device only. */
    myHand: 'Na mojej ręce',
    /** A card this player marked as held by the other player, with a shorter hold; seen on this device only. */
    theirHand: 'Na ręce przeciwnika',
    pickTitle: {
      43: 'Negocjacje SALT: karta do ręki',
      77: '„Nie pytajcie…”: odrzucone karty',
      108: 'Teheran: odrzucone karty',
      26: 'Utworzenie CIA: karty na ręce przeciwnika',
      62: 'Samotny Strzelec: karty na ręce przeciwnika',
      98: 'Aldrich Ames: karty na ręce przeciwnika',
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
    seenInHand: (n: number) => `Na ręce przeciwnika: ${cards(n)}`,
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
    showHand: 'Pokaż karty na ręce',
    filterGroups: { player: 'Strona', phase: 'Faza', state: 'Stan', order: 'Układ', screen: 'Ekran', swipe: 'Gest', look: 'Karty', hold: 'Ręka' },
    clearFilters: 'Wyczyść',
    playedLast: 'Zagrane na dół',
    /** The order chip's visible label: its arrow says which way. */
    playedLastShort: 'Zagrane',
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
    shortHoldTheirs: 'Krótkie przytrzymanie: na ręce przeciwnika',
    shortHoldMine: 'Krótkie przytrzymanie: na mojej ręce',
    /** The hold chips' visible labels: whose hand a short hold marks a card as in. */
    shortHoldTheirsShort: 'Przeciwnik',
    shortHoldMineShort: 'Moja',
    dimPlayed: 'Przyciemnij zagrane',
    /** The dimming chip's visible label. */
    dimPlayedShort: 'Przyciemnij',
    /** The footer tabs of the two-screen mode, each showing one half of the list; not shown, the tabs carry icons. */
    piles: { available: 'Dostępne / W grze', played: 'Odrzucone / Usunięte' },
    /** Swiping between the screens, the hand is a third one, after both halves of the list. */
    handScreen: 'Karty na ręce',
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
    /** The header strip with the last card played, from either phone. */
    lastAction: 'Ostatni ruch',
    noLastAction: 'Brak',
    undoLast: (what: string) => `Cofnij: ${what}`,
  },

  /** New Game's question: a game on this phone alone, or the one both phones share. */
  newGameDialog: {
    title: 'Nowa gra',
    offline: 'Offline',
    offlineHint: 'Gra tylko na tym telefonie',
    online: 'Online',
    onlineHint: 'Wspólna gra na obu telefonach. Zastępuje obecną grę online.',
    cancel: 'Anuluj',
  },

  /** The people icon: this phone's sync, and the way into the online game. */
  sync: {
    open: 'Wspólna gra',
    title: 'Wspólna gra',
    close: 'Zamknij',
    online: 'Ten telefon: online',
    offline: 'Ten telefon: offline',
    connected: 'Połączono',
    disconnected: 'Brak połączenia: zmiany zostaną wysłane po powrocie',
    loading: 'Wczytywanie gry, zmiany na razie zablokowane',
    missing: 'Na serwerze nie ma gry online',
    leave: 'Wyłącz synchronizację',
    left: 'Synchronizacja wyłączona: grasz offline',
    checking: 'Sprawdzanie gry online…',
    none: 'Nie ma gry online. Zacznij ją przez Nowa gra → Online.',
    /** An ended online game can't be joined: there is nothing left to play. */
    ended: (turn: number) => `Gra online zakończona (tura ${turn}). Nową zaczniesz przez Nowa gra → Online.`,
    unreachable: 'Brak połączenia z serwerem',
    found: (turn: number, ago: string) => `Gra online: tura ${turn}, ostatnia zmiana ${ago}`,
    ago: (minutes: number) =>
      minutes < 1 ? 'przed chwilą' : minutes < 60 ? `${minutes} min temu` : `${Math.floor(minutes / 60)} godz. temu`,
    join: 'Dołącz',
    joinWarning: 'Gra na tym telefonie zostanie zastąpiona i nie da się jej odzyskać.',
    joined: 'Dołączono do gry online',
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
    wheel: 'Rzut na sukces',
    submit: (side) => `Potwierdź rzut na sukces: ${side}`,
    log: (side) => `Ostatnie rzuty na sukces: ${side}`,
    result: 'Suma',
    resultFor: (side) => `Suma: ${side}`,
  } satisfies TrackerCopy,

  dice: {
    title: 'Zwykłe rzuty',
    wheel: 'Rzut kością',
    submit: (side) => `Potwierdź rzut kością: ${side}`,
    log: (side) => `Ostatnie rzuty kością: ${side}`,
    result: 'Średnia',
    resultFor: (side) => `Średnia: ${side}`,
  } satisfies TrackerCopy,

  lastRolls: 'Ostatnie 3 rzuty:',
  noRolls: 'Brak rzutów',
  added: (value: string) => `Dodano ${value}`,
}
