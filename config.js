// =====================================================================
//  BACKPACK RPG — КОНФИГ ПРОТОТИПА
//  Здесь все числа, карты, оружие, герои, враги, бои и переключатели тестов.
//  Править можно прямо на github.com: открыть файл → карандаш → Save (Commit).
//  Правила: текст в "кавычках", числа без кавычек, true/false без кавычек,
//  после каждого поля запятая. Строки, начинающиеся с //, — комментарии.
//  Быстрые правки во время сессии — кнопка «Настройки» в игре (у хоста).
// =====================================================================
window.GAME_CONFIG = {
  // Версия конфига. Если поменялась, старые «Настройки» хоста из браузера не применяются (иначе в них нет новых полей).
  version: 4,

  // ---------- Базовые правила боя ----------
  rules: {
    cols: 6, rows: 2,            // поле врагов 6×2: 6 колонок по 2 клетки (передняя и задняя строго друг за другом)
    handSize: 4,                 // добор руки до N карт в начале хода (рука рассчитана на 4 карты, больше — карты накладываются)
    energy: 3,                   // энергия героя каждый ход
    minDeck: 10,                 // минимум карт в колоде; недобор = слабые удары
    fillerCard: "weak_strike",   // какой картой добивать колоду до минимума
    critMultiplier: 2,           // множитель крита
    conditionalCrit: true,       // x2 по оглушённому или вытолкнутому в этот ход
    collisionDamage: 3,          // урон при столкновении после толчка (обоим)
    // РЕШЕНО: мили (и герои, и враги) бьют только ОТКРЫТЫХ — тех, кого никто не прикрывает спереди.
    // РЕШЕНО (17.10): хексы смотрят на героев ровной стороной, задний враг стоит прямо за передним в своей колонке
    // и закрыт, только если клетка прямо перед ним занята. Соседние колонки сдвинуты на полхекса (0, 2, 4 ближе к героям).
    // Героев никто не прикрывает: враги-дальники и открытые враги-мили бьют их свободно.
    // Враги не шагают: стоят на месте (шаг как часть скилла — на будущее).
    enemyStepDelayMs: 900,       // пауза между действиями врагов (мс), чтобы было видно, кто что сделал
    hpCarriesOver: true,         // ХП переносится между боями (лечения нет)
    reviveHp: 20                 // павший герой встаёт к следующему бою с таким ХП (заглушка: смерть героя ещё не решена)
  },

  // ---------- Переключатели тестов ----------
  tests: {
    // Цели врагов: "A" — коридоры: враг бьёт героя своего коридора (по 2 колонки на героя, подсвечены цветом),
    //              "B" — любой враг может выбрать любого героя (случайно).
    enemyTargeting: "A",

    // Мердж = передача: перетащить свою карту на карту в руке союзника.
    // mode "add"  — карта союзника получает урон/блок твоей карты;
    // mode "flat" — карта союзника получает +flatBonus к урону и блоку.
    // payCost — платишь ли ты энергию своей карты за мердж.
    // costGrowth — растущая стоимость мерджа за ход (сбрасывается каждый ход, работает при payCost: true):
    //   "off"   — мердж стоит как карта;
    //   "hero"  — у каждого героя свой счётчик: n-й мердж героя за ход = стоимость карты + (n − 1);
    //   "party" — общий счётчик пати: n-й мердж за ход стоит n энергии (1, 2, 3…), стоимость карты не важна.
    // Стоимость мерджа видна фиолетовым ромбом в правом верхнем углу карт союзника, когда берёшь карту.
    merge: { enabled: true, mode: "add", payCost: true, flatBonus: 3, costGrowth: "off" },

    // Общая колода: карты оружия и щита остаются у своего героя, все остальные (кооп-карты, слабые удары,
    // особые карты) лежат в одной общей колоде. Герой добирает руку случайно из «своё + общее» (шанс по количеству).
    // Сыгранная общая карта уходит в общий сброс. minDeck — минимум общей колоды, недобор = слабые удары.
    // Карты героя подсвечены его цветом, общие — бирюзовой полосой «общая».
    sharedDeck: { enabled: false, minDeck: 12 },

    // Особые карты («Единение», «Клятвы»): perFight разных карт за бой на всю пати, без копий,
    // каждая — случайному герою (или в общую колоду). Берутся из pool, только те, чей тест включён.
    specialCards: { perFight: 1, pool: ["unity", "oath_hunt", "oath_wall"] },

    // Задача пати на бой: у каждого боя есть задача (см. tasks и encounters), бонус всем.
    partyTask: { enabled: true },

    // Общий пул энергии — только как эффект карты «Единение» (раздаётся как особая карта, см. specialCards).
    sharedPool: { enabled: true },

    // Карты-квесты «Клятва…» (раздаются как особые карты, см. specialCards).
    questCards: { enabled: true }
  },

  // ---------- Фигуры массовых атак ----------
  // Каждая фигура — список «шагов» от клетки прицела. [] — сама клетка, [0] — соседняя по направлению 0,
  // [0,0] — через одну, [1] — соседняя, повёрнутая на 60°. Направления: 0 ↗, 1 ↑ (назад), 2 ↖, 3 ↙, 4 ↓ (вперёд), 5 ↘. Игрок крутит фигуру правой кнопкой мыши.
  shapes: {
    line2: { name: "линия из 2 клеток", steps: [[], [0]] },
    line3: { name: "линия из 3 клеток", steps: [[], [0], [0, 0]] },
    tri:   { name: "треугольник из 3 клеток", steps: [[], [0], [1]] },
    fan:   { name: "веер из 3 клеток", steps: [[], [5], [1]] }
  },

  // ---------- Карты ----------
  // target: "enemy" — враг | "cell" — любая клетка поля | "self" — себя
  //         "hero" — себя или союзника | "ally" — только союзника | "none" — без цели
  // attack: "melee" (только открытые враги) | "ranged" | "aoe"
  // area:   "single" | "adjacent" (клетка + все соседи) | "shape" (фигура из shapes, крутится ПКМ)
  //         "line" — цель + враг за ней; если за целью край поля — рикошет в тот же ряд соседней колонки
  //                  (стрелок справа — влево, слева — вправо, ровно напротив — в обе стороны)
  // shape:  id фигуры из shapes (для area: "shape")
  // icon:   картинка на карте (см. js/icons.js). Цвет картинки — по типу карты: мили красный, дальний зелёный,
  //         массовка оранжевый, блок синий, кооп золотой, особые фиолетовый, слабый удар серый.
  // effects: damage {amount, hits} | block {amount} | push | stun | taunt | cleanse
  //          blockSelf {amount} (блок себе) | draw {amount} | energy {amount} | sharedPool | quest {id}
  // isNew:  true — значок 🆕 на странице «Карты» (cards.html): карта добавлена по заявке и ещё тестируется
  // added:  "17.10.2026" — когда добавлена (видно в подробностях карты на странице «Карты»)
  // Все карты удобно смотреть на странице «Карты»: https://eclipse130300.github.io/backpack-proto/cards.html
  cards: {
    weak_strike:   { name: "Слабый удар",       cost: 1, icon: "fist",   target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 3 }] },

    // Меч
    cleave:        { name: "Рубящий удар",      cost: 1, icon: "slash",  target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 6 }] },
    sweep:         { name: "Размах",            cost: 2, icon: "sweep",  target: "cell",  attack: "aoe", area: "shape", shape: "line2", effects: [{ type: "damage", amount: 8 }] },
    crush:         { name: "Сокрушение",        cost: 2, icon: "crush",  target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 13 }] },

    // Щит
    shield_bash:   { name: "Удар щитом",        cost: 1, icon: "bash",   target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 4 }, { type: "push" }] },
    shield_wall:   { name: "Стена щитов",       cost: 1, icon: "shield", target: "self",  effects: [{ type: "block", amount: 7 }] },

    // Посох
    bolt:          { name: "Разряд",            cost: 1, icon: "bolt",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 5 }] },
    fireball:      { name: "Огненный шар",      cost: 2, icon: "fire",   target: "cell",  attack: "aoe", area: "shape", shape: "tri", effects: [{ type: "damage", amount: 6 }] },
    stun_bolt:     { name: "Оглушающий разряд", cost: 2, icon: "stun",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }, { type: "stun" }] },
    flame_wall:    { name: "Стена огня",        cost: 2, icon: "flames", target: "cell",  attack: "aoe", area: "shape", shape: "line3", effects: [{ type: "damage", amount: 6 }] },
    nova:          { name: "Огненное кольцо",   cost: 2, icon: "nova",   target: "cell",  attack: "aoe", area: "adjacent", effects: [{ type: "damage", amount: 6 }] },

    // Лук
    double_shot:   { name: "Двойной выстрел",   cost: 1, icon: "arrows", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3, hits: 2 }] },
    pierce_arrow:  { name: "Пробивающая стрела", cost: 2, icon: "pierce", target: "enemy", attack: "ranged", area: "line", effects: [{ type: "damage", amount: 7 }] },
    knock_arrow:   { name: "Отбрасывающая стрела", cost: 1, icon: "knock", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }, { type: "push" }] },
    arrow_rain:    { name: "Град стрел",        cost: 2, icon: "rain",   target: "cell",  attack: "aoe", area: "shape", shape: "fan", effects: [{ type: "damage", amount: 6 }] },
    aimed_shot:    { name: "Прицельный выстрел", cost: 2, icon: "aim",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 10 }] },

    // Кооп-сейвы
    cover:         { name: "Прикрыть",          cost: 1, icon: "cover",   target: "hero",  effects: [{ type: "block", amount: 6 }] },
    challenge:     { name: "Вызов",             cost: 1, icon: "taunt",   target: "enemy", attack: "ranged", effects: [{ type: "taunt" }, { type: "blockSelf", amount: 4 }] },
    purify:        { name: "Очищение",          cost: 1, icon: "purify",  target: "hero",  effects: [{ type: "cleanse" }, { type: "block", amount: 3 }] },
    barrier:       { name: "Барьер",            cost: 1, icon: "barrier", target: "hero",  effects: [{ type: "block", amount: 5 }] },

    // Тестовые карты (попадают в колоды, только если тест включён)
    unity:         { name: "Единение",          cost: 0, icon: "unity", target: "none",  effects: [{ type: "sharedPool" }], note: "Остаток энергии всех героев складывается, любой тратит из пула" },
    oath_hunt:     { name: "Клятва охотника",   cost: 0, icon: "oath",  target: "none",  effects: [{ type: "quest", id: "kill2_turn" }] },
    oath_wall:     { name: "Клятва стены",      cost: 0, icon: "oath",  target: "none",  effects: [{ type: "quest", id: "block_all_turn" }] }
  },

  // ---------- Оружие и щиты (главный источник карт) ----------
  // РЕШЕНО: щит — отдельный тип снаряжения. Оружием наносишь урон, щитом защищаешься.
  // kind: "weapon" — оружие | "shield" — щит. icon — значок у героя (см. js/icons.js).
  // critEvery — крит раз в N ударов этим оружием; счётчик живёт весь бой. Сколько осталось — пишется на карте. 0 — без крита.
  // Пока щит только у милишника (щиты разберём позже).
  weapons: {
    sword:  { name: "Меч",   kind: "weapon", icon: "w_sword",  critEvery: 3, cards: { cleave: 2, sweep: 1, crush: 1 } },
    shield: { name: "Щит",   kind: "shield", icon: "w_shield", critEvery: 0, cards: { shield_bash: 1, shield_wall: 1 } },
    staff:  { name: "Посох", kind: "weapon", icon: "w_staff",  critEvery: 4, cards: { bolt: 2, fireball: 1, stun_bolt: 1, flame_wall: 1, nova: 1 } },
    bow:    { name: "Лук",   kind: "weapon", icon: "w_bow",    critEvery: 4, cards: { double_shot: 2, pierce_arrow: 1, knock_arrow: 1, arrow_rain: 1, aimed_shot: 1 } }
  },

  // ---------- Герои ----------
  // Классов нет: колода = карты оружия и щита + доп. карты (cards) + слабые удары до минимума.
  // В режиме общей колоды (tests.sharedDeck) доп. карты героя уходят в общую колоду.
  // hp — макс. ХП (переносится между боями, лечения нет).
  // startBlock — запас блока на бой: тратится после обычного блока, между ходами не восстанавливается, обновляется в начале боя.
  // icon — портрет (см. js/icons.js)
  // Баланс (ХП героев и врагов, состав боёв) подобран симулятором: node tools/balance-sim.js — см. README.
  heroes: [
    { id: "melee",  name: "Милишник", icon: "helm", hp: 85, startBlock: 4, weapons: ["sword", "shield"], cards: { cover: 1, challenge: 1 } },
    { id: "mage",   name: "Маг",      icon: "hat",  hp: 60, startBlock: 2, weapons: ["staff"],        cards: { purify: 1, barrier: 1 } },
    { id: "ranger", name: "Стрелок",  icon: "hood", hp: 68, startBlock: 2, weapons: ["bow"],          cards: { cover: 1 } }
  ],

  // ---------- Враги ----------
  // melee: true — враг-мили: бьёт, только если сам открыт (никто не стоит перед ним), иначе ждёт.
  // actions выполняются по кругу. attack {damage, hits, targets: 1–3 героя} | block {amount} | curse {amount, turns, targets}
  // targets: 2–3 — бьёт сразу нескольких героев (свой коридор + соседние), одним «Прикрыть» такое не закрыть.
  // block держится до следующего действия этого врага (то есть весь ваш следующий ход).
  // curse = «Проклятие»: −amount к урону героя на turns ходов (снимается «Очищением»).
  // Роли: Упырь — основной мили; Гончая — слабая, но их много (цель для массовых атак);
  //       Культист и Костяной лучник — дальники заднего ряда (мили до них не достать, пока их прикрывают);
  //       Громила — танк с блоком и ударом по всей пати; Падший жрец — минибосс, самый опасный.
  // Баланс прототипа (17.10, бот medium, цель 70% побед): ХП обычных врагов +10% (Упырь 50→55, Гончая 30→33, Культист 34→37, Лучник 28→31, Громила 80→88).
  enemies: {
    ghoul:   { name: "Упырь",        hp: 55, melee: true,  actions: [{ type: "attack", damage: 8 }, { type: "attack", damage: 4, targets: 2 }] },
    hound:   { name: "Гончая",       hp: 33, melee: true,  actions: [{ type: "attack", damage: 5 }, { type: "attack", damage: 7 }] },
    cultist: { name: "Культист",     hp: 37, melee: false, actions: [{ type: "curse", amount: 2, turns: 2 }, { type: "attack", damage: 9 }] },
    archer:  { name: "Костяной лучник", hp: 31, melee: false, actions: [{ type: "attack", damage: 3, targets: 3 }, { type: "attack", damage: 6 }] },
    brute:   { name: "Громила",      hp: 88, melee: true,  actions: [{ type: "block", amount: 8 }, { type: "attack", damage: 9, targets: 3 }] },
    priest:  { name: "Падший жрец",  hp: 150, melee: false, actions: [{ type: "attack", damage: 17 }, { type: "attack", damage: 10, targets: 2 }, { type: "curse", amount: 3, turns: 2, targets: 3 }] }
  },

  // ---------- Задачи пати на бой ----------
  // condition: cardsInTurn {count, cost} | sameTarget | killsInTurn {count}
  //            collisions {count} (за бой) | blockAll {amount} (у всех героев в конце хода)
  // reward:    energyNextTurn {amount} | blockAll {amount} | damageAllEnemies {amount} | drawNow {amount}
  tasks: {
    three_cheap: { text: "Сыграйте 3 карты по 1 энергии за один ход", condition: { type: "cardsInTurn", count: 3, cost: 1 }, reward: { type: "energyNextTurn", amount: 1 } },
    focus:       { text: "Все герои бьют одного врага за один ход",  condition: { type: "sameTarget" }, reward: { type: "damageAllEnemies", amount: 5 } },
    crush:       { text: "Устройте 2 столкновения толчками за бой", condition: { type: "collisions", count: 2 }, reward: { type: "blockAll", amount: 6 } }
  },

  // ---------- Квесты от карт-квестов ----------
  // scope: "turn" — на этот ход | "fight" — до конца боя
  quests: {
    kill2_turn:     { text: "Убейте 2 врагов в этот ход", scope: "turn", condition: { type: "killsInTurn", count: 2 }, reward: { type: "energyNextTurn", amount: 1 } },
    block_all_turn: { text: "К концу хода у всех героев ≥5 блока", scope: "turn", condition: { type: "blockAll", amount: 5 }, reward: { type: "damageAllEnemies", amount: 4 } }
  },

  // ---------- Бои (идут по порядку) ----------
  // task: id задачи пати | "random" | null. Клетки: col 0–5 (слева направо), row 0 — передний ряд, 1 — задний.
  // Враг заднего ряда (col, 1) стоит прямо за (col, 0) — она его и прикрывает. Колонки 0, 2, 4 ближе к героям.
  // Задумка забега: каждый бой отъедает немного ХП, минибосс — больше всех.
  //   1 «Трупоеды» — разминка, лучник за упырём учит бить дальними;
  //   2 «Стая» — 4 гончие в ряд + прикрытый лучник: бой для массовых атак;
  //   3 «Громила» — танк с блоком (распылять урон невыгодно) и два дальника по краям;
  //   4 «Минибосс: Жрец» — жрец в заднем ряду за упырём (рядом второй упырь), сбоку лучник.
  encounters: [
    { name: "Трупоеды",          task: "three_cheap", enemies: [{ type: "ghoul", col: 1, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 2, row: 1 }, { type: "archer", col: 4, row: 1 }] },
    { name: "Стая",              task: "focus",       enemies: [{ type: "hound", col: 0, row: 0 }, { type: "hound", col: 2, row: 0 }, { type: "hound", col: 3, row: 0 }, { type: "hound", col: 5, row: 0 }, { type: "archer", col: 2, row: 1 }] },
    { name: "Громила",           task: "crush",       enemies: [{ type: "brute", col: 2, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 0, row: 1 }, { type: "archer", col: 5, row: 1 }] },
    { name: "Минибосс: Жрец",    task: "focus",       enemies: [{ type: "priest", col: 2, row: 1 }, { type: "ghoul", col: 2, row: 0 }, { type: "ghoul", col: 3, row: 0 }, { type: "archer", col: 5, row: 1 }] }
  ]
};
