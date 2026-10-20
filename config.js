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
  version: 13,

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
    //   (поле gift у карты, список даров — gifts ниже) и все дары, полученные раньше (цепочки), а атака → атака ещё
    //   +50% своего текущего урона (одиночке — в цель, массовке — в клетку прицела). Отданная карта уходит в сброс чистой.
    //   Лимита даров нет. Подробно — js/gifts.js.
    // payCost — платишь ли ты энергию своей карты за мердж.
    // costGrowth — растущая стоимость мерджа за ход (сбрасывается каждый ход, работает при payCost: true):
    //   "off"   — мердж стоит как карта;
    //   "hero"  — у каждого героя свой счётчик: n-й мердж героя за ход = стоимость карты + (n − 1);
    //   "party" — общий счётчик пати: n-й мердж за ход стоит n энергии (1, 2, 3…), стоимость карты не важна.
    // Стоимость мерджа видна пульсирующим фиолетовым ромбом на месте стоимости карт союзника, когда берёшь карту (их обычная стоимость в этот момент скрыта).
    merge: { enabled: true, mode: "gift", payCost: true, flatBonus: 3, costGrowth: "off" },

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
    fixedShapes: { enabled: true },

    // Эволюция (merge-3, 20.10, эксперимент). Карта с полем evolve (эволюционная, золотая рамка) — это все карты за 2+ энергии.
    // Две эволюционные карты РАЗНЫХ героев, обе уже мерджнутые (★), светятся фиолетовым. Перетащил одну на другую —
    // та, НА КОТОРУЮ тащили, превращается в свою эволюцию (cards.<evolve>): урон обеих складывается, дары переходят.
    // Эволюция живёт до конца боя. Отданная карта уходит в сброс чистой. Подробно — js/evolve.js.
    evolution: { enabled: true },

    // Подкрепления (merge-3, 20.10, эксперимент): у боя есть резерв врагов (encounters.*.reserve).
    // Каждые every ходов выходят perWave врагов из резерва: сначала на свободные клетки заднего ряда, потом переднего.
    // За ход до выхода клетки помечены. Поле пустое, а резерв нет — следующая волна выходит сразу.
    // Бой выигран, когда пусто и на поле, и в резерве. Подробно — js/reinforce.js.
    reinforcements: { enabled: true, every: 2, perWave: 2 }
  },

  // ---------- Дары (мердж в режиме tests.merge.mode = "gift"), версия merge-2 (19.10) ----------
  // У карты поле gift — что она даст карте союзника, если её отдать. Нет поля — карту отдать нельзя (слабые удары и Искры — 18.10).
  // На карте каждый дар — иконка (icon) + одно число. Повторный дар не добавляет иконку, а растит число на 50%
  // (проценты складываются, не перемножаются; РЕШЕНО 18.10: бусты — только простые числа). Дробное округляем вверх.
  // Атака → атака: кроме дара карта союзника получает ещё +50% урона отданной карты прямо в свой урон
  // (у массовки — во всю родную фигуру). Подробно — js/gifts.js.
  gifts: {
    // color — цвет фона карты с этим даром и плашки дара; icon — значок на плашке
    power:  { name: "Мощь",       icon: "💪", color: "#d83a3a", text: "урон ×1.5 (две Мощи ×2, три ×2.5)" },
    blast:  { name: "Взрыв",      icon: "💣", color: "#e8822a", text: "добавляет карте фигуру своей массовки (фигуры складываются по клетке прицела); новые клетки бьют 50% урона, каждый следующий Взрыв +50%" },
    pierce: { name: "Пробой",     icon: "➹", color: "#e0c040", text: "враг прямо за каждой целью получает ещё 50% урона (каждый Пробой +50%)" },
    repeat: { name: "Повтор",     icon: "🔁", color: "#4cb35a", text: "ещё удар по тем же целям на 50% (каждый Повтор +50%)" },
    push:   { name: "Толчок",     icon: "⇧", color: "#9a6a3e", text: "толкнуть цель (у массовки — врага в клетке прицела, до удара); каждый следующий толчок — +1 клетка" },
    armor:  { name: "Броня",      icon: "🛡", color: "#4a78d8", text: "блок себе = 50% урона карты (у карты блока — блок ×1.5); каждая Броня +50%" },
    cover:  { name: "Прикрытие",  icon: "🤝", color: "#4a78d8", text: "блок отдавшему дар = 50% урона карты (у карты блока — блок ×1.5); каждое +50%" },
    taunt:  { name: "Вызов",      icon: "📣", color: "#d4a94f", text: "цель атакует тебя (только один на карте)" },
    execute:{ name: "Добивание",  icon: "💀", color: "#9a4ad8", text: "×2 урона по врагу, у которого ≤50% ХП (каждое ещё +1: ×3, ×4…)" },
    chain:  { name: "Цепь",       icon: "⚡", color: "#48b8e0", text: "молния прыгает от цели на соседнего врага с наименьшим ХП, которого карта ещё не била. N цепей = N прыжков: первый N×50% урона, каждый следующий на 50% меньше (2 цепи: 100% → 50%)" }
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
    // merge-2 (19.10): у каждой массовки своя фигура, 3 клетки (2 маны) или 4 клетки (3 маны).
    across2: { name: "2 клетки поперёк", steps: [[], [0]] },
    arc3:    { name: "уголок из 3 клеток", steps: [[], [2], [0]] },          // уголок вниз, к героям
    line3r:  { name: "косая линия ／ из 3 клеток", steps: [[], [0], [0, 0]] },
    line3l:  { name: "косая линия ＼ из 3 клеток", steps: [[], [2], [2, 2]] },
    tri3l:   { name: "треугольник из 3 клеток", steps: [[], [2], [1]] },
    diamond4:{ name: "ромб из 4 клеток", steps: [[], [2], [0], [1]] },      // уголок + клетка за прицелом
    wave4:   { name: "волна из 4 клеток поперёк", steps: [[], [2], [0], [0, 5]] },
    // merge-3 (20.10): фигуры смотрят от героя вглубь. Каталог на будущее (копьё, вилы…) — в GDD «На будущее».
    strikeR: { name: "удар справа: 2 клетки вглубь + 1 справа", steps: [[], [1], [0]] },
    strikeL: { name: "удар слева: 2 клетки вглубь + 1 слева", steps: [[], [1], [2]] },
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
    // Слабые удары оружия (17.10, эксперимент): ими добивается колода до minDeck. Двигают счётчик крита своего оружия.
    weak_strike:   { name: "Слабый удар",       cost: 1, icon: "fist",   target: "enemy", attack: "melee",  weak: true, effects: [{ type: "damage", amount: 3 }] },
    weak_shot:     { name: "Слабый выстрел",    cost: 1, icon: "arrow",  target: "enemy", attack: "ranged", weak: true, effects: [{ type: "damage", amount: 2 }], isNew: true, added: "17.10.2026" },
    sparks:        { name: "Искры",             cost: 1, icon: "sparks", target: "enemy", attack: "ranged", weak: true, effects: [{ type: "damage", amount: 1 }, { type: "sparks", count: 2, amount: 1 }], isNew: true, added: "17.10.2026" },

    // Меч
    cleave:        { name: "Рубящий удар",      cost: 1, gift: "execute", icon: "slash",  target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 6 }] },
    sweep:         { name: "Размах",            cost: 2, gift: "blast", icon: "sweep",  target: "cell",  attack: "aoe", area: "shape", shape: "line2", fixedShape: "arc3", evolve: "blade_storm", effects: [{ type: "damage", amount: 8 }] },
    great_sweep:   { name: "Мощный размах",     cost: 3, gift: "blast", icon: "sweep",  target: "cell",  attack: "aoe", area: "shape", shape: "arc5", fixedShape: "wave4", effects: [{ type: "damage", amount: 5 }], isNew: true, added: "17.10.2026" },
    // merge-3 (20.10): Мощный размах убран из колоды меча (массовок меньше), его место занял Рывок
    rush:          { name: "Рывок",             cost: 2, gift: "power", icon: "rush",   target: "enemy", attack: "melee", ignoreCover: true, evolve: "breakthrough", effects: [{ type: "damage", amount: 10 }], isNew: true, added: "20.10.2026" },
    crush:         { name: "Сокрушение",        cost: 2, gift: "power", icon: "crush",  target: "enemy", attack: "melee", evolve: "executioner", effects: [{ type: "damage", amount: 13 }] },

    // Щит
    shield_bash:   { name: "Удар щитом",        cost: 1, gift: "push", icon: "bash",   target: "enemy", attack: "melee", effects: [{ type: "damage", amount: 4 }, { type: "push" }] },
    shield_wall:   { name: "Стена щитов",       cost: 1, gift: "armor", icon: "shield", target: "self",  effects: [{ type: "block", amount: 7 }] },

    // Посох
    bolt:          { name: "Разряд",            cost: 1, gift: "chain", icon: "bolt",   target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 5 }] },
    fireball:      { name: "Огненный шар",      cost: 3, gift: "blast", icon: "fire",   target: "cell",  attack: "aoe", area: "shape", shape: "tri", fixedShape: "diamond4", evolve: "meteor", effects: [{ type: "damage", amount: 6 }] },
    stun_bolt:     { name: "Оглушающий разряд", cost: 2, gift: "power", icon: "stun",   target: "enemy", attack: "ranged", evolve: "thunderer", effects: [{ type: "damage", amount: 3 }, { type: "stun" }] },
    flame_wall:    { name: "Стена огня",        cost: 2, gift: "blast", icon: "flames", target: "cell",  attack: "aoe", area: "shape", shape: "line3", fixedShape: "strikeL", evolve: "fire_rampart", effects: [{ type: "damage", amount: 6 }] },
    // merge-3 (20.10): Огненное кольцо убрано из колоды посоха (массовок меньше), его место заняло Притяжение
    pull:          { name: "Притяжение",        cost: 2, gift: "push", icon: "pull",   target: "enemy", attack: "ranged", evolve: "chain_hook", effects: [{ type: "damage", amount: 7 }, { type: "pull" }], isNew: true, added: "20.10.2026" },
    nova:          { name: "Огненное кольцо",   cost: 2, gift: "blast", icon: "nova",   target: "cell",  attack: "aoe", area: "shape", shape: "tri", fixedShape: "tri3l", effects: [{ type: "damage", amount: 6 }] },

    // Лук
    double_shot:   { name: "Двойной выстрел",   cost: 1, gift: "repeat", icon: "arrows", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3, hits: 2 }] },
    pierce_arrow:  { name: "Пробивающая стрела", cost: 2, gift: "pierce", icon: "pierce", target: "enemy", attack: "ranged", area: "line", evolve: "light_spear", effects: [{ type: "damage", amount: 7 }] },
    knock_arrow:   { name: "Отбрасывающая стрела", cost: 1, gift: "push", icon: "knock", target: "enemy", attack: "ranged", effects: [{ type: "damage", amount: 3 }, { type: "push" }] },
    arrow_rain:    { name: "Град стрел",        cost: 2, gift: "blast", icon: "rain",   target: "cell",  attack: "aoe", area: "shape", shape: "fan", fixedShape: "strikeR", evolve: "arrow_storm", effects: [{ type: "damage", amount: 6 }] },
    aimed_shot:    { name: "Прицельный выстрел", cost: 2, gift: "power", icon: "aim",   target: "enemy", attack: "ranged", evolve: "deadshot", effects: [{ type: "damage", amount: 10 }] },

    // ---------- Эволюции (merge-3, 20.10, эксперимент — tests.evolution) ----------
    // evolved: true — получается только эволюцией, в колоды не кладётся. Стоимость и урон берутся при эволюции:
    // стоимость = стоимость карты, которая эволюционировала; урон = урон обеих карт (без даров) + их прибавки,
    // все дары обеих карт и родной дар отданной переходят. amount ниже — 0, он заменяется.
    // Свойства: mult — множитель урона | returnOnKill — убил цель → карта возвращается в руку
    //   ignoreCover — мили бьёт и закрытого врага | ignoreBlock — урон сквозь блок врага
    //   finisher — враг с ≤50% ХП погибает, иначе урон ×2
    // area: "row" — весь ряд клетки прицела | "all" — все враги | "withCover" — цель и тот, кто её прикрывает
    // effects: pull — притянуть врага из заднего ряда вперёд (впереди кто-то есть — меняются местами)
    //          blockPartyPct {pct} — блок всем героям = pct от урона карты
    blade_storm:   { name: "Вихрь клинков",     evolved: true, icon: "sweep",  target: "cell",  attack: "aoe", area: "row", effects: [{ type: "damage", amount: 0 }] },
    executioner:   { name: "Палач",             evolved: true, icon: "crush",  target: "enemy", attack: "melee", mult: 2, returnOnKill: true, effects: [{ type: "damage", amount: 0 }] },
    breakthrough:  { name: "Прорыв",            evolved: true, icon: "rush",   target: "enemy", attack: "melee", ignoreCover: true, area: "withCover", effects: [{ type: "damage", amount: 0 }] },
    meteor:        { name: "Метеоритный дождь", evolved: true, icon: "fire",   target: "cell",  attack: "aoe", area: "all", effects: [{ type: "damage", amount: 0 }] },
    fire_rampart:  { name: "Огненный вал",      evolved: true, icon: "flames", target: "cell",  attack: "aoe", area: "shape", shape: "strikeL", fixedShape: "strikeL", effects: [{ type: "damage", amount: 0 }, { type: "blockPartyPct", pct: 0.5 }] },
    thunderer:     { name: "Громовержец",       evolved: true, icon: "stun",   target: "enemy", attack: "ranged", area: "row", effects: [{ type: "damage", amount: 0 }, { type: "stun" }] },
    chain_hook:    { name: "Цепной крюк",       evolved: true, icon: "pull",   target: "enemy", attack: "ranged", mult: 2, ignoreBlock: true, effects: [{ type: "damage", amount: 0 }, { type: "pull" }] },
    arrow_storm:   { name: "Ливень стрел",      evolved: true, icon: "rain",   target: "cell",  attack: "aoe", area: "shape", shape: "strikeR", fixedShape: "strikeR", effects: [{ type: "damage", amount: 0, hits: 2 }] },
    light_spear:   { name: "Копьё света",       evolved: true, icon: "pierce", target: "enemy", attack: "ranged", area: "line", ignoreBlock: true, effects: [{ type: "damage", amount: 0 }] },
    deadshot:      { name: "Смертельный выстрел", evolved: true, icon: "aim",  target: "enemy", attack: "ranged", finisher: true, effects: [{ type: "damage", amount: 0 }] },

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
    sword:  { name: "Меч",   kind: "weapon", icon: "w_sword",  critEvery: 3, weakCard: "weak_strike", cards: { cleave: 2, sweep: 1, rush: 1, crush: 1 } },
    shield: { name: "Щит",   kind: "shield", icon: "w_shield", critEvery: 0, cards: { shield_bash: 1, shield_wall: 1 } },
    staff:  { name: "Посох", kind: "weapon", icon: "w_staff",  critEvery: 4, weakCard: "sparks", cards: { bolt: 2, fireball: 1, stun_bolt: 1, flame_wall: 1, pull: 1 } },
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
    // 20.10 (ветка merge-3, бот medium): бои стали длиннее из-за подкреплений (8 врагов за бой) — урон врагов ×0.65
    // (Упырь 8/4 → 5/3, Гончая 5/7 → 3/5, Культист 9 → 6, Лучник 3/6 → 2/4, Громила 9 → 6); Жрец — ниже
    ghoul:   { name: "Упырь",        hp: 55, melee: true,  actions: [{ type: "attack", damage: 5 }, { type: "attack", damage: 3, targets: 2 }] },
    hound:   { name: "Гончая",       hp: 33, melee: true,  actions: [{ type: "attack", damage: 3 }, { type: "attack", damage: 5 }] },
    cultist: { name: "Культист",     hp: 37, melee: false, actions: [{ type: "curse", amount: 2, turns: 2 }, { type: "attack", damage: 6 }] },
    archer:  { name: "Костяной лучник", hp: 31, melee: false, actions: [{ type: "attack", damage: 2, targets: 3 }, { type: "attack", damage: 4 }] },
    brute:   { name: "Громила",      hp: 88, melee: true,  actions: [{ type: "block", amount: 8 }, { type: "attack", damage: 6, targets: 3 }] },
    // баланс 18.10 (ветка merge, бот medium): Жрец ХП 150→110, удары 17→14 и 10×2→8×2 — с мерджем medium выигрывал 30%;
    // 18.10 13:45 после «прибавка в базовый урон» мердж стал сильнее (79%) — ХП 110→120, удары вернули 17 и 10×2
    // 19.10 (ветка merge-2, бот medium): после упрощения даров medium выигрывал 55% — удары 17→15 и 10×2→9×2 (≈70%)
    // 20.10 (ветка merge-3, подкрепления): ХП 120→125, удары 15→12 и 9×2→7×2 — medium ≈70% (2×60 забегов: 73% и 67%), бой ≈8.4 хода
    priest:  { name: "Падший жрец",  hp: 125, melee: false, actions: [{ type: "attack", damage: 12 }, { type: "attack", damage: 7, targets: 2 }, { type: "curse", amount: 3, turns: 2, targets: 3 }] }
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
  // reserve — подкрепления (tests.reinforcements): типы врагов по порядку выхода, по perWave за волну.
  encounters: [
    { name: "Трупоеды",          enemies: [{ type: "ghoul", col: 1, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 2, row: 1 }, { type: "archer", col: 4, row: 1 }],
      reserve: ["hound", "hound", "ghoul", "cultist", "hound", "ghoul", "hound", "hound"] },
    { name: "Стая",              enemies: [{ type: "hound", col: 0, row: 0 }, { type: "hound", col: 2, row: 0 }, { type: "hound", col: 3, row: 0 }, { type: "hound", col: 5, row: 0 }, { type: "archer", col: 2, row: 1 }],
      reserve: ["hound", "hound", "hound", "archer", "hound", "ghoul", "hound", "hound"] },
    { name: "Громила",           enemies: [{ type: "brute", col: 2, row: 0 }, { type: "ghoul", col: 4, row: 0 }, { type: "cultist", col: 0, row: 1 }, { type: "archer", col: 5, row: 1 }],
      reserve: ["ghoul", "hound", "hound", "cultist", "hound", "ghoul", "hound", "hound"] },
    { name: "Минибосс: Жрец",    enemies: [{ type: "priest", col: 2, row: 1 }, { type: "ghoul", col: 2, row: 0 }, { type: "ghoul", col: 3, row: 0 }, { type: "archer", col: 5, row: 1 }],
      reserve: ["hound", "hound", "ghoul", "cultist"] }
  ]
};
