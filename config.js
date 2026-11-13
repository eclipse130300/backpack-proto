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
  version: 19,

  // ---------- Базовые правила боя ----------
  rules: {
    cols: 6, rows: 2,            // поле врагов 6×2: 6 колонок по 2 клетки (передняя и задняя строго друг за другом)
    drawPerTurn: 4,              // РЕШЕНО (17.10): в начале хода каждый герой берёт ровно N карт (не «до N»). Несгоревшая квестовая карта
                                 // остаётся сверху — тогда в руке 5. Предела руки пока нет (рука рассчитана на 4 карты, больше — накладываются)
    energy: 3,                   // энергия героя каждый ход
    // merge-6 (10.11): добивки до минимума больше нет — стартовая колода как в Slay the Spire (базовые удары по 4 копии).
    minDeck: 0,                  // минимум карт в колоде; недобор = слабые удары ОРУЖИЯ героя (weapons.*.weakCard). 0 — не добивать
    fillerCard: "weak_strike",   // запасная добивка: герою без weakCard у оружия; в общей колоде — «слабый удар», который подстраивается под вытянувшего героя
    endFightDelayMs: 2500,       // после конца боя экран ~2.5 с заблокирован (досмотреть цифры урона), потом окно итогов
    critMultiplier: 2,           // множитель крита
    // card-mechanics-1 (21.10): условного крита ×2 по оглушённому/толкнутому больше нет. Вместо него:
    collisionBonus: 0.5,         // толкнули врага в другого врага — ОБА до конца хода получают +50% урона (край поля не считается).
                                 // Складывается с критом (×2 + 50% = ×2.5). 0 — выключить
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

    // Мердж (merge-7, 12.11): перетащить свою карту на карту в руке союзника. Подробно — js/gifts.js.
    //   Отданная карта передаёт часть своего урона (donorDamage) и свои дары. Дары без шкалы: сколько закинули, столько работает.
    //   Защита в защиту — передаётся часть блока. Атаку в защиту нельзя, поддержку мерджить нельзя,
    //   толчок в карту с притяжением нельзя. Немерджимая карта — поле noMerge: true у карты.
    // donorDamage — какая часть урона (и блока) отданной карты переходит: 0.5 = 50%, 1 = 100%
    // keepDamage — true: прибавка урона живёт до конца боя (переживает сброс); false — сгорает после розыгрыша (дары остаются)
    // lifetime — что происходит с картами после мерджа (13.11, «Lifetime after merge»):
    //   "all"   — как было: отданная карта уходит в сброс чистой, мерджнутая после розыгрыша уходит в сброс владельца
    //             вместе с бонусами и до конца боя возвращается в руку усиленной
    //   "fused" — сплав: отданная карта сгорает до конца боя (не в сброс), мерджнутая остаётся в руке и дальше ходит по колоде с бонусами
    //   "turn"  — на один ход: обе исходные карты уходят в сброс чистыми, мерджнутая живёт только этот ход —
    //             сыграли её или нет, в сброс она не попадает (вместо неё в сброс ложится исходная карта союзника)
    // aoeReceive — true: в массовку можно мерджить
    // payCost — платишь энергию своей карты за мердж (стоимость = стоимость карты)
    merge: { enabled: true, mode: "gift", payCost: true, donorDamage: 0.5, keepDamage: true, lifetime: "all", aoeReceive: false },

    // Векторные массовки (merge-7, 12.11): у массовки своя фигура (fixedShape у карты); наводишься на клетку,
    // и фигура поворачивается в сторону курсора (6 направлений хекса). Клетки за краем поля пропадают.
    // false — фигура неподвижна.
    vectorAoe: { enabled: true },

    // Эволюция (merge-3, 20.10, эксперимент). Карта с полем evolve (эволюционная, золотая рамка) — это все карты за 2+ энергии.
    // Две эволюционные карты РАЗНЫХ героев, обе уже мерджнутые (★), светятся фиолетовым. Перетащил одну на другую —
    // та, НА КОТОРУЮ тащили, превращается в свою эволюцию (cards.<evolve>): урон обеих складывается, дары переходят.
    // Эволюция живёт до конца боя. Отданная карта уходит в сброс чистой. Подробно — js/evolve.js.
    evolution: { enabled: true },

    // Подкрепления (merge-3, 20.10, эксперимент): у боя есть резерв врагов (encounters.*.reserve).
    // Каждые every ходов выходят perWave врагов из резерва: сначала на свободные клетки заднего ряда, потом переднего.
    // За ход до выхода клетки помечены. Поле пустое, а резерв нет — следующая волна выходит сразу.
    // Бой выигран, когда пусто и на поле, и в резерве. Подробно — js/reinforce.js.
    // card-mechanics-1 (21.10): волна, вышедшая посреди хода игроков (поле зачистили), в этот ход не атакует
    // («осматривается»), зато получает lateArmor брони. Толкнул врага на клетку ⚠ — метка переезжает на ближайшую свободную.
    // beta-meta (11.11): every 1 — следующая волна выходит каждый ход (бои короче, ориентир по таблице времени)
    // merge-7 (12.11): every 2 — следующая волна выходит раз в 2 хода (бои длиннее, 4–8 ходов)
    reinforcements: { enabled: true, every: 2, perWave: 2, lateArmor: 5 }
  },

  // ---------- Дары (мердж, js/gifts.js) ----------
  // У карты поле gift — что она даст карте союзника, если её отдать (вместе с частью урона, tests.merge.donorDamage).
  // На карте каждый дар — иконка (icon) + одно число. merge-7 (12.11): сколько даров закинули, столько и работает
  // (Мощь ×2 → ×3 → ×4, Цепь 1 → 2 → 3 прыжка, Повтор +1 → +2 → +3 удара, Рикошет 100% → 200% → 300%).
  // РЕШЕНО 18.10: бусты — только простые числа. Дробное округляем вверх.
  gifts: {
    // color — цвет фона карты с этим даром и плашки дара; icon — значок на плашке
    power:  { name: "Мощь",       icon: "💪", color: "#d83a3a", text: "урон ×2 (2 дара — ×3, 3 — ×4)" },
    // merge-6 (10.11): дар «Зона» убран (массовки в мердже имбалансны), «Добивание» убрано (слабый эффект).
    // card-mechanics-1 (21.10): «Пробой» → «Рикошет» (id оставлен прежним)
    pierce: { name: "Рикошет",    icon: "↯", color: "#e0c040", text: "перед ударом выбираешь направление атаки: сосед цели в эту сторону получает 100% урона за каждый Рикошет; толчок идёт туда же" },
    repeat: { name: "Повтор",     icon: "🔁", color: "#4cb35a", text: "ещё удар по тем же целям, 100% (каждый Повтор — +1 удар)" },
    push:   { name: "Толчок",     icon: "⇧", color: "#9a6a3e", text: "толкнуть цель на 1 клетку (каждый Толчок — +1 клетка); у массовки — врага в клетке прицела" },
    armor:  { name: "Броня",      icon: "🛡", color: "#4a78d8", text: "блок себе = 100% урона карты за каждую Броню" },
    cover:  { name: "Прикрытие",  icon: "🤝", color: "#4a78d8", text: "блок отдавшему дар = 100% урона карты за каждое Прикрытие" },
    taunt:  { name: "Вызов",      icon: "📣", color: "#d4a94f", text: "цель атакует тебя (только один на карте)" },
    chain:  { name: "Цепь",       icon: "🌩", color: "#48b8e0", text: "молния прыгает на соседнего врага с наименьшим ХП, которого карта ещё не била: 100% урона (каждая Цепь — +1 прыжок)" },
    // merge-6 (10.11, эксперимент): новые дары. Открытый враг — перед ним в его колонке никого нет; закрытый — прикрыт спереди.
    open:   { name: "По открытым", icon: "👁", color: "#c0563a", text: "+100% урона по открытым врагам за каждый дар" },
    covered:{ name: "По закрытым", icon: "🎯", color: "#6a5ad8", text: "+100% урона по закрытым врагам — тем, кого прикрывают спереди (за каждый дар)" },
    sharpen:{ name: "Заточка",    icon: "🗡", color: "#8a8a9a", text: "крит оружия ближе: счётчик крита сдвигается на 1 за каждую Заточку" }
  },

  // ---------- Фигуры массовых атак ----------
  // Каждая фигура — список «шагов» от клетки прицела. [] — сама клетка, [0] — соседняя по направлению 0,
  // [0,0] — через одну, [1] — соседняя, повёрнутая на 60°. Направления: 0 ↗, 1 ↑ (назад), 2 ↖, 3 ↙, 4 ↓ (вперёд), 5 ↘.
  // merge-7: с tests.vectorAoe фигура поворачивается за курсором. Клетки фигуры за краем поля видны как хексы с красным ✕ и никого не бьют.
  shapes: {
    line2: { name: "линия из 2 клеток", steps: [[], [0]] },
    line3: { name: "линия из 3 клеток", steps: [[], [0], [0, 0]] },
    tri:   { name: "треугольник из 3 клеток", steps: [[], [0], [1]] },
    fan:   { name: "веер из 3 клеток", steps: [[], [5], [1]] },
    // Фигуры массовок (fixedShape у карт). Клетка прицела — передняя (ближняя к героям) клетка фигуры.
    // merge-2 (19.10): у каждой массовки своя фигура, 3 клетки (2 маны) или 4 клетки (3 маны).
    across2: { name: "2 клетки поперёк", steps: [[], [0]] },
    arc3:    { name: "уголок из 3 клеток", steps: [[], [2], [0]] },          // уголок вниз, к героям
    line3r:  { name: "косая линия ／ из 3 клеток", steps: [[], [0], [0, 0]] },
    line3l:  { name: "косая линия ＼ из 3 клеток", steps: [[], [2], [2, 2]] },
    tri3l:   { name: "треугольник из 3 клеток", steps: [[], [2], [1]] },
    // merge-6 (10.11): обычные массовки — 2 клетки (цель + клетка за ней); 3 клетки по умолчанию только у мага (галочки)
    back2:   { name: "цель + клетка за ней", steps: [[], [1]] },
    chevDown:{ name: "галочка вниз (к героям), 3 клетки", steps: [[], [2], [0]] },
    chevUp:  { name: "галочка вверх (от героев), 3 клетки", steps: [[], [3], [5]] },
    diamond4:{ name: "ромб из 4 клеток", steps: [[], [2], [0], [1]] },      // уголок + клетка за прицелом
    wave4:   { name: "волна из 4 клеток поперёк", steps: [[], [2], [0], [0, 5]] },
    // merge-3 (20.10): фигуры смотрят от героя вглубь. Каталог на будущее (копьё, вилы…) — в GDD «На будущее».
    strikeR: { name: "удар справа: 2 клетки вглубь + 1 справа", steps: [[], [1], [0]] },
    strikeL: { name: "удар слева: 2 клетки вглубь + 1 слева", steps: [[], [1], [2]] },
    arc5:    { name: "широкий уголок из 5 клеток", steps: [[], [2], [2, 2], [0], [0, 0]] }
    // card-mechanics-1 (21.10): динамические массовки — не фигуры, а поле карты area:
    //   area: "rays", rays: [направления] — клетка прицела + лучи от неё до края поля (Диагональ: [0, 3] = ↗ и ↙)
    //   area: "level" — вся линия поперёк: клетки на той же высоте, что и прицел (поле делится на 4 линии по 3 клетки)
  },

  // ---------- Карты ----------
  // target: "enemy" — враг | "cell" — любая клетка поля | "self" — себя
  //         "hero" — себя или союзника | "ally" — только союзника | "none" — без цели
  // attack: "melee" (только открытые враги) | "ranged" | "aoe"
  // area:   "single" | "adjacent" (клетка + все соседи) | "shape" (фигура из shapes, крутится ПКМ)
  //         "line" — цель + враг за ней; если за целью край поля — рикошет в тот же ряд соседней колонки
  //                  (стрелок справа — влево, слева — вправо, ровно напротив — в обе стороны)
  // shape:  id фигуры из shapes (для area: "shape"), крутится ПКМ
  // fixedShape: id фигуры массовки из shapes (с tests.vectorAoe поворачивается за курсором)
  // icon:   картинка на карте (см. js/icons.js). Цвет картинки — по типу карты: мили красный, дальний зелёный,
  //         массовка оранжевый, блок синий, кооп золотой, особые фиолетовый, слабый удар серый.
  // evolve: id эволюции карты (merge-3, tests.evolution): карта эволюционная — золотая рамка
  // ignoreCover: true — мили бьёт и закрытого врага (Рывок)
  // gift:   дар карты для мерджа в режиме «дар» (id из gifts выше): что получит карта союзника, если отдать ему эту карту
  // weak:   true — слабый удар (серая картинка); у каждого оружия свой (weapons.*.weakCard)
  // effects: damage {amount, hits} | block {amount} | push | stun | taunt | cleanse
  //          sparks {count, amount} — после удара count искр по amount урона в случайных врагов на соседних с целью клетках
  //                 (не в саму цель; всегда ровно amount: без крита, мерджа и проклятия; нет соседей — искры пропадают)
  //          blockSelf {amount} (блок себе) | draw {amount} | energy {amount} (цели-герою или себе) | sharedPool
  //          blockHero {amount, hero} — блок конкретному герою (так работает дар «Прикрытие»)
  //          pull — притянуть врага из заднего ряда вперёд, впереди кто-то есть — меняются местами (Притяжение)
  //          blockParty {amount} (блок всем героям) | damageAllEnemies {amount} (урон всем врагам, без крита)
  // isNew:  true — значок 🆕 на странице «Карты» (cards.html): карта добавлена по заявке и ещё тестируется
  // added:  "17.10.2026" — когда добавлена (видно в подробностях карты на странице «Карты»)
  // Все карты удобно смотреть на странице «Карты»: https://eclipse130300.github.io/backpack-proto/cards.html
  cards: {
    // card-mechanics-1 (21.10): новые поля и эффекты карт —
    //   ricochet: true — родной Рикошет (как дар «Рикошет»): перед ударом выбрать направление, сосед цели туда — 100%
    //   armorBreak: true — по броне врага ×2 | alwaysCrit: true — всегда крит (счётчик оружия не трогает)
    //   area: "rays" + rays / "level" — динамические массовки (см. shapes выше)
    //   effects: buffDamage {amount} — цель до конца боя +amount урона каждой картой (складывается)
    //            buffBlock {amount} — цель до конца боя +amount к блоку от каждой своей карты (складывается)
    //            miss — следующая атака врага по цели промахнётся | stun у массовки — оглушает всех задетых
    //            pick {count} — выбрать 1 из count случайных карт колод всех героев (уходит владельцу в руку)
    //            tutor {count} — на героя: 1 из count случайных карт его колоды и сброса (рука не участвует) → ему в руку
    //   Карты поддержки без gift — их нельзя отдать в мердж.
    // Слабые удары оружия (17.10, эксперимент): ими добивается колода до minDeck. Двигают счётчик крита своего оружия.
    weak_strike:   { name: "Слабый удар",       cost: 1, icon: "fist",   target: "enemy", attack: "melee",  weak: true, effects: [{ type: "damage", amount: 3 }] },
    weak_shot:     { name: "Слабый выстрел",    cost: 1, icon: "arrow",  target: "enemy", attack: "ranged", weak: true, effects: [{ type: "damage", amount: 2 }], isNew: true, added: "17.10.2026" },
    // card-mechanics-1: Искры — 3 выстрела по 1, каждый с шансом 50% уходит в случайного соседа цели
    sparks:        { name: "Искры",             cost: 1, icon: "sparks", target: "enemy", attack: "ranged", weak: true, effects: [{ type: "sparks", count: 3, amount: 1, stray: 0.5 }], isNew: true, added: "21.10.2026" },

    // Меч. card-mechanics-1: Размах заменён Диагональю, добавлено Сотрясение
    // merge-6 (10.11): базовые удары — по 4 копии в колоде вместо слабых ударов. Дар — для союзника (перекрёстно, эксперимент)
    sword_strike:  { name: "Удар мечом",        cost: 1, gift: "covered", icon: "slash", target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 4 }], isNew: true, added: "10.11.2026" },
    cleave:        { name: "Рубящий удар",      cost: 1, gift: "open", icon: "slash",  target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 6 }] },
    sweep:         { name: "Размах",            cost: 2, icon: "sweep",  target: "cell",  attack: "aoe", area: "shape", shape: "line2", fixedShape: "arc3", evolve: "blade_storm", effects: [{ type: "damage", amount: 8 }] },
    great_sweep:   { name: "Мощный размах",     cost: 3, icon: "sweep",  target: "cell",  attack: "aoe", area: "shape", shape: "arc5", fixedShape: "wave4", effects: [{ type: "damage", amount: 5 }], isNew: true, added: "17.10.2026" },
    // merge-6 (10.11): Диагональ — больше не массовка, одиночный мили-удар
    diagonal:      { name: "Диагональ",         cost: 2, gift: "open", icon: "sweep",  target: "enemy", attack: "melee", evolve: "cross", effects: [{ type: "damage", amount: 10 }], isNew: true, added: "10.11.2026" },
    rush:          { name: "Рывок",             cost: 2, gift: "power", icon: "rush",   target: "enemy", attack: "melee", ignoreCover: true, evolve: "breakthrough", effects: [{ type: "damage", amount: 10 }], isNew: true, added: "20.10.2026" },
    crush:         { name: "Сокрушение",        cost: 2, gift: "power", icon: "crush",  target: "enemy", attack: "melee", armorBreak: true, evolve: "executioner", effects: [{ type: "damage", amount: 13 }] },
    // merge-6 (10.11): единственная массовка милишника — цель + клетка за ней, оглушает обе
    quake:         { name: "Сотрясение",        cost: 3, gift: "push", icon: "stun",   target: "cell",  attack: "aoe", area: "shape", shape: "back2", fixedShape: "back2", evolve: "earthquake", effects: [{ type: "damage", amount: 4 }, { type: "stun" }], isNew: true, added: "10.11.2026" },

    // Щит
    shield_bash:   { name: "Удар щитом",        cost: 1, gift: "push", icon: "bash",   target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 4 }, { type: "push" }] },
    shield_wall:   { name: "Стена щитов",       cost: 1, gift: "armor", icon: "shield", target: "self",  effects: [{ type: "block", amount: 7 }] },

    // Посох
    // merge-6 (10.11): базовый удар мага. alt — второй режим: брось на фишку героя → блок (вместо урона)
    spark:         { name: "Искра",             cost: 1, gift: "sharpen", icon: "sparks", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 2 }], alt: { target: "hero", effects: [{ type: "block", amount: 3 }] }, isNew: true, added: "10.11.2026" },
    // 13.11: Разряд — базовая карта мага вместо Искры (4 копии в стартовой колоде), урон 5 → 3
    bolt:          { name: "Разряд",            cost: 1, gift: "chain", icon: "bolt",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }] },
    // 13.11: сильный одиночный удар мага в стартовой колоде (вместо Притяжения)
    fire_arrow:    { name: "Огненная стрела",   cost: 2, gift: "sharpen", icon: "fire", target: "enemy", attack: "ranged", evolve: "incinerate", effects: [{ type: "damage", amount: 12 }], isNew: true, added: "13.11.2026" },
    // merge-6 (10.11): у мага две массовки по 3 клетки (его особенность) — галочка вниз и галочка вверх
    fireball:      { name: "Огненный шар",      cost: 3, gift: "sharpen", icon: "fire",   target: "cell",  attack: "aoe", area: "shape", shape: "chevDown", fixedShape: "chevDown", evolve: "meteor", effects: [{ type: "damage", amount: 8 }] },
    stun_bolt:     { name: "Оглушающий разряд", cost: 2, gift: "power", icon: "stun",   target: "enemy", attack: "ranged", evolve: "thunderer", effects: [{ type: "damage", amount: 3 }, { type: "stun" }] },
    flame_wall:    { name: "Стена огня",        cost: 2, gift: "sharpen", icon: "flames", target: "cell",  attack: "aoe", area: "shape", shape: "chevUp", fixedShape: "chevUp", evolve: "fire_rampart", effects: [{ type: "damage", amount: 5 }] },
    pull:          { name: "Притяжение",        cost: 2, gift: "push", icon: "pull",   target: "enemy", attack: "ranged", evolve: "chain_hook", effects: [{ type: "damage", amount: 7 }, { type: "pull" }], isNew: true, added: "20.10.2026" },
    nova:          { name: "Огненное кольцо",   cost: 2, icon: "nova",   target: "cell",  attack: "aoe", area: "shape", shape: "tri", fixedShape: "tri3l", effects: [{ type: "damage", amount: 6 }] },

    // Лук. card-mechanics-1: Пробивающая стрела → Рикошетная стрела; Град стрел бьёт всю линию поперёк; Верный выстрел
    shot:          { name: "Выстрел",           cost: 1, gift: "open", icon: "arrow", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }], isNew: true, added: "10.11.2026" },
    double_shot:   { name: "Двойной выстрел",   cost: 1, gift: "repeat", icon: "arrows", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3, hits: 2 }] },
    pierce_arrow:  { name: "Рикошетная стрела", cost: 2, gift: "pierce", icon: "pierce", target: "enemy", attack: "ranged", ricochet: true, evolve: "light_spear", effects: [{ type: "damage", amount: 7 }], isNew: true, added: "21.10.2026" },
    knock_arrow:   { name: "Отбрасывающая стрела", cost: 1, gift: "push", icon: "knock", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }, { type: "push" }] },
    // merge-6 (10.11): единственная массовка стрелка — вся линия поперёк, 3 маны
    arrow_rain:    { name: "Град стрел",        cost: 3, gift: "covered", icon: "rain",   target: "cell",  attack: "aoe", area: "level", evolve: "arrow_storm", effects: [{ type: "damage", amount: 8 }], isNew: true, added: "10.11.2026" },
    aimed_shot:    { name: "Прицельный выстрел", cost: 2, gift: "power", icon: "aim",   target: "enemy", attack: "ranged", armorBreak: true, evolve: "deadshot", effects: [{ type: "damage", amount: 10 }] },
    true_shot:     { name: "Верный выстрел",    cost: 3, gift: "power", icon: "aim",    target: "enemy", attack: "ranged", alwaysCrit: true, evolve: "heart_shot", effects: [{ type: "damage", amount: 9 }], isNew: true, added: "21.10.2026" },

    // ---------- Эволюции (merge-3, 20.10, эксперимент — tests.evolution) ----------
    // evolved: true — получается только эволюцией, в колоды не кладётся. Стоимость и урон берутся при эволюции:
    // стоимость = стоимость карты, которая эволюционировала; урон = урон обеих карт (без даров) + их прибавки,
    // все дары обеих карт и родной дар отданной переходят. amount ниже — 0, он заменяется.
    // card-mechanics-1: эволюция не сгорает в конце хода — лежит в руке, пока её не сыграют.
    // special — особое свойство эволюции одной строкой (фиолетовым в подсказке карты)
    // Свойства: mult — множитель урона | returnOnKill — убил цель → карта возвращается в руку
    //   ignoreCover — мили бьёт и закрытого врага | ignoreBlock — урон сквозь блок и броню врага
    //   finisher — враг с ≤50% ХП погибает, иначе урон ×2
    // area: "row" — весь ряд клетки прицела | "all" — все враги | "withCover" — цель и тот, кто её прикрывает
    // effects: pull — притянуть врага из заднего ряда вперёд (впереди кто-то есть — меняются местами)
    //          blockPartyPct {pct} — блок всем героям = pct от урона карты
    blade_storm:   { name: "Вихрь клинков",     evolved: true, special: "бьёт весь ряд, в который целишься", icon: "sweep",  target: "cell",  attack: "aoe", area: "row", effects: [{ type: "damage", amount: 0 }] },
    cross:         { name: "Крест",             evolved: true, special: "бьёт обе диагонали через клетку прицела до края поля", icon: "sweep", target: "cell", attack: "aoe", area: "rays", rays: [0, 3, 2, 5], effects: [{ type: "damage", amount: 0 }] },
    earthquake:    { name: "Землетрясение",     evolved: true, special: "бьёт и оглушает всю линию поперёк", icon: "stun", target: "cell", attack: "aoe", area: "level", effects: [{ type: "damage", amount: 0 }, { type: "stun" }] },
    executioner:   { name: "Палач",             evolved: true, special: "урон ×2; убил цель — карта возвращается в руку", icon: "crush",  target: "enemy", attack: "melee", mult: 2, returnOnKill: true, armorBreak: true, effects: [{ type: "damage", amount: 0 }] },
    breakthrough:  { name: "Прорыв",            evolved: true, special: "бьёт и закрытого врага, и того, кто его прикрывает", icon: "rush",   target: "enemy", attack: "melee", ignoreCover: true, area: "withCover", effects: [{ type: "damage", amount: 0 }] },
    meteor:        { name: "Метеоритный дождь", evolved: true, special: "бьёт всех врагов на поле", icon: "fire",   target: "cell",  attack: "aoe", area: "all", effects: [{ type: "damage", amount: 0 }] },
    fire_rampart:  { name: "Огненный вал",      evolved: true, special: "всем героям блок = 50% урона карты", icon: "flames", target: "cell",  attack: "aoe", area: "shape", shape: "strikeL", fixedShape: "strikeL", effects: [{ type: "damage", amount: 0 }, { type: "blockPartyPct", pct: 0.5 }] },
    thunderer:     { name: "Громовержец",       evolved: true, special: "бьёт цель и весь её ряд, цель оглушена", icon: "stun",   target: "enemy", attack: "ranged", area: "row", effects: [{ type: "damage", amount: 0 }, { type: "stun" }] },
    chain_hook:    { name: "Цепной крюк",       evolved: true, special: "притягивает врага из заднего ряда вперёд (впереди кто-то есть — меняются местами); урон ×2 сквозь блок и броню", icon: "pull",   target: "enemy", attack: "ranged", mult: 2, ignoreBlock: true, effects: [{ type: "damage", amount: 0 }, { type: "pull" }] },
    arrow_storm:   { name: "Ливень стрел",      evolved: true, special: "линия поперёк бьёт дважды", icon: "rain",   target: "cell",  attack: "aoe", area: "level", effects: [{ type: "damage", amount: 0, hits: 2 }] },
    light_spear:   { name: "Копьё света",       evolved: true, special: "бьёт цель и врага за ней, сквозь блок и броню", icon: "pierce", target: "enemy", attack: "ranged", area: "line", ignoreBlock: true, effects: [{ type: "damage", amount: 0 }] },
    deadshot:      { name: "Смертельный выстрел", evolved: true, special: "враг с ≤50% ХП погибает, иначе урон ×2", icon: "aim",  target: "enemy", attack: "ranged", finisher: true, effects: [{ type: "damage", amount: 0 }] },
    incinerate:    { name: "Испепеление",       evolved: true, special: "урон ×2 по цели", icon: "fire", target: "enemy", attack: "ranged", mult: 2, effects: [{ type: "damage", amount: 0 }] },
    heart_shot:    { name: "Выстрел в сердце",  evolved: true, special: "всегда крит, сквозь блок и броню", icon: "aim", target: "enemy", attack: "ranged", alwaysCrit: true, ignoreBlock: true, effects: [{ type: "damage", amount: 0 }] },

    // Кооп-сейвы
    cover:         { name: "Прикрыть",          cost: 1, gift: "cover", icon: "cover",   target: "hero",  effects: [{ type: "block", amount: 6 }] },
    challenge:     { name: "Вызов",             cost: 1, gift: "taunt", icon: "taunt",   target: "enemy", attack: "ranged", effects: [{ type: "taunt" }, { type: "blockSelf", amount: 4 }] },
    // card-mechanics-1: Очищение и Барьер убраны из колоды мага (проклятия больше нет)
    purify:        { name: "Очищение",          cost: 1, icon: "purify",  target: "hero",  effects: [{ type: "cleanse" }, { type: "block", amount: 3 }] },
    barrier:       { name: "Барьер",            cost: 1, gift: "armor", icon: "barrier", target: "hero",  effects: [{ type: "block", amount: 5 }] },

    // ---------- Поддержка (card-mechanics-1, 21.10, эксперимент). Без дара — в мердж не отдаются ----------
    // Маг
    flow:          { name: "Поток",             cost: 0, icon: "bolt",    target: "ally", effects: [{ type: "energy", amount: 1 }], isNew: true, added: "21.10.2026" },
    insight:       { name: "Прозрение",         cost: 0, icon: "purify",  target: "none", effects: [{ type: "pick", count: 3 }], isNew: true, added: "21.10.2026" },
    might:         { name: "Сила",              cost: 0, icon: "unity",   target: "hero", effects: [{ type: "buffDamage", amount: 1 }], isNew: true, added: "21.10.2026" },
    // Милишник
    battle_cry:    { name: "Боевой клич",       cost: 1, icon: "taunt",   target: "hero", effects: [{ type: "energy", amount: 2 }], isNew: true, added: "21.10.2026" },
    // Поиск (24.10): на себя или союзника — 1 из 3 случайных карт из колоды и сброса этого героя (рука не участвует), с мердж-бонусами
    search:        { name: "Поиск",             cost: 1, icon: "oath",    target: "hero", effects: [{ type: "tutor", count: 3 }], isNew: true, added: "24.10.2026" },
    fortitude:     { name: "Стойкость",         cost: 0, icon: "barrier", target: "hero", effects: [{ type: "buffBlock", amount: 1 }], isNew: true, added: "21.10.2026" },
    // Стрелок
    quiver:        { name: "Колчан",            cost: 1, icon: "arrows",  target: "self", effects: [{ type: "draw", amount: 2 }], isNew: true, added: "21.10.2026" },
    smoke:         { name: "Дымовая завеса",    cost: 1, icon: "cover",   target: "hero", effects: [{ type: "miss", amount: 1 }], isNew: true, added: "21.10.2026" },

  },

  // ---------- Оружие и щиты (главный источник карт) ----------
  // РЕШЕНО: щит — отдельный тип снаряжения. Оружием наносишь урон, щитом защищаешься.
  // kind: "weapon" — оружие | "shield" — щит. icon — значок у героя (см. js/icons.js).
  // critEvery — крит раз в N ударов этим оружием; счётчик живёт весь бой. Сколько осталось — пишется на карте. 0 — без крита.
  // merge-6 (10.11): базовые удары (Удар мечом / Искра / Выстрел) по 4 копии, вторая Стена щитов и второе Притяжение (дубли редких даров).
  // weakCard — слабый удар этого оружия: им добивается колода героя до rules.minDeck (берётся первое оружие героя с weakCard).
  // У щита слабого удара нет (щиты разберём позже).
  // Пока щит только у милишника (щиты разберём позже).
  weapons: {
    sword:  { name: "Меч",   kind: "weapon", icon: "w_sword",  critEvery: 3, weakCard: "weak_strike", cards: { sword_strike: 4, cleave: 2, diagonal: 1, rush: 1, crush: 1, quake: 1 } },
    shield: { name: "Щит",   kind: "shield", icon: "w_shield", critEvery: 0, cards: { shield_bash: 1, shield_wall: 2 } },
    staff:  { name: "Посох", kind: "weapon", icon: "w_staff",  critEvery: 4, weakCard: "sparks", cards: { bolt: 4, fire_arrow: 1, fireball: 1, stun_bolt: 1, flame_wall: 1, pull: 2 } },   // 13.11: Искра убрана, Разряд — базовая карта
    // merge-4 (24.10): вторая Рикошетная стрела — чтобы дар Рикошет можно было собрать в 2 копии (300%)
    bow:    { name: "Лук",   kind: "weapon", icon: "w_bow",    critEvery: 4, weakCard: "weak_shot", cards: { shot: 4, double_shot: 2, pierce_arrow: 2, knock_arrow: 1, arrow_rain: 1, aimed_shot: 1, true_shot: 1 } }
  },

  // ---------- Герои ----------
  // Классов нет: колода = карты оружия и щита + доп. карты (cards) + слабые удары своего оружия до минимума.
  // В режиме общей колоды (tests.sharedDeck) доп. карты героя уходят в общую колоду.
  // hp — макс. ХП (переносится между боями, лечения нет).
  // startBlock — запас блока на бой: тратится после обычного блока, между ходами не восстанавливается, обновляется в начале боя.
  // icon — портрет (см. js/icons.js)
  // Баланс (ХП героев и врагов, состав боёв) подобран симулятором: node tools/balance-sim.js — см. README.
  heroes: [
    // card-mechanics-1 (21.10): карты поддержки — у мага Поток, Прозрение, Сила; у милишника Боевой клич, Поиск, Стойкость;
    // у стрелка Колчан и Дымовая завеса. Блок только у милишника и стрелка (Барьер и Очищение у мага убраны).
    { id: "melee",  name: "Милишник", icon: "helm", hp: 85, startBlock: 4, weapons: ["sword", "shield"], cards: { cover: 1, challenge: 1, battle_cry: 1, search: 1, fortitude: 1 } },
    { id: "mage",   name: "Маг",      icon: "hat",  hp: 60, startBlock: 2, weapons: ["staff"],        cards: { flow: 1, insight: 1, might: 1 } },
    { id: "ranger", name: "Стрелок",  icon: "hood", hp: 68, startBlock: 2, weapons: ["bow"],          cards: { cover: 1, quiver: 1, smoke: 1 } }
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
    // 20.10 (ветка merge-3, бот medium): бои стали длиннее из-за подкреплений (8 врагов за бой) — урон врагов ×0.65
    // card-mechanics-1 (21.10, эксперимент): armor — стартовая броня (≈четверть прежнего ХП перешла в броню).
    //   Урон идёт: блок → броня → ХП. Броня не сгорает в конце хода. Карты с armorBreak бьют по броне ×2.
    //   attack {..., armor: N} — удар, после которого враг получает N брони. Раненый враг (≤50% ХП) выбирает действие
    //   с бронёй (не два раза подряд). Проклятие убрано (заменено ударом с бронёй).
    //   disable {targets} — вывести героя из игры на его следующий ход (только Жрец).
    // merge-4 (24.10, бот medium): мердж больше не передаёт урон — ХП врагов срезано: Упырь 40→36, Гончая 25→22,
    //   Культист 28→25, Лучник 24→22, Громила 58→52, Жрец 72→60 (medium 55% → ~67%)
    // merge-6 (10.11, боты medium ~70%): ХП врагов ×0.85 (Упырь 36→31, Гончая 22→19, Культист 25→21, Лучник 22→19, Громила 52→44),
    //   Жрец ХП 60→42 и удар 10→8 — без массовок и Зоны пати бьёт по площади слабее.
    ghoul:   { name: "Упырь",        hp: 31, armor: 15, melee: true,  actions: [{ type: "attack", damage: 5 }, { type: "attack", damage: 3, targets: 2, armor: 4 }] },
    hound:   { name: "Гончая",       hp: 19, armor: 8,  melee: true,  actions: [{ type: "attack", damage: 3 }, { type: "attack", damage: 5 }] },
    cultist: { name: "Культист",     hp: 21, armor: 9,  melee: false, actions: [{ type: "attack", damage: 4, armor: 5 }, { type: "attack", damage: 6 }] },
    archer:  { name: "Костяной лучник", hp: 19, armor: 7, melee: false, actions: [{ type: "attack", damage: 2, targets: 3 }, { type: "attack", damage: 4 }] },
    brute:   { name: "Громила",      hp: 44, armor: 30, melee: true,  actions: [{ type: "attack", damage: 3, armor: 8 }, { type: "attack", damage: 6, targets: 3 }] },
    // Жрец (финальный босс): выводит героя из игры на ход, удар с бронёй вместо проклятия.
    // Баланс 21.10 (card-mechanics-1, бот medium): с выводом героя medium выигрывал 33% — ХП 95→72, броня 30→25, удары 12→10 и 7×2→6×2 (≈66%)
    priest:  { name: "Падший жрец",  hp: 42, armor: 25, melee: false, actions: [{ type: "attack", damage: 8 }, { type: "disable", targets: 1 }, { type: "attack", damage: 6, targets: 2 }, { type: "attack", damage: 5, targets: 3, armor: 10 }] }
  },


  // =====================================================================
  //  МЕТА ЗАБЕГА (ветка beta-meta, 11.11): карта похода, награды, костёр, кузница, сокровище.
  //  Код — js/meta.js (колоды забега, улучшения, награды) и js/runmap.js (карта, голосование, бои по волнам).
  // =====================================================================
  meta: {
    // ---------- Стартовые колоды (как в Slay the Spire, только меньше: 8–9 карт) ----------
    // Карта: сколько копий. Оружие карты определяется само (по оружию героя). Остальные карты героя — в пуле наград.
    start: {
      melee:  { sword_strike: 4, shield_wall: 2, cover: 1, shield_bash: 1, crush: 1 },
      mage:   { bolt: 4, barrier: 2, fire_arrow: 1, flame_wall: 1 },   // 11.11: магу массовка с начала; 13.11: Искра → Разряд ×4, Притяжение → Огненная стрела
      ranger: { shot: 4, cover: 2, double_shot: 1, pierce_arrow: 1 }
    },
    // Пул новых карт героя = карты его оружия + его доп. карты (heroes.*.cards) + extra ниже.
    extraPool: { mage: ["barrier"] },
    // 11.11: базовые карты стартовой колоды как «новая карта» не предлагаются (хлам). Копии (дубли) — можно, но см. dupeFrom.
    noReward: ["sword_strike", "bolt", "shot", "shield_wall", "barrier", "cover"],
    dupeFrom: 4,              // дубли (копия карты из колоды) — только в наградах с 4-го боя забега (за первые 3 боя — нет)
    // Редкость карт: common (обычная) | uncommon (средняя) | rare (редкая).
    // Кого нет в списке: эволюционные и за 3 энергии — rare, за 2 — uncommon, остальные — common.
    cardRarity: { might: "uncommon", fortitude: "uncommon", flow: "uncommon", insight: "uncommon", search: "uncommon", battle_cry: "uncommon" },

    // ---------- Улучшения ----------
    upgradeMode: "percent",   // как работает «+Урон/+Блок» (награда и кузница): "percent" — +50% | "flat" — +3
    upPercent: 0.5,           // прибавка в режиме percent (складывается: 2 улучшения = +100%). Дробное — вверх
    upFlat: 3,                // прибавка в режиме flat (2 улучшения = +6)
    multiUpgrade: true,       // одну карту можно улучшать несколько раз. false — улучшенная карта больше не предлагается
    minDeck: 8,               // 11.11: в колоде героя не меньше 8 карт — в кузнице нельзя удалить карту, если их уже 8
    campHeal: 0.3,            // костёр лечит каждому герою 30% макс. ХП
    // Мердж-кузня (11.11): мердж как в бою (дар уходит карте союзника, две готовые эволюционные — эволюция), но НАВСЕГДА.
    // Каждый герой может отдать одну карту за посещение. Результат получает владелец карты, НА которую мерджили.
    mforgeDestroy: true,      // true — обе исходные карты уничтожаются (колода −1); false — остаются, результат добавляется (колода +1)
    // Шансы наград. card — редкость карты в слоте 1: [обычная, средняя, редкая]. dupe — шанс, что слот 1 = копия карты из колоды.
    // up — слоты 2–3. После обычного боя оба обычные, но каждый с шансом uncommonChance становится средним.
    // После элиты и в сокровище — одно среднее + одно редкое.
    rewards: {
      fight:    { card: [55, 35, 10], dupe: 0.25, uncommonChance: 0.15 },
      elite:    { card: [20, 50, 30], dupe: 0.2 },
      treasure: { card: [0, 40, 60],  dupe: 0 }   // сокровища на карте сейчас нет (11.11 → мердж-кузни), оставлено на будущее
    },
    // id: tier (common | uncommon | rare), on: card — на конкретную карту, hero — герою, party — всей пати.
    // Тексты — для экрана наград и окна «Улучшения». Поведение — js/meta.js (apply) и engine.js.
    upgrades: {
      up:          { tier: "common",   on: "card",  icon: "⬆", name: "Усиление",      text: "+50% урона (или блока) карте — или +3, по переключателю upgradeMode" },
      gift:        { tier: "common",   on: "card",  icon: "🎁", name: "Дар",           text: "карта получает постоянный дар; при мердже он уходит вместе с остальными дарами" },
      draw:        { tier: "common",   on: "card",  icon: "🂠", name: "Добор",         text: "сыграл карту — возьми ещё одну" },
      inspire:     { tier: "common",   on: "card",  icon: "✨", name: "Воодушевление", text: "следующая атака любого героя пати бьёт на +50%" },
      feed:        { tier: "common",   on: "card",  icon: "🔋", name: "Подпитка",      text: "отдал эту карту мерджем — союзник получает +1 энергии" },
      armorbreak:  { tier: "common",   on: "card",  icon: "⬢", name: "Бронебой",      text: "урон по броне врага ×2" },
      maxhp:       { tier: "common",   on: "hero",  icon: "❤", name: "Здоровье",      text: "+8 к макс. ХП героя (и сразу +8 ХП)" },
      startblock:  { tier: "common",   on: "hero",  icon: "⛨", name: "Закалка",       text: "+2 к стартовому блоку героя в каждом бою" },
      cheaper:     { tier: "uncommon", on: "card",  icon: "⚡", name: "Удешевление",   text: "карта стоит на 1 энергию меньше (не меньше 0)" },
      retain:      { tier: "uncommon", on: "card",  icon: "📌", name: "Удержание",     text: "карта не сбрасывается в конце хода" },
      innate:      { tier: "uncommon", on: "card",  icon: "☝", name: "Первая в руке", text: "карта всегда приходит в первую руку боя" },
      sharp:       { tier: "uncommon", on: "card",  icon: "🗡", name: "Острота",       text: "крит этой картой на 1 удар раньше (раз в 3 вместо 4)" },
      freemerge:   { tier: "uncommon", on: "card",  icon: "🤲", name: "Лёгкая передача", text: "мердж этой картой бесплатный" },
      killenergy:  { tier: "uncommon", on: "card",  icon: "💀", name: "Добивающая",    text: "убила врага — +1 энергии" },
      echo:        { tier: "rare",     on: "card",  icon: "🔁", name: "Эхо",           text: "раз за бой: после первого розыгрыша карта возвращается в руку" },
      awaken:      { tier: "rare",     on: "card",  icon: "🌟", name: "Пробуждение",   text: "карта становится эволюционной (золотая рамка)" },
      strength:    { tier: "rare",     on: "hero",  icon: "💪", name: "Сила навсегда", text: "+1 к урону всех атак героя до конца забега" },
      fortitude:   { tier: "rare",     on: "hero",  icon: "🛡", name: "Стойкость навсегда", text: "+1 к блоку всех карт героя до конца забега" },
      ignorecover: { tier: "rare",     on: "card",  icon: "👻", name: "Сквозная",      text: "мили-карта бьёт и закрытых врагов" },
      generous:    { tier: "rare",     on: "card",  icon: "💞", name: "Щедрая",        text: "при мердже передаёт дары дважды" },
      partymerge:  { tier: "rare",     on: "party", icon: "🤝", name: "На всю пати",   text: "первый мердж каждого хода бесплатный для всех", eliteOnly: true }
    },

    // ---------- Карта похода (генерируется каждый забег) ----------
    // floors — этажей до босса, width — дорожек. Этажи 1–2 — только лёгкие бои; последний этаж перед боссом — костёр;
    // этаж campFloor — по краям костры, в центре бой (передышка в середине пути).
    // mforges — мердж-кузни (11.11, вместо сокровища): стоят сразу ЗА элитой, попасть в них можно только из элиты.
    // Остальные узлы — по весам weights. Элита — не раньше eliteFrom этажа. Кузниц на карте forges.
    map: { floors: 13, width: 3, campFloor: 7, eliteFrom: 4, forges: 2, mforges: 3,
      weights: { w2: 45, w3: 38, elite: 17 } },

    // ---------- Бои по волнам ----------
    // Бой = несколько волн. Первая волна стоит на поле, следующие выходят подкреплением (tests.reinforcements:
    // каждые every ходов или сразу, когда поле зачищено). Ориентир (11.11): 2 волны ≈ 2–3 хода, 3 волны ≈ 4, элита ≈ 5–6, босс ≈ 6.
    // Волна — список врагов; мили встают вперёд, дальники — назад (за мили, если можно).
    // Баланс ботами (11.11, medium, цель ~70% побед за забег): врагов меньше по ХП, но бьют сильнее — бои короче, а ХП тает
    // merge-7 (12.11, боты medium 2×12 забегов, ~67% побед): враги толще, бои 4–8 ходов (стычка ~5, бой ~6, элита ~8, босс ~7),
    //   кривая сложности: в начале мягко, рост за этаж сильнее (этаж 12 — ХП +88%, урон +66%). Было: 0.4 / 0.04 / 2.4 / 0.025
    enemyHp: 0.75,            // множитель ХП и брони всех врагов в забеге
    hpPerFloor: 0.08,         // + к ХП и броне врагов за каждый этаж
    enemyDmg: 1.05,           // множитель урона всех врагов в забеге
    dmgPerFloor: 0.06,        // + к урону врагов за каждый этаж
    fights: {
      w2:    { name: "Стычка (2 волны)",   waves: 2 },
      w3:    { name: "Бой (3 волны)",      waves: 3 },
      elite: { name: "Элита (4 волны)",    waves: 4, first: "elite" },
      boss:  { name: "Босс: Падший жрец",  waves: 3, first: "boss" }
    },
    // merge-7 (12.11): виды обычных боёв — разнообразие встреч. on — к каким боям, weight — вес, first/next — списки волн ниже,
    // hp / dmg — доп. множители ХП и урона врагов этого вида, name — приписка к названию боя.
    //   mixed — обычный; thick — 1–2 толстых врага (окупается накачанная мерджем карта); swarm — 4–5 мелких (Цепь, Рикошет, массовки)
    flavors: {
      mixed: { on: ["w2", "w3"], weight: 50 },
      thick: { on: ["w2", "w3"], weight: 25, first: "thick", next: "thickNext", hp: 1.3, name: "толстые" },
      swarm: { on: ["w2", "w3"], weight: 25, first: "swarm", next: "swarmNext", hp: 0.5, dmg: 0.6, name: "рой" }
    },
    waves: {
      thick: [["brute"], ["brute", "ghoul"], ["ghoul", "ghoul"]],
      thickNext: [["brute"], ["ghoul"], ["ghoul", "cultist"]],
      swarm: [["hound", "hound", "hound", "archer", "hound"], ["hound", "archer", "hound", "archer", "cultist"], ["hound", "hound", "cultist", "hound"]],
      swarmNext: [["hound", "hound", "hound"], ["archer", "hound", "archer"], ["hound", "cultist", "hound"]],
      first: [["ghoul", "cultist", "hound"], ["hound", "hound", "archer"], ["ghoul", "ghoul", "archer"], ["ghoul", "hound", "cultist"], ["hound", "hound", "cultist"]],
      next:  [["hound", "hound"], ["ghoul", "archer"], ["cultist", "hound"], ["ghoul", "hound"], ["archer", "hound"], ["ghoul", "cultist"]],
      elite: [["brute", "cultist", "hound"], ["brute", "archer", "ghoul"]],
      boss:  [["priest", "ghoul", "ghoul", "archer"]]
    }
  }
};
