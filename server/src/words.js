// Word list and word-related helpers.

const WORDS = [
  // Animals
  'cat', 'dog', 'elephant', 'fish', 'rabbit', 'zebra', 'eagle', 'giraffe',
  'kangaroo', 'octopus', 'penguin', 'snake', 'tiger', 'wolf', 'shark',
  'dolphin', 'butterfly', 'spider', 'turtle', 'owl', 'bat', 'bee', 'crab',
  'frog', 'hamster', 'jellyfish', 'lion', 'monkey', 'mouse', 'panda',
  'parrot', 'peacock', 'pig', 'scorpion', 'seahorse', 'squirrel', 'swan',
  'whale', 'flamingo', 'hedgehog', 'raccoon', 'sloth', 'toucan', 'walrus',
  // Food & drink
  'apple', 'banana', 'lemon', 'orange', 'watermelon', 'pizza', 'burger',
  'hotdog', 'ice cream', 'donut', 'cake', 'cookie', 'popcorn', 'pancake',
  'sandwich', 'spaghetti', 'taco', 'sushi', 'cheese', 'egg', 'carrot',
  'mushroom', 'pineapple', 'strawberry', 'grapes', 'cherry', 'avocado',
  'broccoli', 'pretzel', 'waffle', 'milkshake', 'lollipop', 'bacon',
  // Objects
  'guitar', 'piano', 'violin', 'drum', 'trumpet', 'microphone', 'headphones',
  'notebook', 'jacket', 'kite', 'umbrella', 'camera', 'diamond', 'bicycle',
  'backpack', 'balloon', 'candle', 'clock', 'compass', 'crown', 'envelope',
  'glasses', 'hammer', 'key', 'ladder', 'lamp', 'magnet', 'mirror',
  'paintbrush', 'scissors', 'shovel', 'suitcase', 'telescope', 'toothbrush',
  'wallet', 'wheelchair', 'anchor', 'axe', 'binoculars', 'boomerang',
  'calculator', 'dice', 'feather', 'flashlight', 'globe', 'harp',
  'hourglass', 'joystick', 'kettle', 'lantern', 'matches', 'needle',
  'padlock', 'quill', 'rake', 'saw', 'stethoscope', 'syringe', 'thermometer',
  'trophy', 'tweezers', 'vase', 'whistle', 'wrench', 'zipper',
  // Places & nature
  'house', 'island', 'mountain', 'beach', 'castle', 'jungle', 'lighthouse',
  'moon', 'rainbow', 'volcano', 'waterfall', 'bridge', 'cave', 'desert',
  'farm', 'forest', 'garden', 'glacier', 'harbor', 'iceberg', 'meadow',
  'oasis', 'pyramid', 'river', 'skyscraper', 'stadium', 'sun', 'swamp',
  'tornado', 'tree', 'windmill', 'igloo', 'barn', 'cliff', 'planet',
  // Vehicles
  'airplane', 'helicopter', 'yacht', 'ambulance', 'bulldozer', 'canoe',
  'firetruck', 'motorcycle', 'rocket', 'sailboat', 'scooter', 'submarine',
  'tank', 'tractor', 'train', 'tram', 'truck', 'hot air balloon',
  // People & fantasy
  'queen', 'king', 'dragon', 'unicorn', 'zombie', 'angel', 'astronaut',
  'clown', 'cowboy', 'fairy', 'ghost', 'knight', 'mermaid', 'ninja',
  'pirate', 'robot', 'scarecrow', 'skeleton', 'vampire', 'wizard', 'witch',
  'werewolf', 'genie', 'giant', 'juggler', 'magician', 'mummy', 'superhero',
  // Actions & concepts
  'dance', 'sleep', 'swim', 'sneeze', 'yawn', 'whisper', 'dream', 'karate',
  'fishing', 'juggling', 'surfing', 'skiing', 'bowling', 'archery', 'chess',
  'hopscotch', 'tug of war', 'hide and seek', 'fireworks', 'birthday',
  'wedding', 'campfire', 'earthquake', 'eclipse', 'gravity', 'shadow',
  'echo', 'thunder', 'lightning', 'snowman', 'sandcastle', 'maze',
  // Misc classics
  'sunflower', 'xylophone', 'night', 'flower', 'yellow', 'cactus', 'cloud',
  'mustache', 'footprint', 'fingerprint', 'question mark', 'stop sign',
  'traffic light', 'treasure chest', 'spider web', 'bird nest', 'beehive',
];

// Fisher-Yates shuffle on a copy; unbiased unlike sort(() => 0.5 - random).
function pickWordOptions(count) {
  const pool = [...WORDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// "hot air balloon" -> "___ ___ _______"
function maskWord(word) {
  return word.replace(/[^ ]/g, '_');
}

// Reveal one random still-hidden letter; spaces are never hidden.
function revealLetter(word, mask) {
  const hidden = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === '_') hidden.push(i);
  }
  if (hidden.length === 0) return mask;
  const pos = hidden[Math.floor(Math.random() * hidden.length)];
  return mask.slice(0, pos) + word[pos] + mask.slice(pos + 1);
}

// Standard Levenshtein distance, used for "close guess" hints.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

module.exports = { WORDS, pickWordOptions, maskWord, revealLetter, levenshtein };
