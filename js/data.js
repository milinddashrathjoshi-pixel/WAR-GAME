'use strict';

// ============================================================
// Static game data: buildings, troops, balancing tables.
// All per-level arrays are indexed by (level - 1), levels 1..5.
// `cost[i]` / `time[i]` = cost/time to reach level i+1.
// `limit[i]` = how many of this building Town Hall level i+1 allows.
// ============================================================

const GRID = 40;          // village is GRID x GRID tiles
const MAX_LEVEL = 5;
const PLACE_MARGIN = 2;   // keep a free border so troops can be deployed

const BUILDINGS = {
  townhall: {
    name: 'Town Hall', emoji: '🏯', size: 4, kind: 'core', color: '#d9a441',
    hp:   [1500, 1900, 2500, 3200, 4000],
    cost: [0, 1500, 6000, 18000, 45000], res: 'gold',
    time: [0, 20, 60, 180, 420],
    limit: [1, 1, 1, 1, 1],
    store: [1000, 2500, 5000, 10000, 20000],
    desc: 'The heart of your village. Upgrading it unlocks more buildings and higher levels.',
  },
  goldmine: {
    name: 'Gold Mine', emoji: '⛏️', size: 3, kind: 'resource', color: '#b08d45',
    hp:   [300, 340, 380, 430, 490],
    cost: [150, 400, 1200, 3500, 9000], res: 'elixir',
    time: [5, 15, 45, 120, 300],
    limit: [2, 3, 4, 5, 6],
    prod: [1.2, 2, 3.2, 5, 7.5],
    capacity: [600, 1200, 2500, 5000, 9000],
    produces: 'gold',
    desc: 'Digs up gold over time. Tap it to collect.',
  },
  elixirpump: {
    name: 'Elixir Collector', emoji: '🧪', size: 3, kind: 'resource', color: '#9a6fc4',
    hp:   [300, 340, 380, 430, 490],
    cost: [150, 400, 1200, 3500, 9000], res: 'gold',
    time: [5, 15, 45, 120, 300],
    limit: [2, 3, 4, 5, 6],
    prod: [1.2, 2, 3.2, 5, 7.5],
    capacity: [600, 1200, 2500, 5000, 9000],
    produces: 'elixir',
    desc: 'Pumps elixir from the ground. Tap it to collect.',
  },
  goldstorage: {
    name: 'Gold Storage', emoji: '💰', size: 3, kind: 'resource', color: '#e0b84f',
    hp:   [800, 1000, 1300, 1700, 2200],
    cost: [300, 900, 2500, 7000, 16000], res: 'elixir',
    time: [10, 30, 90, 240, 480],
    limit: [1, 1, 2, 2, 3],
    capAdd: [1500, 3000, 6000, 12000, 25000],
    stores: 'gold',
    desc: 'Raises the amount of gold you can hold.',
  },
  elixirstorage: {
    name: 'Elixir Storage', emoji: '⚗️', size: 3, kind: 'resource', color: '#b07fd8',
    hp:   [800, 1000, 1300, 1700, 2200],
    cost: [300, 900, 2500, 7000, 16000], res: 'gold',
    time: [10, 30, 90, 240, 480],
    limit: [1, 1, 2, 2, 3],
    capAdd: [1500, 3000, 6000, 12000, 25000],
    stores: 'elixir',
    desc: 'Raises the amount of elixir you can hold.',
  },
  cannon: {
    name: 'Cannon', emoji: '🧨', size: 3, kind: 'defense', color: '#8a8f98',
    hp:   [420, 470, 540, 620, 720],
    cost: [250, 800, 2200, 6000, 14000], res: 'gold',
    time: [10, 30, 90, 240, 480],
    limit: [1, 2, 3, 4, 5],
    dps: [9, 11, 14, 18, 23], range: 7, atk: 0.8,
    desc: 'Reliable single-target defense with solid damage.',
  },
  archertower: {
    name: 'Archer Tower', emoji: '🗼', size: 3, kind: 'defense', color: '#9c7b52',
    hp:   [380, 430, 490, 560, 640],
    cost: [600, 1500, 4000, 9000, 20000], res: 'gold',
    time: [15, 45, 120, 300, 600],
    limit: [0, 1, 2, 3, 4],
    dps: [11, 13, 16, 20, 25], range: 8.5, atk: 0.6,
    desc: 'Long range, fast firing tower.',
  },
  mortar: {
    name: 'Mortar', emoji: '💥', size: 3, kind: 'defense', color: '#6f7b86',
    hp:   [400, 450, 500, 560, 620],
    cost: [2500, 6000, 14000, 28000, 50000], res: 'gold',
    time: [60, 180, 360, 600, 900],
    limit: [0, 0, 1, 1, 2],
    dmg: [24, 30, 38, 48, 60], atk: 5, range: 11, rangeMin: 3.5, splash: 1.5,
    desc: 'Lobs explosive shells that deal area damage — but cannot hit nearby troops.',
  },
  barracks: {
    name: 'Barracks', emoji: '⚔️', size: 3, kind: 'army', color: '#b3573f',
    hp:   [280, 320, 360, 400, 450],
    cost: [100, 500, 2000, 6000, 15000], res: 'elixir',
    time: [5, 20, 60, 180, 420],
    limit: [1, 1, 1, 1, 1],
    desc: 'Trains troops. Each barracks level unlocks a new unit.',
  },
  armycamp: {
    name: 'Army Camp', emoji: '⛺', size: 4, kind: 'army', color: '#5d9c62',
    hp:   [250, 290, 330, 380, 440],
    cost: [200, 1000, 3000, 8000, 18000], res: 'elixir',
    time: [10, 30, 120, 300, 600],
    limit: [1, 1, 2, 2, 3],
    capacity: [20, 30, 40, 55, 70],
    desc: 'Houses your trained troops. More camps = bigger army.',
  },
  wall: {
    name: 'Wall', emoji: '', size: 1, kind: 'wall', color: '#b9c0c8',
    hp:   [150, 300, 600, 1000, 1600],
    cost: [50, 200, 600, 1500, 4000], res: 'gold',
    time: [0, 0, 0, 0, 0],
    limit: [25, 50, 100, 150, 200],
    desc: 'Slows down enemy troops. Build a ring around what you love.',
  },
};

