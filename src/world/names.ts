import type { RNG } from '../core/rng';

export const STREET_NAMES = [
  'Harbor', 'Maple', 'Pine', 'Cedar', 'Willow', 'Juniper', 'Linden', 'Aspen', 'Birch', 'Magnolia',
  'Sycamore', 'Hawthorne', 'Chestnut', 'Laurel', 'Elm', 'Oak', 'Spruce', 'Alder', 'Cypress', 'Poplar',
  'Granite', 'Copper', 'Silver', 'Lantern', 'Beacon', 'Meridian', 'Union', 'Liberty', 'Franklin', 'Garfield',
  'Kensington', 'Ashford', 'Prospect', 'Riverside', 'Seaview', 'Highland', 'Fulton', 'Mercer', 'Delancey', 'Hudson',
  'Orchard', 'Vine', 'Park', 'Market', 'Grand', 'Echo', 'Sterling', 'Monroe', 'Quincy', 'Bayard',
];

export const FIRST_NAMES_F = [
  'Maria', 'Aisha', 'Emily', 'Sofia', 'Chen', 'Priya', 'Hannah', 'Olivia', 'Lucia', 'Amara', 'Yuki', 'Fatima',
  'Grace', 'Isabella', 'Mei', 'Nora', 'Zara', 'Leah', 'Camila', 'Ava', 'Ingrid', 'Rosa', 'Elena', 'Jade',
  'Naomi', 'Clara', 'Ruth', 'Sana', 'Ivy', 'Maya', 'Lena', 'Abigail', 'Chloe', 'Daniela', 'Esther', 'Farah',
  'Gabriela', 'Hana', 'Imani', 'Julia', 'Keiko', 'Layla', 'Mila', 'Nadia', 'Paula', 'Quinn', 'Rina', 'Selma',
  'Tara', 'Uma', 'Vera', 'Wendy', 'Ximena', 'Yara', 'Zoe', 'Bianca', 'Celeste', 'Diana', 'Erin', 'Freya',
];
export const FIRST_NAMES_M = [
  'James', 'Omar', 'Lucas', 'Daniel', 'Wei', 'Arjun', 'Mateo', 'Noah', 'Kenji', 'Kwame', 'Ivan', 'Liam',
  'Samuel', 'Diego', 'Hiroshi', 'Ethan', 'Malik', 'Theo', 'Rafael', 'Victor', 'Andre', 'Felix', 'Hugo', 'Jonah',
  'Karim', 'Leo', 'Marcus', 'Nikolai', 'Oscar', 'Pablo', 'Ravi', 'Sean', 'Tomas', 'Umar', 'Viktor', 'William',
  'Xavier', 'Yusuf', 'Zane', 'Adrian', 'Bruno', 'Caleb', 'Dmitri', 'Elias', 'Gabriel', 'Henry', 'Isaac', 'Jamal',
  'Kai', 'Lorenzo', 'Mason', 'Nathan', 'Owen', 'Peter', 'Ricardo', 'Simon', 'Tariq', 'Vincent', 'Wyatt', 'Yosef',
];
export const LAST_NAMES = [
  'Chen', 'Garcia', 'Okafor', 'Smith', 'Patel', 'Nguyen', 'Kowalski', 'Rossi', 'Johansson', 'Kim', 'Haddad',
  'Silva', 'Muller', 'Tanaka', 'Brown', 'Ivanova', 'Mensah', 'Dubois', 'Lopez', 'Wilson', 'Khan', 'Novak',
  'Andersen', 'Moreau', 'Costa', 'Yamamoto', 'Schmidt', 'Reyes', 'Fischer', 'Hughes', 'Sato', 'Adeyemi',
  'Becker', 'Clarke', 'Diaz', 'Evans', 'Ferreira', 'Gomez', 'Hoffmann', 'Ibrahim', 'Jensen', 'Kaur', 'Larsen',
  'Martins', 'Nakamura', 'Olsen', 'Park', 'Quinn', 'Romero', 'Santos', 'Torres', 'Ueda', 'Vargas', 'Walker',
  'Xu', 'Young', 'Zhang', 'Abbott', 'Bauer', 'Cohen', 'Dawson', 'Ellis', 'Ford', 'Grant', 'Hale', 'Ito',
  'Jovanovic', 'Klein', 'Lindqvist', 'Mendes', 'Nash', 'Ortiz', 'Price', 'Rahman', 'Stone', 'Turner', 'Vance',
];

