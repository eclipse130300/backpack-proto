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
  version: 10,

  // ---------- Базовые правила боя ----------
  rules: {
    cols: 6, rows: 2,            // поле врагов 6×2: 6 колонок по 2 клетки (передняя и задняя строго друг за другом)
    drawPerTurn: 4,              // РЕШЕНО (17.10): в начале хода каждый герой берёт ровно N карт (не «до N»). Несгоревшая квестовая карта
                                 // остаётся сверху — тогда в руке 5. Предела руки пока нет (рука рассчитана на 4 карты, больше — накладываются)
    energy: 3,                   // энергия героя каждый ход
    minDeck: 10,                 // минимум карт в колоде; недобор = слабые удары ОРУЖИЯ героя (weapons.*.weakCard)
    fillerCard: "weak_strike",   // запасная добивка: герою без weakCard у оружия; в общей колоде — «слабый удар», который подстраивается под вытянувшего героя
    endFightDelayMs: 2500,       // после конца боя экран ~2.5 с заблокирован (досмотреть цифры урона), потом окно итогов
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
    // mode "flat" — карта союзника получает +flatBonus к урону и блоку;
    // mode "gift" — (по умолчанию, 18.10) «дар»: отданная карта передаёт карте союзника ОДНО свойство — свой родной дар
    //   (поле gift у карты, список даров — gifts ниже). Полученные дары дальше не передаются. На карте максимум maxGifts даров.
    // payCost — платишь ли ты энергию своей карты за мердж.
    // costGrowth — растущая стоимость мерджа за ход (сбрасывается каждый ход, работает при payCost: true):
    //   "off"   — мердж стоит как карта;
    //   "hero"  — у каждого героя свой счётчик: n-й мердж героя за ход = стоимость карты + (n − 1);
    //   "party" — общий счётчик пати: n-й мердж за ход стоит n энергии (1, 2, 3…), стоимость карты не важна.
    // Стоимость мерджа видна пульсирующим фиолетовым ромбом на месте стоимости карт союзника, когда берёшь карту (их обычная стоимость в этот момент скрыта).
    merge: { enabled: true, mode: "gift", maxGifts: 2, payCost: true, flatBonus: 3, costGrowth: "off" },

    // Общая колода: карты оружия и щита остаются у своего героя, все остальные (кооп-карты, слабые удары,
    // особые карты) лежат в одной общей колоде. Герой добирает руку случайно из «своё + общее» (шанс по количеству).
    // Сыгранная общая карта уходит в общий сброс. minDeck — минимум общей колоды, недобор = слабые удары.
    // Карты героя подсвечены его цветом, общие — бирюзовой полосой «общая».
    sharedDeck: { enabled: false, minDeck: 12 },

    // Квест боя (17.10, заменил «Клятвы»): перед боем игроки голосуют за 1 из 3 случайных квестов (у каждого своя награда).
    // Ничья — рулетка выбирает случайно. Во время боя над полем висит «?»: серый — не выполнен, золотой — выполнен.
    // Условие — на весь бой, с прогрессом. Герой, который закрыл условие, сразу получает в руку квестовую карту:
    // одноразовую (сыграл — пропала) и не сгорающую в конце хода. Условия и награды — questConditions/questRewards.
    fightQuest: { enabled: true },

    // Фигуры массовок без поворота (17.10): у каждой массовки своя фигура (fixedShape у карты), ПКМ не крутит.
    // Фигуры из 3+ клеток симметричные и «смотрят» на героев. false — старый режим: фигуры shape, поворот ПКМ.
    fixedShapes: { enabled: true }
  },

  // ---------- Дары (мердж в режиме tests.merge.mode = "gift") ----------
  // У карты поле gift — что она даст карте союзника, если её отдать. Нет поля — карту отдать нельзя (слабые удары и Искры — 18.10).
  // РЕШЕНО (18.10): бусты — только простые числа (50%, ×1.5, ×2, +1). Дробное округляем вверх.
  // Мощь, Взрыв, Повтор, Броня, Прикрытие складываются по 50% (две Мощи = ×2), проценты складываются, не перемножаются.
  // Толчок + Толчок (или Толчок в карту, которая уже толкает) = толчок на 2 клетки. Остальные дары — только один раз на карту.
  gifts: {
    // color — цвет фона карты с этим даром (поднятая карта светится им)
    power:  { name: "Мощь",       color: "#d83a3a", text: "урон ×1.5" },
    blast:  { name: "Взрыв",      color: "#e8822a", text: "соседние с зоной клетки получают 50% урона" },
    pierce: { name: "Пробой",     color: "#e0c040", text: "одиночной атаке — враг за целью тоже получает 100%; массовке и стреле насквозь — ещё 50% в клетку прицела" },
    repeat: { name: "Повтор",     color: "#4cb35a", text: "ещё один удар на 50% урона" },
    push:   { name: "Толчок",     color: "#9a6a3e", text: "толкнуть цель (у массовки — врага в клетке прицела, до удара); если карта уже толкает — толчок на 2 клетки" },
    armor:  { name: "Броня",      color: "#4a78d8", text: "блок себе = 50% урона карты (у карты блока — блок ×1.5)" },
    cover:  { name: "Прикрытие",  color: "#4a78d8", text: "блок отдавшему дар = 50% урона карты (у карты блока — блок ×1.5)" },
    taunt:  { name: "Вызов",      color: "#d4a94f", text: "цель атакует тебя" },
    execute:{ name: "Добивание",  color: "#9a4ad8", text: "урон ×2 по врагу, у которого ≤50% ХП" },
    chain:  { name: "Цепь",       color: "#48b8e0", text: "молния перескакивает на ближайшего врага вне зоны (с меньшим ХП) — 50% урона" }
  },

  // ---------- Фигуры массовых атак ----------
  // Каждая фигура — список «шагов» от клетки прицела. [] — сама клетка, [0] — соседняя по направлению 0,
  // [0,0] — через одну, [1] — соседняя, повёрнутая на 60°. Направления: 0 ↗, 1 ↑ (назад), 2 ↖, 3 ↙, 4 ↓ (вперёд), 5 ↘.
  // Без теста fixedShapes игрок крутит фигуру правой кнопкой мыши. Клетки фигуры за краем поля видны как хексы с красным ✕ и никого не бьют.
  shapes: {
    line2: { name: "линия из 2 клеток", steps: [[], [0]] },
    line3: { name: "линия из 3 клеток", steps: [[], [0], [0, 0]] },
    tri:   { name: "треугольник из 3 клеток", steps: [[], [0], [1]] },
    fan:   { name: "веер из 3 клеток", steps: [[], [5], [1]] },
    // Фигуры для tests.fixedShapes (не крутятся). Клетка прицела — передняя (ближняя к героям) клетка фигуры.
    across2: { name: "2 клетки поперёк", steps: [[], [0]] },
    arc3:    { name: "уголок из 3 клеток", steps: [[], [2], [0]] },          // уголок вниз, к героям
    diamond4:{ name: "ромб из 4 клеток", steps: [[], [2], [0], [1]] },      // уголок + клетка за прицелом
    arc5:    { name: "широкий уголок из 5 клеток", steps: [[], [2], [2, 2], [0], [0, 0]] }
  },

  // ---------- Карты ----------
  // target: "enemy" — враг | "cell" — любая клетка поля | "self" — себя
  //         "hero" — себя или союзника | "ally" — только союзника | "none" — без цели
  // attack: "melee" (только открытые враги) | "ranged" | "aoe"
  // area:   "single" | "adjacent" (клетка + все соседи) | "shape" (фигура из shapes, крутится ПКМ)
  //         "line" — цель + враг за ней; если за целью край поля — рикошет в тот же ряд соседней колонки
  //                  (стрелок справа — влево, слева — вправо, ровно напротив — в обе стороны)
  // shape:  id фигуры из shapes (для area: "shape"), крутится ПКМ
  // fixedShape: id фигуры из shapes, когда включён tests.fixedShapes (не крутится)
  // icon:   картинка на карте (см. js/icons.js). Цвет картинки — по типу карты: мили красный, дальний зелёный,
  //         массовка оранжевый, блок синий, кооп золотой, особые фиолетовый, слабый удар серый.
  // gift:   дар карты для мерджа в режиме «дар» (id из gifts выше): что получит карта союзника, если отдать ему эту карту
  // weak:   true — слабый удар (серая картинка); у каждого оружия свой (weapons.*.weakCard)
  // effects: damage {amount, hits} | block {amount} | push | stun | taunt | cleanse
  //          sparks {count, amount} — после удара count искр по amount урона в случайных врагов на соседних с целью клетках
  //                 (не в саму цель; всегда ровно amount: без крита, мерджа и проклятия; нет соседей — искры пропадают)
  //          blockSelf {amount} (блок себе) | draw {amount} | energy {amount} (цели-герою или себе) | sharedPool
  //          blockHero {amount, hero} — блок конкретному герою (так работает дар «Прикрытие»)
  //          blockParty {amount} (блок всем героям) | damageAllEnemies {amount} (урон всем врагам, без крита)
  // isNew:  true — значок 🆕 на странице «Карты» (cards.html): карта добавлена по заявке и ещё тестируется
  // added:  "17.10.2026" — когда добавлена (видно в подробностях карты на странице «Карты»)
  // Все карты удобно смотреть на странице «Карты»: https://eclipse130300.github.io/backpack-proto/cards.html
  cards: {
    // Слабые удары оружия (17.10, эксперимент): ими добивается колода до minDeck. Двигают счётчик крита своего оружия.
    weak_strike:   { name: "Слабый удар",       cost: 1, icon: "fist",   target: "enemy", attack: "melee",  weak: true, effects: [{ type: "damage", amount: 3 }] },
    weak_shot:     { name: "Слабый выстрел",    cost: 1, icon: "arrow",  target: "enemy", attack: "ranged", weak: true, effects: [{ type: "damage", amount: 2 }], isNew: true, added: "17.10.2026" },
    sparks:        { name: "Искры",             cost: 1, icon: "sparks", target: "enemy", attack: "ranged", weak: true, effects: [{ type: "damage", amount: 1 }, { type: "sparks", count: 2, amount: 1 }], isNew: true, added: "17.10.2026" },

    // Меч
    cleave:        { name: "Рубящий удар",      cost: 1, gift: "execute", icon: "slash",  target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 6 }] },
    sweep:         { name: "Размах",            cost: 2, gift: "blast", icon: "sweep",  target: "cell",  attack: "aoe", area: "shape", shape: "line2", fixedShape: "across2", effects: [{ type: "damage", amount: 8 }] },
    great_sweep:   { name: "Мощный размах",     cost: 2, gift: "blast", icon: "sweep",  target: "cell",  attack: "aoe", area: "shape", shape: "arc5", fixedShape: "arc5", effects: [{ type: "damage", amount: 5 }], isNew: true, added: "17.10.2026" },
    crush:         { name: "Сокрушение",        cost: 2, gift: "power", icon: "crush",  target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 13 }] },

    // Щит
    shield_bash:   { name: "Удар щитом",        cost: 1, gift: "push", icon: "bash",   target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 4 }, { type: "push" }] },
    shield_wall:   { name: "Стена щитов",       cost: 1, gift: "armor", icon: "shield", target: "self",  effects: [{ type: "block", amount: 7 }] },

    // Посох
    bolt:          { name: "Разряд",            cost: 1, gift: "chain", icon: "bolt",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 5 }] },
    fireball:      { name: "Огненный шар",      cost: 2, gift: "blast", icon: "fire",   target: "cell",  attack: "aoe", area: "shape", shape: "tri", fixedShape: "diamond4", effects: [{ type: "damage", amount: 6 }] },
    stun_bolt:     { name: "Оглушающий разряд", cost: 2, gift: "power", icon: "stun",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }, { type: "stun" }] },
    flame_wall:    { name: "Стена огня",        cost: 2, gift: "blast", icon: "flames", target: "cell",  attack: "aoe", area: "shape", shape: "line3", fixedShape: "arc3", effects: [{ type: "damage", amount: 6 }] },
    nova:          { name: "Огненное кольцо",   cost: 2, gift: "blast", icon: "nova",   target: "cell",  attack: "aoe", area: "adjacent", effects: [{ type: "damage", amount: 6 }] },

    // Лук
    double_shot:   { name: "Двойной выстрел",   cost: 1, gift: "repeat", icon: "arrows", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3, hits: 2 }] },
    pierce_arrow:  { name: "Пробивающая стрела", cost: 2, gift: "pierce", icon: "pierce", target: "enemy", attack: "ranged", area: "line", effects: [{ type: "damage", amount: 7 }] },
    knock_arrow:   { name: "Отбрасывающая стрела", cost: 1, gift: "push", icon: "knock", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }, { type: "push" }] },
    arrow_rain:    { name: "Град стрел",        cost: 2, gift: "blast", icon: "rain",   target: "cell",  attack: "aoe", area: "shape", shape: "fan", fixedShape: "arc3", effects: [{ type: "damage", amount: 6 }] },
    aimed_shot:    { name: "Прицельный выстрел", cost: 2, gift: "power", icon: "aim",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 10 }] },

    // Кооп-сейвы
    cover:         { name: "Прикрыть",          cost: 1, gift: "cover", icon: "cover",   target: "hero",  effects: [{ type: "block", amount: 6 }] },
    challenge:     { name: "Вызов",             cost: 1, gift: "taunt", icon: "taunt",   target: "enemy", attack: "ranged", effects: [{ type: "taunt" }, { type: "blockSelf", amount: 4 }] },
    purify:        { name: "Очищение",          cost: 1, icon: "purify",  target: "hero",  effects: [{ type: "cleanse" }, { type: "block", amount: 3 }] },
    barrier:       { name: "Барьер",            cost: 1, gift: "armor", icon: "barrier", target: "hero",  effects: [{ type: "block", amount: 5 }] },

    // «Единение» — только награда квеста (см. questRewards), отдельной настройки нет.
    unity:         { name: "Единение",          cost: 0, icon: "unity", target: "none",  effects: [{ type: "sharedPool" }], note: "Остаток энергии всех героев складывается, любой тратит из пула" },

    // Награды квеста боя (tests.fightQuest): одноразовые карты, в колоды не попадают
    q_surge:       { name: "Прилив сил",        cost: 0, icon: "bolt",   target: "self", effects: [{ type: "energy", amount: 2 }], isNew: true, added: "17.10.2026" },
    q_insight:     { name: "Озарение",          cost: 0, icon: "purify", target: "self", effects: [{ type: "draw", amount: 2 }], isNew: true, added: "17.10.2026" },
    q_gift:        { name: "Дар силы",          cost: 0, icon: "unity",  target: "ally", effects: [{ type: "energy", amount: 2 }], isNew: true, added: "17.10.2026" },
    q_bulwark:     { name: "Общий оплот",       cost: 1, icon: "barrier", target: "none", effects: [{ type: "blockParty", amount: 5 }], isNew: true, added: "17.10.2026" },
    q_wave:        { name: "Ударная волна",     cost: 1, icon: "nova",   target: "none", effects: [{ type: "damageAllEnemies", amount: 5 }], isNew: true, added: "17.10.2026" }
  },

  // ---------- Оружие и щиты (главный источник карт) ----------
  // РЕШЕНО: щит — отдельный тип снаряжения. Оружием наносишь урон, щитом защищаешься.
  // kind: "weapon" — оружие | "shield" — щит. icon — значок у героя (см. js/icons.js).
  // critEvery — крит раз в N ударов этим оружием; счётчик живёт весь бой. Сколько осталось — пишется на карте. 0 — без крита.
  // weakCard — слабый удар этого оружия: им добивается колода героя до rules.minDeck (берётся первое оружие героя с weakCard).
  // У щита слабого удара нет (щиты разберём позже).
  // Пока щит только у милишника (щиты разберём позже).
  weapons: {
    sword:  { name: "Меч",   kind: "weapon", icon: "w_sword",  critEvery: 3, weakCard: "weak_strike", cards: { cleave: 2, sweep: 1, great_sweep: 1, crush: 1 } },
    shield: { name: "Щит",   kind: "shield", icon: "w_shield", critEvery: 0, cards: { shield_bash: 1, shield_wall: 1 } },
    staff:  { name: "Посох", kind: "weapon", icon: "w_staff",  critEvery: 4, weakCard: "sparks", cards: { bolt: 2, fireball: 1, stun_bolt: 1, flame_wall: 1, nova: 1 } },
    bow:    { name: "Лук",   kind: "weapon", icon: "w_bow",    critEvery: 4, weakCard: "weak_shot", cards: { double_shot: 2, pierce_arrow: 1, knock_arrow: 1, arrow_rain: 1, aimed_shot: 1 } }
  },

  // ---------- Герои ----------
  // Классов нет: колода = карты оружия и щита + доп. карты (cards) + слабые удары своего оружия до минимума.
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

  // ---------- Квест боя (tests.fightQuest) ----------
  // Перед боем — 3 разных случайных условия, у каждого своя случайная награда; игроки голосуют. Условие — на весь бой.
  // condition: killMarked (убить отмеченного 🎯 врага) | aoeHits {count} (задеть N врагов одной массовкой)
  //            collisions {count} (столкновений толчками за бой) | focusTurn {count} (N героев бьют одного врага за ход)
  //            crits {count} (критов за бой) | stuns {count} (оглушений) | killsTurn {count} (убийств за один ход)
  //            backKills {count} (убить заднего врага, пока передний его прикрывает) | pushes {count} (толчков)
  //            cleanEnemyTurn (ход врагов, после которого ни у кого не убыло ХП; карту получает случайный живой герой)
  //            mergeKills {count} (убийств картой с ★) | weakKills {count} (убийств слабым ударом)
  // Награда — id карты из cards: её получает в руку герой, закрывший условие. Карта одноразовая.
  questConditions: {
    marked:    { text: "Убейте отмеченного врага 🎯", condition: { type: "killMarked" } },
    aoe3:      { text: "Задейте 3 врагов одной массовкой", condition: { type: "aoeHits", count: 3 } },
    collision: { text: "Устройте столкновение толчком", condition: { type: "collisions", count: 1 } },
    focus2:    { text: "Два героя бьют одного врага за один ход", condition: { type: "focusTurn", count: 2 } },
    crit2:     { text: "Нанесите 2 крита", condition: { type: "crits", count: 2 } },
    // 17.10: новые условия
    stun2:     { text: "Оглушите 2 врагов", condition: { type: "stuns", count: 2 } },
    kills2:    { text: "Убейте 2 врагов за один ход", condition: { type: "killsTurn", count: 2 } },
    backKill:  { text: "Убейте врага заднего ряда, пока его прикрывают", condition: { type: "backKills", count: 1 } },
    push3:     { text: "Толкните врагов 3 раза", condition: { type: "pushes", count: 3 } },
    noHit:     { text: "Переживите ход врагов: никто из героев не теряет ХП", condition: { type: "cleanEnemyTurn", count: 1 } },
    mergeKill: { text: "Убейте врага усиленной (мердж ★) картой", condition: { type: "mergeKills", count: 1 } },
    weakKill:  { text: "Добейте врага слабым ударом", condition: { type: "weakKills", count: 1 } }
  },
  questRewards: ["q_surge", "q_insight", "q_gift", "q_bulwark", "q_wave", "unity"],

  // ---------- Бои (идут по порядку) ----------
  // Клетки: col 0–5 (слева направо), row 0 — передний ряд, 1 — задний.
  // Враг заднего ряда (col, 1) стоит прямо за (col, 0) — она его и прикрывает. Колонки 0, 2, 4 ближе к героям.
  // Задумка забега: каждый бой отъедает немного ХП, минибосс — больше всех.
  //   1 «Трупоеды» — разминка, лучник за упырём учит бить дальними;
  //   2 «Стая» — 4 гончие в ряд + прикрытый лучник: бой для массовых атак;
  //   3 «Громила» — танк с блоком (распылять урон невыгодно) и два дальника по краям;
  //   4 «Минибосс: Жрец» — жрец в заднем ряду за упырём (рядом второй упырь), сбоку лучник.
  encounters: [
    { name: "Трупоеды",          enemies: [{ type: "ghoul", col: 1, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 2, row: 1 }, { type: "archer", col: 4, row: 1 }] },
    { name: "Стая",              enemies: [{ type: "hound", col: 0, row: 0 }, { type: "hound", col: 2, row: 0 }, { type: "hound", col: 3, row: 0 }, { type: "hound", col: 5, row: 0 }, { type: "archer", col: 2, row: 1 }] },
    { name: "Громила",           enemies: [{ type: "brute", col: 2, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 0, row: 1 }, { type: "archer", col: 5, row: 1 }] },
    { name: "Минибосс: Жрец",    enemies: [{ type: "priest", col: 2, row: 1 }, { type: "ghoul", col: 2, row: 0 }, { type: "ghoul", col: 3, row: 0 }, { type: "archer", col: 5, row: 1 }] }
  ]
};
