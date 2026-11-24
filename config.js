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
  version: 20,   // wide-range (24.11): новые карты, мердж-сложение, статусы

  // ---------- Базовые правила боя ----------
  rules: {
    cols: 6, rows: 3,            // wide-range (24.11, тест): поле 6×3 — 6 колонок по 3 клетки строго друг за другом (было 6×2).
                                 // Передний прикрывает всех, кто стоит за ним в колонке
    drawPerTurn: 4,              // РЕШЕНО (17.10): в начале хода каждый герой берёт ровно N карт (не «до N»). Несгоревшая квестовая карта
                                 // остаётся сверху — тогда в руке 5. Предела руки пока нет (рука рассчитана на 4 карты, больше — накладываются)
    energy: 3,                   // энергия героя каждый ход
    // merge-6 (10.11): добивки до минимума больше нет — стартовая колода как в Slay the Spire (базовые удары по 4 копии).
    minDeck: 0,                  // минимум карт в колоде; недобор = слабые удары ОРУЖИЯ героя (weapons.*.weakCard). 0 — не добивать
    fillerCard: "weak_strike",   // запасная добивка: герою без weakCard у оружия; в общей колоде — «слабый удар», который подстраивается под вытянувшего героя
    endFightDelayMs: 2500,       // после конца боя экран ~2.5 с заблокирован (досмотреть цифры урона), потом окно итогов
    critMultiplier: 2,           // множитель крита
    // card-mechanics-1 (21.10): условного крита ×2 по оглушённому/толкнутому больше нет. Вместо него:
    // wide-range (24.11): столкновение — общее правило: толкнули врага в другого врага — ОБА получают стак Уязвимости
    // (край поля не считается). Уязвимость: +collisionBonus урона за стак до конца хода игроков (2 стака = +100%).
    // Складывается с критом (×2 + 50% = ×2.5). Уязвимость с карт — те же стаки.
    collisionBonus: 0.5,
    collisionDamage: 0,          // урон обоим при столкновении (wide-range: 0 — урона нет, только Уязвимость)
    partyHand: 15,               // wide-range (24.11): максимум карт в руках всей пати; добор сверх лимита сгорает (уходит в сброс)
    markBonus: 0.5,              // Метка: следующий удар по врагу +50%
    weakFactor: 0.5,             // Слабость врага: его ближайшая атака ×0.5
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
    merge: { enabled: true, mode: "sum", payCost: true, donorDamage: 0.5, keepDamage: true, lifetime: "all", aoeReceive: false,
      // wide-range (24.11, РЕШЕНО 21.11): mode "sum" — мердж = сложение (js/wide.js). Перетащил свою карту на карту в руке союзника:
      //   урон + урон, все базовые эффекты и ключевые слова твоей карты переходят его карте и бьют по её цели. Позиционка (толчки) не переходит.
      //   Платишь стоимость своей карты. В карту — только один донор. После розыгрыша карты распадаются, каждая — в сброс своего владельца.
      //   Срабатывают эффекты мерджа (config.mergeFx) с цветных плашек карт.
      // unplayed — что с несыгранной смердженной картой в конце хода:
      //   "split" — распадается: обе карты уходят каждая в свой сброс | "lose" — отданная карта пропадает до конца боя
      unplayed: "split",
      // mfxFromRewards — true: карты приходят без эффектов мерджа, эффекты выпадают только наградами после боя
      //   (ограничения с fixed: true стоят всегда). false — карты сразу со своими эффектами (для теста).
      mfxFromRewards: false },

    // Векторные массовки (merge-7, 12.11): у массовки своя фигура (fixedShape у карты); наводишься на клетку,
    // и фигура поворачивается в сторону курсора (6 направлений хекса). Клетки за краем поля пропадают.
    // false — фигура неподвижна.
    vectorAoe: { enabled: true },

    // Эволюция (merge-3, 20.10, эксперимент). Карта с полем evolve (эволюционная, золотая рамка) — это все карты за 2+ энергии.
    // Две эволюционные карты РАЗНЫХ героев, обе уже мерджнутые (★), светятся фиолетовым. Перетащил одну на другую —
    // та, НА КОТОРУЮ тащили, превращается в свою эволюцию (cards.<evolve>): урон обеих складывается, дары переходят.
    // Эволюция живёт до конца боя. Отданная карта уходит в сброс чистой. Подробно — js/evolve.js.
    evolution: { enabled: false },   // wide-range: эволюция как правило убрана (станет редким эффектом мерджа)

    // wide-range (24.11): стартовая броня героев (heroes.*.startBlock). false — выключена
    startBlock: { enabled: false },

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
    arc5:    { name: "широкий уголок из 5 клеток", steps: [[], [2], [2, 2], [0], [0, 0]] },
    // wide-range (24.11): Огненный клин — 3 клетки вглубь от прицела
    deep3:   { name: "3 клетки вглубь", steps: [[], [1], [1, 1]] }
    // card-mechanics-1 (21.10): динамические массовки — не фигуры, а поле карты area:
    //   area: "rays", rays: [направления] — клетка прицела + лучи от неё до края поля (Диагональ: [0, 3] = ↗ и ↙)
    //   area: "level" — вся линия поперёк: клетки на той же высоте, что и прицел (поле делится на 4 линии по 3 клетки)
  },

  // ---------- Эффекты мерджа (wide-range, 24.11) ----------
  // Плашка на карте. side: "in" (🟩 зелёная) — срабатывает, когда В ЭТУ карту вмерджили, условие — про входящую карту;
  //   "out" (🟥 красная) — срабатывает, когда ЭТУ карту отдают, условие — про карту, в которую кладут; "both" (🟩🟥) — оба случая.
  // cond (необязательно): cost — другая карта стоит ровно N | costMin — стоит N и больше | kind — "attack" / "block" / "aoe"
  //   | otherClass — другая карта чужого героя | hpBelow — у героя с этой картой ХП не больше доли (0.5 = 50%)
  //   | critReady — у героя с этой картой «Крит готов».
  // do — что делает. На карту: dmg (+урон), block (+броня), cap (мердж даёт урона не больше N), crit (эта атака критует),
  //   cheaper (−стоимость), retain (Удержание), ricoDmg (+урон рикошета), rico (+рикошет), chainDmg (+урон прыжка цепи),
  //   barrier (+Барьер), durFight (Сила/Стойкость карты — на бой, а не на ход), blockFirst (броня даётся до удара).
  //   Сразу при мердже (герою): draw, str {+dur}, tough {+dur}, fadeHold (Угасание в этот ход не тикает),
  //   copy (копия отданной карты в руку отдавшему, сгорает после розыгрыша), critMove («Крит готов» переходит получателю).
  //   Кому «сразу»: у 🟩 — герою, в чью карту вмерджили; у 🟥 — герою, который получил карту (copy — отдавшему).
  // fixed: true — ограничение, стоит на карте всегда (даже когда эффекты мерджа приходят только наградами).
  // pool: true — общий пул: такой эффект может выпасть наградой любой карте; w — веса по стоимости карты [0, 1, 2, 3+].
  mergeFx: {
    atk_dmg2:      { side: "in",   cond: { kind: "attack" },  do: { dmg: 2 },               text: "Атака → +2 урона" },
    draw1:         { side: "in",                              do: { draw: 1 },              text: "→ Возьми карту", pool: true, w: [1, 1, 2, 4] },
    cheaper:       { side: "in",                              do: { cheaper: 1 },           text: "→ Стоит на 1 меньше", pool: true, w: [0, 1, 2, 2] },
    retain_both:   { side: "both",                            do: { retain: true },         text: "→ Удержание", pool: true, w: [1, 1, 1, 1] },
    copy_out:      { side: "out",                             do: { copy: true },           text: "→ Копия этой карты в руку", pool: true, w: [2, 1, 1, 1] },
    cost1_block3:  { side: "in",   cond: { cost: 1 },         do: { block: 3 },             text: "Карта стоит 1 → +3 брони" },
    def_block3:    { side: "in",   cond: { kind: "block" },   do: { block: 3 },             text: "Защита → +3 брони" },
    def_first:     { side: "in",   cond: { kind: "block" },   do: { blockFirst: true },     text: "Защита → её броня даётся до удара" },
    cost3_fight:   { side: "in",   cond: { cost: 3 },         do: { durFight: true },       text: "Карта стоит 3 → на бой вместо хода" },
    hp50_tough1:   { side: "in",   cond: { hpBelow: 0.5 },    do: { tough: 1, dur: "fight" }, text: "ХП героя ≤50% → +1 Стойкости на бой" },
    cost2_str1:    { side: "in",   cond: { costMin: 2 },      do: { str: 1, dur: "fight" }, text: "Карта стоит 2+ → +1 Силы на бой" },
    other_str1:    { side: "in",   cond: { otherClass: true }, do: { str: 1, dur: "fight" }, text: "Карта другого класса → +1 Силы на бой" },
    hp50_str2:     { side: "in",   cond: { hpBelow: 0.5 },    do: { str: 2, dur: "turn" },  text: "ХП героя ≤50% → ещё +2 Силы на ход" },
    fade_hold:     { side: "both",                            do: { fadeHold: true },       text: "→ Угасание в этот ход не тикает" },
    cap2:          { side: "in",                              do: { cap: 2 },               text: "Мердж даёт максимум +2 урона", fixed: true },
    cost1_rico2:   { side: "in",   cond: { cost: 1 },         do: { ricoDmg: 2 },           text: "Карта стоит 1 → +2 урона рикошета" },
    atk_rico1:     { side: "in",   cond: { kind: "attack" },  do: { rico: 1 },              text: "Атака → +1 рикошет" },
    crit_move:     { side: "out",  cond: { critReady: true }, do: { critMove: true },       text: "У героя «Крит готов» → он переходит герою, которому отдали" },
    cost1_crit:    { side: "in",   cond: { cost: 1 },         do: { crit: true },           text: "Карта стоит 1 → эта атака критует" },
    atk_chain2:    { side: "in",   cond: { kind: "attack" },  do: { chainDmg: 2 },          text: "Атака → прыжок +2" },
    cost2_barrier: { side: "in",   cond: { costMin: 2 },      do: { barrier: 1 },           text: "Карта стоит 2+ → Барьер 2" },
    aoe_str1:      { side: "in",   cond: { kind: "aoe" },     do: { str: 1, dur: "turn" },  text: "Массовка → ещё +1 Силы на ход" }
  },

  // ---------- Карты ----------
  // wide-range (24.11): карты из артефакта «Backpack RPG — билды и карты» (этап 1: воин целиком, лучник — крит и клей, маг — массовки и клей).
  // target: "enemy" — враг | "cell" — клетка поля | "self" — себя | "hero" — себя или союзника | "ally" — союзника | "none" — без цели
  // attack: "melee" (только открытые враги) | "ranged" | "aoe"
  // area: "shape" + fixedShape (фигура из shapes, с tests.vectorAoe крутится за курсором) | "adjacent" (клетка + соседи) | "row" (весь ряд)
  // Свойства карты: power: true — Power (эффект на весь бой, после розыгрыша уходит из колоды до конца боя, не мерджится)
  //   ex: true — Exhaust (после розыгрыша уходит до конца боя) | retain: true — Удержание | innate: true — первая рука боя
  //   noMerge: true — не мерджится | strMult: 3 — Сила действует трижды | dmgFromBlock: true — урон = текущая броня героя (+ урон карты)
  //   critMult: 3 — крит ×3 вместо ×2 | ricochet: 1 — рикошет (направление выбираешь), ricoDmg — урон рикошета (без него = урону карты)
  //   chain: 1 — цепь (прыжок на соседа цели с наименьшим ХП), chainDmg — урон прыжка
  //   mfx: ["id", …] — эффекты мерджа (из mergeFx выше) | rarity: "common" / "uncommon" / "rare" | build: билды (для страницы «Карты»)
  // effects: damage {amount, hits} | block {amount} (себе, или цели у карт на героя) | blockSelf {amount} | draw {amount} | energy {amount}
  //   push {dir?, far?} — толкнуть (dir — направление; без него выбираешь; far: true — до столкновения) | pushOut — растолкать соседей от клетки
  //   str {amount, dur: "turn"|"fight", party?} — Сила (+урон каждым ударом) | tough {amount, dur, party?} — Стойкость (+броня от карт)
  //   critReady — следующий удар героя критует | mark — Метка на цель (следующий удар по ней +50%)
  //   missEnemy — враг-цель промахивается всеми ударами в этот ход | barrier {amount} — Барьер N (блокирует N любых ударов)
  //   Power: thorns {amount} (Шипы) | keepBlock (броня не сгорает) | mergeStr {amount} (вмерджили в карту героя — +Сила на бой)
  //          critShift {amount} (счётчик крита −N на бой) | aoeBonus {amount} (массовки героя +урон) | fade {now, per, turns} (Угасание)
  //   stun — оглушить
  // Все карты удобно смотреть на странице «Карты»: cards.html
  cards: {
    // Слабые удары (старые, в колоды wide-range не входят — нужны коду добивки)
    weak_strike:   { name: "Слабый удар",       cost: 1, icon: "fist",   target: "enemy", attack: "melee",  weak: true, effects: [{ type: "damage", amount: 3 }] },
    weak_shot:     { name: "Слабый выстрел",    cost: 1, icon: "arrow",  target: "enemy", attack: "ranged", weak: true, effects: [{ type: "damage", amount: 2 }] },
    sparks:        { name: "Искры",             cost: 1, icon: "sparks", target: "enemy", attack: "ranged", weak: true, effects: [{ type: "sparks", count: 3, amount: 1, stray: 0.5 }] },

    // ===== Воин: Защитник / Сила / Берсерк =====
    w_strike:   { name: "Удар",             cost: 1, icon: "slash",  target: "enemy", attack: "melee", rarity: "common", effects: [{ type: "damage", amount: 5 }] },
    w_defend:   { name: "Защита",           cost: 1, icon: "shield", target: "self", rarity: "common", effects: [{ type: "block", amount: 5 }] },
    w_ram:      { name: "Таран",            cost: 2, icon: "bash",   target: "enemy", attack: "melee", rarity: "common", build: ["def", "str"], mfx: ["atk_dmg2"], effects: [{ type: "damage", amount: 8 }, { type: "push", dir: 1, far: true }] },
    w_cleave:   { name: "Рассечь",          cost: 1, icon: "slash",  target: "enemy", attack: "melee", rarity: "common", mfx: ["draw1"], effects: [{ type: "damage", amount: 7 }] },
    w_swordshield: { name: "Щит и меч",     cost: 1, icon: "bash",   target: "enemy", attack: "melee", rarity: "common", build: ["def"], mfx: ["cost1_block3"], effects: [{ type: "damage", amount: 5 }, { type: "blockSelf", amount: 5 }] },
    w_cover:    { name: "Прикрыть",         cost: 1, icon: "cover",  target: "hero", rarity: "common", build: ["def"], mfx: ["def_block3"], effects: [{ type: "block", amount: 7 }] },
    w_warcry:   { name: "Боевой клич",      cost: 1, icon: "taunt",  target: "none", ex: true, rarity: "common", build: ["str", "ber"], mfx: ["cost3_fight"], effects: [{ type: "str", amount: 1, dur: "turn", party: true }] },
    w_wall:     { name: "Стена щитов",      cost: 2, icon: "shield", target: "self", rarity: "common", build: ["def"], mfx: ["def_block3"], effects: [{ type: "block", amount: 12 }] },
    w_bash:     { name: "Удар щитом",       cost: 1, icon: "bash",   target: "enemy", attack: "melee", dmgFromBlock: true, rarity: "uncommon", build: ["def"], mfx: ["def_first"], effects: [{ type: "damage", amount: 0 }] },
    w_unbreak:  { name: "Несокрушимость",   cost: 3, icon: "barrier", target: "none", power: true, rarity: "rare", build: ["def"], effects: [{ type: "keepBlock" }] },
    w_spikes:   { name: "Шипастый доспех",  cost: 1, icon: "shield", target: "none", power: true, rarity: "common", build: ["def"], effects: [{ type: "thorns", amount: 3 }] },
    w_stance:   { name: "Стойка",           cost: 1, icon: "shield", target: "self", rarity: "common", build: ["def"], mfx: ["hp50_tough1"], effects: [{ type: "block", amount: 4 }, { type: "tough", amount: 1, dur: "fight" }] },
    w_temper:   { name: "Закалка",          cost: 1, icon: "unity",  target: "none", power: true, rarity: "common", build: ["str"], effects: [{ type: "str", amount: 2, dur: "fight" }] },
    w_comrades: { name: "Ярость товарищей", cost: 2, icon: "unity",  target: "none", power: true, rarity: "rare", build: ["str"], effects: [{ type: "mergeStr", amount: 1 }] },
    w_heavy:    { name: "Тяжёлый удар",     cost: 2, icon: "crush",  target: "enemy", attack: "melee", strMult: 3, rarity: "uncommon", build: ["str"], mfx: ["cost2_str1"], effects: [{ type: "damage", amount: 12 }] },
    w_feed:     { name: "Подпитка",         cost: 1, icon: "slash",  target: "enemy", attack: "melee", rarity: "common", build: ["str"], mfx: ["other_str1"], effects: [{ type: "damage", amount: 6 }] },
    w_frenzy:   { name: "Боевое безумие",   cost: 2, icon: "rush",   target: "none", power: true, rarity: "uncommon", build: ["ber"], effects: [{ type: "fade", now: 8, per: 3, turns: 3 }] },
    w_dash:     { name: "Рывок",            cost: 0, icon: "rush",   target: "enemy", attack: "melee", ex: true, rarity: "common", build: ["ber"], mfx: ["fade_hold"], effects: [{ type: "damage", amount: 6 }] },
    w_flurry:   { name: "Шквал ударов",     cost: 2, icon: "slash",  target: "enemy", attack: "melee", rarity: "uncommon", build: ["ber", "str"], mfx: ["cap2"], effects: [{ type: "damage", amount: 3, hits: 4 }] },
    w_second:   { name: "Второе дыхание",   cost: 1, icon: "unity",  target: "none", rarity: "common", build: ["ber", "str"], mfx: ["hp50_str2"], effects: [{ type: "str", amount: 4, dur: "turn" }] },
    w_anger:    { name: "Злость",           cost: 1, icon: "unity",  target: "none", ex: true, rarity: "common", build: ["str"], mfx: ["cost2_str1"], effects: [{ type: "str", amount: 2, dur: "fight" }] },

    // ===== Лучник: Крит (этап 1) + клей. Накопитель и Ловушки — этап 2 =====
    a_shot:     { name: "Выстрел",            cost: 1, icon: "arrow",  target: "enemy", attack: "ranged", rarity: "common", effects: [{ type: "damage", amount: 4 }] },
    a_defend:   { name: "Защита",             cost: 1, icon: "shield", target: "self", rarity: "common", effects: [{ type: "block", amount: 4 }] },
    a_bounce:   { name: "Отскок",             cost: 1, icon: "knock",  target: "enemy", attack: "ranged", rarity: "common", build: ["trap"], mfx: ["draw1"], effects: [{ type: "damage", amount: 3 }, { type: "push" }] },
    a_aimed:    { name: "Прицельный выстрел", cost: 1, icon: "aim",    target: "enemy", attack: "ranged", rarity: "common", build: ["crit"], mfx: ["atk_dmg2"], effects: [{ type: "damage", amount: 6 }, { type: "mark" }] },
    a_quick:    { name: "Быстрый выстрел",    cost: 0, icon: "arrow",  target: "enemy", attack: "ranged", rarity: "common", build: ["acc"], mfx: ["copy_out"], effects: [{ type: "damage", amount: 3 }, { type: "draw", amount: 1 }] },
    a_rico:     { name: "Рикошетная стрела",  cost: 1, icon: "pierce", target: "enemy", attack: "ranged", ricochet: 1, rarity: "common", mfx: ["cost1_rico2", "atk_rico1"], effects: [{ type: "damage", amount: 4 }] },
    a_roll:     { name: "Перекат",            cost: 1, icon: "cover",  target: "self", rarity: "common", mfx: ["retain_both"], effects: [{ type: "block", amount: 7 }] },
    a_double:   { name: "Двойной выстрел",    cost: 1, icon: "arrows", target: "enemy", attack: "ranged", rarity: "common", build: ["crit"], mfx: ["cap2"], effects: [{ type: "damage", amount: 3, hits: 2 }] },
    a_hone:     { name: "Заточка стрел",      cost: 1, icon: "aim",    target: "none", power: true, rarity: "uncommon", build: ["crit"], effects: [{ type: "critShift", amount: 1 }] },
    a_cold:     { name: "Хладнокровие",       cost: 1, icon: "aim",    target: "none", rarity: "common", build: ["crit"], mfx: ["atk_dmg2"], effects: [{ type: "critReady" }] },
    a_pass:     { name: "Передача прицела",   cost: 1, icon: "arrow",  target: "enemy", attack: "ranged", rarity: "uncommon", build: ["crit"], mfx: ["crit_move"], effects: [{ type: "damage", amount: 4 }] },
    a_heart:    { name: "Выстрел в сердце",   cost: 3, icon: "aim",    target: "enemy", attack: "ranged", critMult: 3, rarity: "rare", build: ["crit"], mfx: ["cost1_crit"], effects: [{ type: "damage", amount: 14 }] },
    a_rain:     { name: "Град стрел",         cost: 2, icon: "rain",   target: "cell", attack: "aoe", area: "row", rarity: "uncommon", build: ["crit", "trap"], mfx: ["cap2"], effects: [{ type: "damage", amount: 4 }] },
    a_smoke:    { name: "Дымовая завеса",     cost: 1, icon: "cover",  target: "enemy", ex: true, noMerge: true, rarity: "uncommon", effects: [{ type: "missEnemy" }] },

    // ===== Маг: Массовки (этап 1) + клей. Кровь и Кости — этап 2 =====
    m_bolt:     { name: "Магическая стрела",  cost: 1, icon: "bolt",    target: "enemy", attack: "ranged", rarity: "common", effects: [{ type: "damage", amount: 4 }] },
    m_defend:   { name: "Защита",             cost: 1, icon: "barrier", target: "self", rarity: "common", effects: [{ type: "block", amount: 4 }] },
    m_arc:      { name: "Огненная дуга",      cost: 2, icon: "fire",    target: "cell", attack: "aoe", area: "shape", fixedShape: "fan", rarity: "common", build: ["aoe"], mfx: ["cap2"], effects: [{ type: "damage", amount: 5 }] },
    m_focus:    { name: "Сосредоточение",     cost: 1, icon: "purify",  target: "none", rarity: "common", mfx: ["cheaper"], effects: [{ type: "draw", amount: 2 }] },
    m_spark:    { name: "Разряд",             cost: 1, icon: "bolt",    target: "enemy", attack: "ranged", chain: 1, chainDmg: 3, rarity: "common", mfx: ["atk_chain2"], effects: [{ type: "damage", amount: 5 }] },
    m_barrier:  { name: "Барьер",             cost: 1, icon: "barrier", target: "hero", rarity: "uncommon", mfx: ["cost2_barrier"], effects: [{ type: "barrier", amount: 1 }] },
    m_ward:     { name: "Чародейский щит",    cost: 1, icon: "barrier", target: "self", rarity: "common", mfx: ["draw1"], effects: [{ type: "block", amount: 6 }] },
    m_wedge:    { name: "Огненный клин",      cost: 2, icon: "flames",  target: "cell", attack: "aoe", area: "shape", fixedShape: "deep3", rarity: "common", build: ["aoe"], mfx: ["cap2"], effects: [{ type: "damage", amount: 6 }] },
    m_blast:    { name: "Взрыв",              cost: 2, icon: "nova",    target: "cell", attack: "aoe", area: "adjacent", rarity: "uncommon", build: ["aoe", "trap"], mfx: ["cap2"], effects: [{ type: "damage", amount: 5 }, { type: "pushOut" }] },
    m_elements: { name: "Сила стихий",        cost: 1, icon: "fire",    target: "none", power: true, rarity: "uncommon", build: ["aoe"], effects: [{ type: "aoeBonus", amount: 2 }] },
    m_power:    { name: "Фокус",              cost: 1, icon: "unity",   target: "none", rarity: "common", build: ["aoe"], mfx: ["aoe_str1"], effects: [{ type: "str", amount: 2, dur: "turn" }] },
    m_meteor:   { name: "Метеор",             cost: 3, icon: "fire",    target: "cell", attack: "aoe", area: "shape", fixedShape: "chevDown", ex: true, rarity: "rare", build: ["aoe"], mfx: ["cap2"], effects: [{ type: "damage", amount: 12 }] }
  },

  // ---------- Оружие (wide-range: только счётчик крита и принадлежность карт герою) ----------
  // critEvery — крит раз в N ударов картами этого оружия; счётчик живёт весь бой. 0 — без крита.
  // cards — все карты героя (пул наград и колода). Стартовая колода — meta.start.
  weapons: {
    sword: { name: "Меч",   kind: "weapon", icon: "w_sword", critEvery: 4, cards: { w_strike: 1, w_defend: 1, w_ram: 1, w_cleave: 1, w_swordshield: 1, w_cover: 1, w_warcry: 1, w_wall: 1, w_bash: 1, w_unbreak: 1, w_spikes: 1, w_stance: 1, w_temper: 1, w_comrades: 1, w_heavy: 1, w_feed: 1, w_frenzy: 1, w_dash: 1, w_flurry: 1, w_second: 1, w_anger: 1 } },
    bow:   { name: "Лук",   kind: "weapon", icon: "w_bow",   critEvery: 3, cards: { a_shot: 1, a_defend: 1, a_bounce: 1, a_aimed: 1, a_quick: 1, a_rico: 1, a_roll: 1, a_double: 1, a_hone: 1, a_cold: 1, a_pass: 1, a_heart: 1, a_rain: 1, a_smoke: 1 } },
    staff: { name: "Посох", kind: "weapon", icon: "w_staff", critEvery: 4, cards: { m_bolt: 1, m_defend: 1, m_arc: 1, m_focus: 1, m_spark: 1, m_barrier: 1, m_ward: 1, m_wedge: 1, m_blast: 1, m_elements: 1, m_power: 1, m_meteor: 1 } }
  },

  // ---------- Герои ----------
  // hp — макс. ХП (переносится между боями). startBlock — стартовая броня (wide-range: выключена переключателем tests.startBlock).
  heroes: [
    { id: "melee",  name: "Воин",   icon: "helm", hp: 85, startBlock: 4, weapons: ["sword"], cards: {} },
    { id: "mage",   name: "Маг",    icon: "hat",  hp: 60, startBlock: 2, weapons: ["staff"], cards: {} },
    { id: "ranger", name: "Лучник", icon: "hood", hp: 68, startBlock: 2, weapons: ["bow"],   cards: {} }
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
      // wide-range (24.11): как в Slay the Spire — пустые удары и защита + одна стартовая карта
      melee:  { w_strike: 4, w_defend: 4, w_ram: 1 },
      mage:   { m_bolt: 4, m_defend: 3, m_arc: 1 },
      ranger: { a_shot: 4, a_defend: 4, a_bounce: 1 }
    },
    // Пул новых карт героя = карты его оружия + его доп. карты (heroes.*.cards) + extra ниже.
    extraPool: {},
    // 11.11: базовые карты стартовой колоды как «новая карта» не предлагаются (хлам). Копии (дубли) — можно, но см. dupeFrom.
    noReward: ["w_strike", "w_defend", "a_shot", "a_defend", "m_bolt", "m_defend"],
    dupeFrom: 4,              // дубли (копия карты из колоды) — только в наградах с 4-го боя забега (за первые 3 боя — нет)
    // Редкость карт: common (обычная) | uncommon (средняя) | rare (редкая).
    // Кого нет в списке: эволюционные и за 3 энергии — rare, за 2 — uncommon, остальные — common.
    cardRarity: {},           // wide-range: редкость берётся из cards.*.rarity

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
      partymerge:  { tier: "rare",     on: "party", icon: "🤝", name: "На всю пати",   text: "первый мердж каждого хода бесплатный для всех", eliteOnly: true },
      // wide-range (24.11): эффект мерджа на карту — из пула этой карты (её mfx) и общего пула (mergeFx.*.pool)
      mfx:         { tier: "common",   on: "card",  icon: "🟩", name: "Эффект мерджа", text: "карта получает эффект мерджа (цветная плашка)" }
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
    // wide-range (24.11, боты medium ~70–75%): пустые стартовые колоды и без стартовой брони — враги слабее (было 0.75 / 1.05)
    enemyHp: 0.47,            // множитель ХП и брони всех врагов в забеге
    hpPerFloor: 0.08,         // + к ХП и броне врагов за каждый этаж
    enemyDmg: 0.78,           // множитель урона всех врагов в забеге
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
