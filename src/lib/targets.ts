// Curated routes. Every round goes from a START (a well-known, everyday
// article: a food, an animal, a landmark, a film...) to a TARGET (a broad,
// heavily linked topic that's reachable from almost anywhere). Both lists
// avoid niche pages so a round is a fair race, and they're big enough
// (~350 x ~170 pairs) that repeats aren't noticeable, especially with the
// recent-history exclusion in pickRoute.

export const TARGET_POOL: string[] = [
  // Core hubs
  "United States", "India", "World War II", "London", "Association football", "Music", "Science",
  "Mathematics", "English language", "Christianity", "France", "Germany", "China", "Japan",
  "United Kingdom", "Russia", "Canada", "Australia", "Italy", "Spain", "New York City", "Paris",
  "Islam", "Physics", "Chemistry", "Biology", "Philosophy", "History", "Film", "Television",
  "Latin", "Europe", "Asia", "Africa", "World War I", "Roman Empire", "Ancient Greece",
  "Democracy", "Economics", "Technology", "Internet", "Computer", "Olympic Games", "Basketball",
  "Book", "Language", "Religion", "Earth", "Sun", "Human",
  // Countries, cities and places
  "Brazil", "Mexico", "Egypt", "Greece", "Turkey", "South Africa", "Argentina", "Netherlands",
  "Sweden", "Poland", "Ireland", "Israel", "Iran", "Pakistan", "Indonesia", "South Korea",
  "Nigeria", "Portugal", "Scotland", "California", "Texas", "Tokyo", "Berlin", "Rome",
  "Los Angeles", "Pacific Ocean", "Atlantic Ocean", "Moon", "Solar System", "Mediterranean Sea",
  "North America", "South America", "Antarctica",
  // Big topics, people and institutions
  "Art", "Painting", "Poetry", "Novel", "Architecture", "Theatre", "Opera", "Rock music", "Jazz",
  "Video game", "Photography", "Newspaper", "Medicine", "Disease", "Water", "Oxygen",
  "Electricity", "Energy", "Mammal", "Bird", "Fish", "Plant", "Dog", "Horse", "Agriculture",
  "Food", "Wine", "Money", "Trade", "Capitalism", "Law", "Government", "Monarchy", "War",
  "Evolution", "Astronomy", "Geography", "Psychology", "Engineering", "Rail transport", "Car",
  "Aircraft", "Ship", "Cold War", "Middle Ages", "Renaissance", "Industrial Revolution",
  "French Revolution", "Napoleon", "Julius Caesar", "Jesus", "William Shakespeare",
  "Albert Einstein", "Isaac Newton", "Charles Darwin", "Abraham Lincoln", "The Beatles",
  "United Nations", "European Union", "NASA", "Catholic Church", "Buddhism", "Hinduism", "Judaism",
  "Greek mythology", "Chess", "Cricket", "Tennis", "Baseball", "FIFA World Cup", "Gold", "Iron",
  "DNA", "Bacteria", "Climate", "Mountain", "River", "Island", "Desert", "Forest", "City",
  "University", "Light", "Time", "Color",
];

