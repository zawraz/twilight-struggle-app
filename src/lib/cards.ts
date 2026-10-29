// Every card on the Polish checklist ("Zimna Wojna", 3rd edition), in its order.
// The China Card never enters the deck, so it is not here.

export type Phase = 'early' | 'mid' | 'late'
export type CardSide = 'ussr' | 'us' | 'neutral'

export interface Card {
  /** Official GMT card number. */
  id: number
  /** Position on the checklist: the list's default order. */
  order: number
  /** Official English name in kebab-case. */
  stub: string
  /** Bold on the checklist. */
  important: boolean
  /** Polish name as on the checklist, without the asterisk. */
  name: string
  /** Ops value; 0 for scoring cards. */
  value: number
  phase: Phase
  player: CardSide
  /** Asterisk on the checklist: removed from the game once played as an event. */
  isPermanent: boolean
}

export const PHASES: readonly Phase[] = ['early', 'mid', 'late']
export const CARD_SIDES: readonly CardSide[] = ['ussr', 'us', 'neutral']

/** The turn each phase's cards join the draw deck. */
export const PHASE_START: Record<Phase, number> = { early: 1, mid: 4, late: 8 }

const R = 'ussr'
const U = 'us'
const N = 'neutral'

// [id, stub, name, side, value, asterisk, bold] — one row per checklist line.
type Row = [number, string, string, CardSide, number, boolean, boolean]

const EARLY: Row[] = [
  [3, 'middle-east-scoring', 'Kulminacja napięć na Bliskim Wschodzie', N, 0, false, false],
  [1, 'asia-scoring', 'Kulminacja napięć w Azji', N, 0, false, false],
  [2, 'europe-scoring', 'Kulminacja napięć w Europie', N, 0, false, false],
  [10, 'blockade', 'Blokada', R, 1, true, true],
  [19, 'truman-doctrine', 'Doktryna Trumana', U, 1, true, false],
  [32, 'un-intervention', 'Interwencja ONZ', N, 1, false, false],
  [12, 'romanian-abdication', 'Michał I Rumuński Abdykuje', R, 1, true, false],
  [15, 'nasser', 'Nasser', R, 1, true, false],
  // Not in the GMT 1–110 numbering: numbered after it.
  [111, 'baghdad-pact', 'Pakt Bagdadzki', U, 1, true, false],
  [18, 'captured-nazi-scientist', 'Schwytanie nazistowskich naukowców', N, 1, true, false],
  [26, 'cia-created', 'Utworzenie CIA', U, 1, true, true],
  [30, 'decolonization', 'Dekolonizacja', R, 2, false, false],
  [8, 'fidel', 'Fidel', R, 2, true, false],
  [20, 'olympic-games', 'Igrzyska Olimpijskie', N, 2, false, false],
  [22, 'independent-reds', 'Niezależni Komuniści', U, 2, true, false],
  [105, 'special-relationship', 'Niezwykłe relacje', U, 2, false, false],
  [9, 'vietnam-revolts', 'Rewolty w Wietnamie', R, 2, true, false],
  [35, 'formosan-resolution', 'Rezolucja w sprawie obrony Tajwanu', U, 2, true, false],
  [104, 'the-cambridge-five', 'Siatka szpiegowska z Cambridge', R, 2, false, false],
  [24, 'indo-pakistani-war', 'Wojna Indyjsko-Pakistańska', N, 2, false, false],
  [13, 'arab-israeli-war', 'Wojna Izraelsko-Arabska', R, 2, false, false],
  [11, 'korean-war', 'Wojna w Korei', R, 2, true, false],
  [103, 'defectors', 'Zdrajcy', U, 2, false, false],
  [17, 'de-gaulle-leads-france', 'De Gaulle dochodzi do władzy we Francji', R, 3, true, false],
  [33, 'de-stalinization', 'Destalinizacja', R, 3, true, false],
  [25, 'containment', 'Doktryna Powstrzymywania', U, 3, true, false],
  [4, 'duck-and-cover', 'Kampania „Duck and Cover”', U, 3, false, true],
  [28, 'suez-crisis', 'Kryzys Sueski', R, 3, true, false],
  [29, 'east-european-unrest', 'Niepokoje w Europie Wschodniej', U, 3, false, false],
  [106, 'norad', 'NORAD', U, 3, true, false],
  [5, 'five-year-plan', 'Plan Pięcioletni', U, 3, false, true],
  [14, 'comecon', 'RWPG', R, 3, true, false],
  [7, 'socialist-governments', 'Rządy Socjalistów', R, 3, false, false],
  [16, 'warsaw-pact-formed', 'Utworzenie Układu Warszawskiego', R, 3, true, false],
  [31, 'red-scare-purge', 'Czerwona panika/Czystki', N, 4, false, false],
  [21, 'nato', 'NATO', U, 4, true, false],
  [23, 'marshall-plan', 'Plan Marshalla', U, 4, true, false],
  [27, 'us-japan-mutual-defense-pact', 'Traktat o bezpieczeństwie USA i Japonii', U, 4, true, false],
  [34, 'nuclear-test-ban', 'Zakaz prób jądrowych', N, 4, false, false],
]

