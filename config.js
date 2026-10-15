// =====================================================================
//  BACKPACK RPG — КОНФИГ ПРОТОТИПА
//  Здесь все числа, карты, оружие, герои, враги, бои и переключатели тестов.
//  Править можно прямо на github.com: открыть файл → карандаш → Save (Commit).
//  Правила: текст в "кавычках", числа без кавычек, true/false без кавычек,
//  после каждого поля запятая. Строки, начинающиеся с //, — комментарии.
//  Быстрые правки во время сессии — кнопка «Настройки» в игре (у хоста).
// =====================================================================
window.GAME_CONFIG = {

  // ---------- Базовые правила боя ----------
  rules: {
    cols: 6, rows: 2,            // поле врагов 6×2
    handSize: 4,                 // добор руки до N карт в начале хода
    energy: 3,                   // энергия героя каждый ход
    minDeck: 10,                 // минимум карт в колоде; недобор = слабые удары
    fillerCard: "weak_strike",   // какой картой добивать колоду до минимума
    critMultiplier: 2,           // множитель крита
    conditionalCrit: true,       // x2 по оглушённому или вытолкнутому в этот ход
    collisionDamage: 3,          // урон при столкновении после толчка (обоим)
    meleeBackRowIfFrontEmpty: true, // мили может бить задний ряд, если передний пуст
    enemyAdvance: true,          // враг из заднего ряда шагает вперёд, если клетка перед ним пуста
    enemyStepDelayMs: 700,       // пауза между действиями врагов (мс), чтобы было видно, кто что сделал
    hpCarriesOver: true,         // ХП переносится между боями (лечения нет)
    reviveHp: 10                 // павший герой встаёт к следующему бою с таким ХП (заглушка: смерть героя ещё не решена)
  },

  // ---------- Переключатели тестов ----------
  tests: {
    // Цели врагов: "A" — бьёт героя перед собой (в пределах 2 рядов хексов),
    //              "B" — любой враг может выбрать любого героя (случайно).
    enemyTargeting: "A",

    // Мердж = передача: перетащить свою карту на карту в руке союзника.
    // mode "add"  — карта союзника получает урон/блок твоей карты;
    // mode "flat" — карта союзника получает +flatBonus к урону и блоку.
    // payCost — платишь ли ты энергию своей карты за мердж.
    merge: { enabled: true, mode: "add", payCost: true, flatBonus: 3 },

    // Задача пати на бой: у каждого боя есть задача (см. tasks и encounters), бонус всем.
    partyTask: { enabled: true },

    // Общий пул энергии — только как эффект карты (карта "Единение").
    sharedPool: { enabled: true, cards: { unity: 1 }, heroes: "all" },

    // Карты-квесты: карта ставит пати задачу на ход/бой.
    questCards: { enabled: true, cards: { oath_hunt: 1, oath_wall: 1 }, heroes: ["melee", "ranger"] }
  },

  // ---------- Карты ----------
  // target: "enemy" — враг | "cell" — любая клетка поля | "self" — себя
  //         "hero" — себя или союзника | "ally" — только союзника | "none" — без цели
  // attack: "melee" (только передний ряд) | "ranged" | "aoe"
  // area:   "single" | "adjacent" (клетка + соседи) | "row" (весь ряд) | "line" (цель + враг за ней)
  // effects: damage {amount, hits} | block {amount} | push | stun | taunt | cleanse
  //          blockSelf {amount} (блок себе) | draw {amount} | energy {amount} | sharedPool | quest {id}
  cards: {
    weak_strike:   { name: "Слабый удар",       cost: 1, target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 3 }] },

    // Меч и щит
    cleave:        { name: "Рубящий удар",      cost: 1, target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 6 }] },
    shield_bash:   { name: "Удар щитом",        cost: 1, target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 3 }, { type: "push" }] },
    shield_wall:   { name: "Стена щитов",       cost: 1, target: "self",  effects: [{ type: "block", amount: 7 }] },

    // Посох
    fireball:      { name: "Огненный шар",      cost: 2, target: "cell",  attack: "aoe", area: "adjacent", effects: [{ type: "damage", amount: 5 }] },
    bolt:          { name: "Разряд",            cost: 1, target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 5 }] },
    stun_bolt:     { name: "Оглушающий разряд", cost: 2, target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 2 }, { type: "stun" }] },

    // Лук
    double_shot:   { name: "Двойной выстрел",   cost: 1, target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3, hits: 2 }] },
    pierce_arrow:  { name: "Пробивающая стрела", cost: 2, target: "enemy", attack: "ranged", area: "line", effects: [{ type: "damage", amount: 7 }] },
    knock_arrow:   { name: "Отбрасывающая стрела", cost: 1, target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }, { type: "push" }] },

    // Кооп-сейвы
    cover:         { name: "Прикрыть",          cost: 1, target: "hero",  effects: [{ type: "block", amount: 6 }] },
    challenge:     { name: "Вызов",             cost: 1, target: "enemy", attack: "ranged", effects: [{ type: "taunt" }, { type: "blockSelf", amount: 3 }] },
    purify:        { name: "Очищение",          cost: 1, target: "hero",  effects: [{ type: "cleanse" }, { type: "block", amount: 3 }] },
    barrier:       { name: "Барьер",            cost: 1, target: "hero",  effects: [{ type: "block", amount: 5 }] },

    // Тестовые карты (попадают в колоды, только если тест включён)
    unity:         { name: "Единение",          cost: 0, target: "none",  effects: [{ type: "sharedPool" }], note: "Остаток энергии всех героев складывается, любой тратит из пула" },
    oath_hunt:     { name: "Клятва охотника",   cost: 0, target: "none",  effects: [{ type: "quest", id: "kill2_turn" }] },
    oath_wall:     { name: "Клятва стены",      cost: 0, target: "none",  effects: [{ type: "quest", id: "block_all_turn" }] }
  },

  // ---------- Оружие (главный источник карт) ----------
  // critEvery — крит раз в N ударов этим героем; счётчик живёт весь бой.
  weapons: {
    sword_shield: { name: "Меч и щит", critEvery: 3, cards: { cleave: 3, shield_bash: 1, shield_wall: 1 } },
    staff:        { name: "Посох",     critEvery: 4, cards: { fireball: 2, bolt: 2, stun_bolt: 1 } },
    bow:          { name: "Лук",       critEvery: 5, cards: { double_shot: 3, pierce_arrow: 1, knock_arrow: 1 } }
  },

  // ---------- Герои ----------
  // Классов нет: колода = карты оружия + доп. карты + слабые удары до минимума.
  heroes: [
    { id: "melee",  name: "Милишник", hp: 34, startBlock: 6, weapons: ["sword_shield"], cards: { cover: 1, challenge: 1 } },
    { id: "mage",   name: "Маг",      hp: 24, startBlock: 3, weapons: ["staff"],        cards: { purify: 1, barrier: 1 } },
    { id: "ranger", name: "Стрелок",  hp: 26, startBlock: 4, weapons: ["bow"],          cards: { cover: 1 } }
  ],

  // ---------- Враги ----------
  // actions выполняются по кругу. attack {damage, hits, targets: 1–3 героя} | block {amount} | curse {amount, turns, targets}
  // curse = «Проклятие»: −amount к урону героя на turns ходов (снимается «Очищением»).
  enemies: {
    ghoul:   { name: "Упырь",        hp: 24, actions: [{ type: "attack", damage: 8 }, { type: "attack", damage: 5, hits: 2 }] },
    cultist: { name: "Культист",     hp: 18, actions: [{ type: "curse", amount: 2, turns: 2 }, { type: "attack", damage: 9 }] },
    brute:   { name: "Громила",      hp: 38, actions: [{ type: "block", amount: 8 }, { type: "attack", damage: 7, targets: 3 }] },
    priest:  { name: "Падший жрец",  hp: 80, actions: [{ type: "attack", damage: 13 }, { type: "attack", damage: 7, targets: 2 }, { type: "curse", amount: 2, turns: 2, targets: 3 }] }
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
  encounters: [
    { name: "Трупоеды",          task: "three_cheap", enemies: [{ type: "ghoul", col: 1, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 2, row: 1 }] },
    { name: "Громила",           task: "crush",       enemies: [{ type: "brute", col: 2, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 0, row: 1 }, { type: "cultist", col: 5, row: 1 }] },
    { name: "Минибосс: Жрец",    task: "focus",       enemies: [{ type: "priest", col: 2, row: 1 }, { type: "ghoul", col: 1, row: 0 }, { type: "ghoul", col: 4, row: 0 }] }
  ]
};
