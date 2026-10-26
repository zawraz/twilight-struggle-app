// Every word the app shows or announces, in Polish.

/** "1 rzut", "2 rzuty", "5 rzutów", "22 rzuty", "12 rzutów". */
export function rolls(n: number): string {
  const lastDigit = n % 10
  const lastTwo = n % 100
  if (n === 1) return '1 rzut'
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} rzuty`
  return `${n} rzutów`
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
  sides: { ussr: 'ZSRR', us: 'USA' },

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