const MID: Row[] = [
  [79, 'africa-scoring', 'Kulminacja napięć w Afryce', N, 0, false, false],
  [81, 'south-america-scoring', 'Kulminacja napięć w Ameryce Południowej', N, 0, false, false],
  [37, 'central-america-scoring', 'Kulminacja napięć w Ameryce Środkowej', N, 0, false, false],
  [38, 'southeast-asia-scoring', 'Kulminacja napięć w Azji Płd.-Wsch.', N, 0, true, false],
  [54, 'allende', 'Allende', R, 1, true, false],
  [70, 'oas-founded', 'Powołanie OPA', U, 1, true, false],
  [48, 'kitchen-debates', 'Rozmowy kuchenne', U, 1, true, false],
  [45, 'summit', 'Rozmowy na Szczycie', N, 1, false, false],
  [72, 'sadat-expels-soviets', 'Sadat wyrzuca Sowietów', U, 1, true, false],
  [62, 'lone-gunman', 'Samotny Strzelec', R, 1, true, true],
  [64, 'panama-canal-returned', 'Zwrot Kanału Panamskiego', U, 1, true, false],
  [41, 'nuclear-subs', 'Atomowe łodzie podwodne', U, 2, true, false],
  [74, 'the-voice-of-america', 'Głos Ameryki', U, 2, false, false],
  [68, 'john-paul-ii-elected-pope', 'Jan Paweł II Wybrany Papieżem', U, 2, true, false],
  [47, 'junta', 'Junta', N, 2, false, false],
  [108, 'our-man-in-tehran', 'Nasz człowiek w Teheranie', U, 2, true, false],
  [53, 'south-african-unrest', 'Niepokoje w Afryce Południowej', R, 2, false, false],
  [65, 'camp-david-accords', 'Porozumienie Camp David', U, 2, true, false],
  [63, 'colonial-rear-guards', 'Ruchy Antykolonialne', U, 2, false, false],
  [66, 'puppet-governments', 'Rządy Marionetkowe', U, 2, true, false],
  [67, 'grain-sales-to-soviets', 'Sprzedaż Zboża Sowietom', U, 2, false, true],
  [69, 'latin-american-death-squads', 'Szwadrony Śmierci w Ameryce Łacińskiej', N, 2, false, false],
  [75, 'liberation-theology', 'Teologia Wyzwolenia', R, 2, false, false],
  [52, 'portuguese-empire-crumbles', 'Upadek Imperium Portugalskiego', R, 2, true, false],
  [55, 'willy-brandt', 'Willy Brandt', R, 2, true, false],
  [71, 'nixon-plays-the-china-card', 'Wizyta Nixona w Chinach', U, 2, true, false],
  [49, 'missile-envy', 'Zazdrość o rakiety „Missile Envy”', N, 2, false, true],
  [46, 'how-i-learned-to-stop-worrying', '„Jak przestałem się martwić…”', N, 2, true, false],
  [80, 'one-small-step', '„Jeden mały krok…”', N, 2, false, false],
  [42, 'quagmire', 'Bagno', R, 3, true, false],
  [107, 'che', 'Che', R, 3, false, false],
  [51, 'brezhnev-doctrine', 'Doktryna Breżniewa', R, 3, true, false],
  [73, 'shuttle-diplomacy', 'Dyplomacja Wahadłowa', U, 3, false, false],
  [60, 'u2-incident', 'Incydent z U2', R, 3, true, false],
  [76, 'ussuri-river-skirmish', 'Konflikt nad Ussuri', U, 3, true, false],
  [36, 'brush-war', 'Konflikt zbrojny', N, 3, false, false],
  [40, 'cuban-missile-crisis', 'Kryzys kubański', N, 3, true, false],
  [43, 'salt-negotiations', 'Negocjacje SALT', N, 3, true, false],
  [44, 'bear-trap', 'Niedźwiedź w Potrzasku', U, 3, true, false],
  [61, 'opec', 'OPEC', R, 3, false, false],
  [58, 'cultural-revolution', 'Rewolucja Kulturalna', R, 3, true, false],
  [78, 'alliance-for-progress', 'Sojusz dla postępu', U, 3, true, false],
  [39, 'arms-race', 'Wyścig zbrojeń', N, 3, false, false],
  [77, 'ask-not-what-your-country-can-do-for-you', '„Nie pytajcie co wasz kraj może zrobić dla was…”', U, 3, true, false],
  [59, 'flower-power', 'Dzieci Kwiaty', R, 4, true, false],
  [50, 'we-will-bury-you', 'Pogrzebiemy Was', R, 4, true, true],
  [56, 'muslim-revolution', 'Rewolucja Muzułmańska', R, 4, false, false],
  [57, 'abm-treaty', 'Traktat ABM', N, 4, false, false],
]