const SHOP_ORDER = [
  'goldmine', 'elixirpump', 'goldstorage', 'elixirstorage',
  'cannon', 'archertower', 'mortar', 'wall', 'barracks', 'armycamp',
];

const TROOPS = {
  barbarian: {
    name: 'Barbarian', emoji: '🗡️', cost: 30, housing: 1,
    hp: 70, dps: 10, speed: 2.1, range: 0.5, trainTime: 4, unlock: 1,
    desc: 'A fearless melee bruiser. Attacks the nearest building.',
  },
  archer: {
    name: 'Archer', emoji: '🏹', cost: 60, housing: 1,
    hp: 26, dps: 9, speed: 2.4, range: 3.5, trainTime: 6, unlock: 2,
    desc: 'Fragile but shoots over walls from range.',
  },
  goblin: {
    name: 'Goblin', emoji: '👺', cost: 40, housing: 1,
    hp: 34, dps: 13, speed: 3.2, range: 0.5, trainTime: 6, unlock: 3,
    pref: 'resource',
    desc: 'Very fast and greedy — goes for resource buildings first.',
  },
  giant: {
    name: 'Giant', emoji: '🗿', cost: 280, housing: 5,
    hp: 380, dps: 15, speed: 1.3, range: 0.5, trainTime: 25, unlock: 4,
    pref: 'defense',
    desc: 'A slow walking wall of muscle that targets defenses first.',
  },
  wallbreaker: {
    name: 'Wall Breaker', emoji: '💣', cost: 180, housing: 2,
    hp: 28, dps: 0, speed: 2.9, range: 0.5, trainTime: 18, unlock: 5,
    pref: 'wall', blast: 550, splash: 1.6,
    desc: 'Charges the nearest wall and blows it (and itself) to bits.',
  },
};

const TROOP_ORDER = ['barbarian', 'archer', 'goblin', 'giant', 'wallbreaker'];

const ENEMY_NAMES = [
  'Goblin Gulch', 'Fort Snoreington', 'Dragonless Den', 'Soggy Bottom',
  'Castle Wobble', 'Peasantville', 'Bandit Hollow', 'Mudpuddle Keep',
  'Rusty Rampart', 'Chicken Coop City', 'Lord Fluffington\'s Realm',
  'The Crooked Keep', 'Turnip Town', 'Grumble Garrison', 'Snail Hill',
];