const CAFE_A = ['Bean', 'Brew', 'Daily', 'Copper', 'Velvet', 'Morning', 'Little', 'Harbor', 'Echo', 'Paper', 'Ember', 'Moss'];
const CAFE_B = ['Grind', 'Roasters', 'Cup', 'Coffee House', 'Espresso Bar', 'Kettle', 'Café', 'Press', 'Beanery', 'Mug'];
const REST_A = ['Golden', 'Blue', 'Little', 'Old', 'Lucky', 'Red', 'Silver', 'Olive', 'Saffron', 'Basil', 'Lotus', 'Juniper'];
const REST_B = ['Spoon', 'Table', 'Kitchen', 'Bistro', 'Garden', 'Dragon', 'Trattoria', 'Grill', 'Noodle House', 'Taqueria', 'Brasserie', 'Diner'];
const SHOP_A = ['Corner', 'City', 'Quick', 'Fresh', 'Neighbor', 'Sunrise', 'Metro', 'Handy', 'Night Owl', 'Good Day'];
const SHOP_B = ['Mart', 'Market', 'Grocer', 'Stop', 'Express', 'Foods', 'Provisions', '24/7'];
const CLOTH_A = ['Thread', 'Loom', 'Atelier', 'Stitch', 'Denim', 'Mode', 'Tailor', 'Fabric', 'Urban', 'Velour'];
const CLOTH_B = ['& Co.', 'Supply', 'Studio', 'Outfitters', 'House', 'Boutique', 'Collective'];
const OFFICE_A = ['Apex', 'Nimbus', 'Vertex', 'Pinnacle', 'Quantum', 'Meridian', 'Northwind', 'Helix', 'Lumen', 'Summit', 'Cobalt', 'Ironwood', 'Bluefin', 'Polaris', 'Atlas', 'Keystone'];
const OFFICE_B = ['Partners', 'Systems', 'Capital', 'Labs', 'Group', 'Analytics', 'Consulting', 'Media', 'Legal', 'Holdings', 'Software', 'Design'];
const BAR_A = ['The Rusty', 'The Drunken', 'The Velvet', 'The Copper', 'The Blind', 'The Lucky', 'The Crooked', 'The Midnight'];
const BAR_B = ['Anchor', 'Owl', 'Fox', 'Lantern', 'Tiger', 'Barrel', 'Crow', 'Moon'];
const CLUB = ['NEON', 'PULSE', 'VOLT', 'ECLIPSE', 'HALO', 'PRISM', 'AFTERGLOW', 'SUBSONIC', 'ORBIT', 'VELVET ROOM'];
const IND_A = ['Harbor', 'Continental', 'Echo', 'Granite', 'Ironside', 'Bayline', 'Delta', 'Northgate', 'Union', 'Atlas'];
const IND_B = ['Logistics', 'Freight', 'Manufacturing', 'Steelworks', 'Plastics', 'Distribution', 'Foods Processing', 'Textiles', 'Fabrication', 'Supply Co.'];
const HOTEL = ['The Meridian', 'Grand Echo Hotel', 'The Lighthouse Inn', 'Harbor View Suites', 'The Aurelia', 'Skyline Plaza Hotel', 'The Ivory Palm'];
const GYM = ['Iron Temple', 'Pulse Fitness', 'Core Gym', 'Peak Athletics', 'FlexZone'];
const CINEMA = ['Echo Cineplex', 'The Majestic', 'Starlight Cinema', 'The Rialto'];
const SALON = ['Shear Genius', 'Cut & Color', 'Studio Glow', 'Blade & Brush'];
const BOOK = ['Dog-Eared Books', 'Chapter & Verse', 'The Reading Room', 'Ink & Paper'];
const ELEC = ['VoltTech', 'Circuit City Outlet', 'PixelPoint', 'GigaHub'];
const PHARM = ['CarePlus Pharmacy', 'Echo Drugs', 'WellPoint Pharmacy'];

export function personName(rng: RNG, female: boolean) {
  const first = rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
  const last = rng.pick(LAST_NAMES);
  return { first, last };
}

const used = new Set<string>();
function uniq(rng: RNG, gen: () => string): string {
  for (let i = 0; i < 12; i++) {
    const n = gen();
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  const n = gen() + ' ' + rng.int(2, 9);
  used.add(n);
  return n;
}
export function resetNameRegistry() {
  used.clear();
}

export function businessName(rng: RNG, type: string): string {
  switch (type) {
    case 'cafe':
      return uniq(rng, () => `${rng.pick(CAFE_A)} ${rng.pick(CAFE_B)}`);
    case 'restaurant':
      return uniq(rng, () => `${rng.pick(REST_A)} ${rng.pick(REST_B)}`);
    case 'fastfood':
      return uniq(rng, () => rng.pick(['Burger Barn', 'Pizza Planet Slice', 'Wok Express', 'Taco Rocket', 'Chicken Shack', 'Dumpling Bar', 'Hot Dog Hut', 'Falafel King']));
    case 'grocery':
    case 'convenience':
      return uniq(rng, () => `${rng.pick(SHOP_A)} ${rng.pick(SHOP_B)}`);
    case 'clothing':
      return uniq(rng, () => `${rng.pick(CLOTH_A)} ${rng.pick(CLOTH_B)}`);
    case 'office':
      return uniq(rng, () => `${rng.pick(OFFICE_A)} ${rng.pick(OFFICE_B)}`);
    case 'bar':
      return uniq(rng, () => `${rng.pick(BAR_A)} ${rng.pick(BAR_B)}`);
    case 'nightclub':
      return uniq(rng, () => rng.pick(CLUB));
    case 'warehouse':
    case 'factory':
      return uniq(rng, () => `${rng.pick(IND_A)} ${rng.pick(IND_B)}`);
    case 'hotel':
      return uniq(rng, () => rng.pick(HOTEL));
    case 'gym':
      return uniq(rng, () => rng.pick(GYM));
    case 'cinema':
      return uniq(rng, () => rng.pick(CINEMA));
    case 'salon':
      return uniq(rng, () => rng.pick(SALON));
    case 'bookstore':
      return uniq(rng, () => rng.pick(BOOK));
    case 'electronics':
      return uniq(rng, () => rng.pick(ELEC));
    case 'pharmacy':
      return uniq(rng, () => rng.pick(PHARM));
    default:
      return uniq(rng, () => `${rng.pick(OFFICE_A)} ${type}`);
  }
}