const LATE: Row[] = [
  [93, 'iran-contra-scandal', 'Afera Iran-Contras', R, 2, true, false],
  [85, 'star-wars', 'Gwiezdne Wojny', U, 2, true, true],
  [109, 'yuri-and-samantha', 'Jurij i Samantha', R, 2, true, false],
  [95, 'latin-american-debt-crisis', 'Kryzys kredytowy w Ameryce Łacińskiej', R, 2, false, false],
  [91, 'ortega-elected-in-nicaragua', 'Ortega wybrany w Nikaragui', R, 2, true, true],
  [84, 'reagan-bombs-libya', 'Reagan Bombarduje Libię', U, 2, true, false],
  [101, 'solidarity', 'Solidarność', U, 2, true, false],
  // Not in the GMT 1–110 numbering: numbered after it.
  [112, 'martial-law', 'Stan Wojenny', R, 2, true, false],
  [92, 'terrorism', 'Terroryzm', N, 2, false, true],
  [102, 'iran-iraq-war', 'Wojna Iracko-Irańska', N, 2, true, false],
  [88, 'marine-barracks-bombing', 'Zamach bombowy na koszary Marines', R, 2, true, false],
  [98, 'aldrich-ames-remix', 'Aldrich Ames', R, 3, true, true],
  [82, 'iranian-hostage-crisis', 'Atak na ambasadę w Teheranie', R, 3, true, false],
  [94, 'chernobyl', 'Czarnobyl', U, 3, true, false],
  [97, 'an-evil-empire', 'Imperium Zła', U, 3, true, false],
  [87, 'the-reformer', 'Reformator', R, 3, true, false],
  [86, 'north-sea-oil', 'Ropa na Morzu Północnym', U, 3, true, false],
  [99, 'pershing-ii-deployed', 'Rozmieszczenie rakiet Pershing II', R, 3, true, false],
  [110, 'awacs-sale-to-saudis', 'Sprzedaż AWACS Saudyjczykom', U, 3, true, false],
  [83, 'the-iron-lady', 'Żelazna Dama', U, 3, true, false],
  [96, 'tear-down-this-wall', '„Zburzcie ten mur”', U, 3, true, true],
  [100, 'wargames', 'Gry Wojenne', N, 4, true, true],
  [90, 'glasnost', 'Głasnost', R, 4, true, false],
  [89, 'soviets-shoot-down-kal-007', 'Sowieci strącają KAL-007', U, 4, true, true],
]

export const CARDS: readonly Card[] = (
  [
    ['early', EARLY],
    ['mid', MID],
    ['late', LATE],
  ] as const
).flatMap(([phase, rows]) => rows.map((row) => ({ phase, row })))
  .map(({ phase, row: [id, stub, name, player, value, isPermanent, important] }, index) => ({
    id,
    order: index + 1,
    stub,
    important,
    name,
    value,
    phase,
    player,
    isPermanent,
  }))

/** Whether a phase's cards have joined the deck by this turn. */
export const phaseStarted = (phase: Phase, turn: number) => turn >= PHASE_START[phase]