export const START_POOL: string[] = [
  // Food and drink
  "Pizza", "Sushi", "Chocolate", "Croissant", "Hamburger", "Taco", "Ramen", "Kimchi", "Bagel",
  "Pancake", "Popcorn", "Cheddar cheese", "Avocado", "Banana", "Pineapple", "Mango", "Strawberry",
  "Garlic", "Chili pepper", "Maple syrup", "Peanut butter", "Ice cream", "Honey", "Tea",
  "Espresso", "Coca-Cola", "Doughnut", "Hot dog", "Paella", "Curry", "Dumpling", "Tofu",
  "Olive oil", "Watermelon", "Potato chips", "French fries", "Coffee",
  // Animals
  "Giant panda", "Octopus", "Penguin", "Kangaroo", "Koala", "Platypus", "Western honey bee",
  "Blue whale", "Bald eagle", "Red fox", "Hedgehog", "Flamingo", "Chameleon", "Great white shark",
  "Tiger", "Cheetah", "Giraffe", "Axolotl", "Sloth", "Crocodile", "Owl", "Peafowl", "Dolphin",
  "Wolf", "Polar bear", "Monarch butterfly", "Jellyfish", "Seahorse", "Camel", "Raccoon",
  "Tarantula", "Komodo dragon", "Hummingbird", "Parrot", "Squirrel",
  // Objects and inventions
  "Bicycle", "Umbrella", "Toothbrush", "Pencil", "Paper clip", "Zipper", "Lego", "Rubik's Cube",
  "Frisbee", "Skateboard", "Microwave oven", "Refrigerator", "Light-emitting diode", "Telescope",
  "Compass", "Printing press", "Typewriter", "Phonograph record", "Compact disc", "Walkman",
  "Game Boy", "IPod", "Instant camera", "Barcode", "Velcro", "Sunglasses", "Watch", "Escalator",
  "Elevator", "Traffic light", "Parachute", "Hot air balloon", "Submarine", "Helicopter",
  "Roller coaster", "Ferris wheel", "Piano", "Violin", "Electric guitar", "Drum kit", "Saxophone",
  "Harmonica", "Accordion", "Ukulele",
  // Places and landmarks
  "Eiffel Tower", "Great Wall of China", "Machu Picchu", "Stonehenge", "Taj Mahal",
  "Mount Everest", "Grand Canyon", "Niagara Falls", "Venice", "Sahara", "Amazon rainforest",
  "Great Barrier Reef", "Iceland", "Hawaii", "Las Vegas", "Dubai", "Bali", "Santorini",
  "Yellowstone National Park", "Mount Kilimanjaro", "Sydney Opera House", "Colosseum", "Petra",
  "Angkor Wat", "Statue of Liberty", "Big Ben", "Golden Gate Bridge", "Loch Ness", "Easter Island",
  "Galápagos Islands", "Mount Fuji", "Alcatraz Island", "Times Square", "Central Park",
  "Hollywood Walk of Fame",
  // People and characters
  "Leonardo da Vinci", "Cleopatra", "Genghis Khan", "Marie Curie", "Nikola Tesla", "Frida Kahlo",
  "Vincent van Gogh", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Elvis Presley",
  "Michael Jackson", "Freddie Mercury", "Bob Marley", "Taylor Swift", "Beyoncé", "Lionel Messi",
  "Cristiano Ronaldo", "Serena Williams", "Usain Bolt", "Muhammad Ali", "Michael Jordan", "Pelé",
  "Walt Disney", "Steve Jobs", "Bill Gates", "Neil Armstrong", "Amelia Earhart", "Harry Houdini",
  "Charlie Chaplin", "Marilyn Monroe", "Bruce Lee", "Jackie Chan", "Stephen Hawking",
  "Sherlock Holmes", "Frankenstein", "Count Dracula", "Robin Hood", "King Arthur",
  "Mahatma Gandhi", "Nelson Mandela", "Queen Victoria", "Tutankhamun", "Joan of Arc", "Marco Polo",
  "Christopher Columbus", "Galileo Galilei", "Agatha Christie", "J. K. Rowling", "Jane Austen",
  "Mark Twain", "Pablo Picasso",
  // Films, shows, games and sport
  "Star Wars", "Harry Potter", "The Lord of the Rings", "Pokémon", "Mario", "Minecraft", "Tetris",
  "Pac-Man", "The Simpsons", "SpongeBob SquarePants", "Mickey Mouse", "Batman", "Superman",
  "Spider-Man", "James Bond", "Godzilla", "Jurassic Park", "The Wizard of Oz", "Friends",
  "Game of Thrones", "Breaking Bad", "Doctor Who", "Barbie", "Teddy bear", "Monopoly (game)",
  "Scrabble", "Hello Kitty", "Winnie-the-Pooh", "Peter Pan (character)", "Cinderella",
  "Snow White", "The Lion King", "Toy Story", "Frozen (2013 film)", "Shrek",
  "Eurovision Song Contest", "Super Bowl", "Tour de France", "Wimbledon Championships",
  "Formula One", "Sumo", "Karate", "Surfing", "Skiing", "Marathon", "Yoga", "Poker", "Sudoku",
  "Crossword",
  // Science and nature
  "Black hole", "Rainbow", "Aurora", "Tornado", "Tropical cyclone", "Earthquake", "Tsunami",
  "Lightning", "Snow", "Diamond", "Dinosaur", "Tyrannosaurus", "Woolly mammoth", "Fossil",
  "Coral reef", "Photosynthesis", "Vaccine", "Penicillin", "Insulin", "X-ray", "Laser",
  "Solar eclipse", "Halley's Comet", "Mars", "Saturn", "International Space Station", "Apollo 11",
  "Hubble Space Telescope", "Big Bang", "Periodic table", "Gravity", "Magnet",
  // History
  "Titanic", "Fall of the Berlin Wall", "Great Fire of London", "Black Death", "Boston Tea Party",
  "Normandy landings", "Pompeii", "Salem witch trials", "Woodstock", "California gold rush",
  "Silk Road", "Trojan War", "Vikings", "Samurai", "Piracy", "Knights Templar", "Aztecs",
  "Maya civilization", "Spanish flu", "Wright brothers",
  // Tech and brands
  "Google", "YouTube", "Wikipedia", "Bitcoin", "Emoji", "Email", "Wi-Fi", "Bluetooth", "QR code",
  "Artificial intelligence", "Robot", "Unmanned aerial vehicle", "3D printing", "Nintendo",
  "PlayStation", "Apple Inc.", "Tesla, Inc.", "McDonald's", "IKEA", "Netflix", "Spotify",
  "Instagram", "TikTok", "Amazon (company)", "Rolex", "Ferrari", "Volkswagen Beetle",
  "Harley-Davidson",
  // Everyday life
  "Sneakers", "Jeans", "T-shirt", "Tattoo", "Birthday", "Halloween", "Christmas tree",
  "Valentine's Day", "Fireworks", "Circus", "Zoo", "Library", "Lighthouse", "Castle",
  "Egyptian pyramids", "Windmill", "Tree house", "Igloo",
];

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (t: string) => t.replace(/_/g, " ").trim().toLowerCase();

/**
 * A target plus start candidates in random order, skipping anything in
 * `recent` (recently played starts and targets). The caller walks the
 * candidates until one makes a good race. If history has used up a list,
 * it falls back to the whole list rather than failing.
 */
export function pickRoute(recent: Iterable<string> = []): { target: string; starts: string[] } {
  const seen = new Set([...recent].map(norm));
  const fresh = (pool: string[]) => {
    const left = pool.filter((t) => !seen.has(norm(t)));
    return left.length ? left : pool;
  };
  const target = shuffled(fresh(TARGET_POOL))[0];
  const starts = shuffled(fresh(START_POOL)).filter((s) => norm(s) !== norm(target));
  return { target, starts };
}
