import type { Species } from '../art/pets';

/**
 * The bodies the pet maker lists, painted or still to come, and the breed
 * names a player might type to find them. Elon's list of new bodies, in his
 * order, is /mnt/project-files/mypet/breeds-for-elon.md; when one is painted
 * it moves into BREEDS (src/art/breeds.ts) and its entry here loses `soon`.
 */

export type BodySize = 'small' | 'medium' | 'large';

export interface BodyEntry {
  /** a BREEDS id, 'chewy', 'shorthair' (today's cat), or a body still to come */
  id: string;
  label: string;
  /** the breeds it covers, shown under its name */
  covers: string;
  size: BodySize;
  /** not painted yet: shown as "Coming soon" */
  soon?: boolean;
  /** lower-case breed names that find this body in the search box */
  names: string[];
}

export const DOG_BODIES: BodyEntry[] = [
  { id: 'chewy', label: 'Chewy', covers: 'The original hero, sloth included', size: 'large', names: ['chewy'] },
  { id: 'lab', label: 'Lab', covers: 'Labs, smooth mixes', size: 'large', names: ['labrador', 'lab', 'black lab', 'yellow lab', 'mutt', 'mix', 'mixed'] },
  { id: 'gsd', label: 'Shepherd', covers: 'GSD, Malinois, shepherd mixes', size: 'large', names: ['german shepherd', 'shepherd', 'malinois', 'gsd', 'alsatian'] },
  { id: 'collie', label: 'Collie', covers: 'Border Collie, Aussie, herders', size: 'medium', names: ['border collie', 'collie', 'aussie', 'australian shepherd', 'sheltie', 'shetland'] },
  { id: 'doxie', label: 'Dachshund', covers: 'Doxies', size: 'small', names: ['dachshund', 'doxie', 'wiener', 'weiner', 'sausage'] },
  { id: 'beagle', label: 'Beagle', covers: 'Beagles, small hounds', size: 'small', names: ['beagle', 'hound', 'basset', 'foxhound', 'harrier'] },
  { id: 'frenchie', label: 'Frenchie', covers: 'French Bulldog, Boston', size: 'small', names: ['french bulldog', 'frenchie', 'boston terrier', 'boston', 'pug'] },
  { id: 'golden', label: 'Golden', covers: 'Goldens, setters, Tollers', size: 'large', soon: true, names: ['golden retriever', 'golden', 'retriever', 'setter', 'flat-coat', 'flatcoat', 'toller'] },
  { id: 'terrier', label: 'Wiry terrier', covers: 'Schnauzer, Westie, Scottie', size: 'small', soon: true, names: ['schnauzer', 'westie', 'west highland', 'scottie', 'scottish terrier', 'cairn', 'wire fox', 'airedale', 'border terrier', 'terrier'] },
  { id: 'bully', label: 'Bully', covers: 'Pit mixes, Staffy, Boxer', size: 'medium', soon: true, names: ['pit bull', 'pitbull', 'pittie', 'staffy', 'staffordshire', 'amstaff', 'american bulldog', 'boxer', 'bully', 'bulldog'] },
  { id: 'doodle', label: 'Doodle', covers: 'Doodles, Poodle, Bichon', size: 'medium', soon: true, names: ['goldendoodle', 'labradoodle', 'doodle', 'poodle', 'bichon', 'aussiedoodle', 'bernedoodle', 'cockapoo', 'maltipoo', 'cavapoo'] },
  { id: 'fluffy', label: 'Small fluffy', covers: 'Shih Tzu, Yorkie, Pom', size: 'small', soon: true, names: ['shih tzu', 'shihtzu', 'maltese', 'yorkie', 'yorkshire', 'havanese', 'pomeranian', 'pom', 'lhasa'] },
  { id: 'smooth', label: 'Small smooth', covers: 'Chihuahua, Jack Russell', size: 'small', soon: true, names: ['chihuahua', 'jack russell', 'min pin', 'miniature pinscher', 'rat terrier', 'italian greyhound'] },
  { id: 'husky', label: 'Husky', covers: 'Husky, Shiba, Samoyed', size: 'medium', soon: true, names: ['husky', 'malamute', 'shiba', 'akita', 'samoyed', 'spitz'] },
  { id: 'corgi', label: 'Corgi', covers: 'Pembroke, Cardigan', size: 'small', soon: true, names: ['corgi', 'pembroke', 'cardigan'] },
  { id: 'spaniel', label: 'Spaniel', covers: 'Cavalier, Cocker, Springer', size: 'medium', soon: true, names: ['cavalier', 'king charles', 'cocker', 'springer', 'spaniel'] },
  { id: 'athletic', label: 'Athletic', covers: 'Rottie, Doberman, Pointer', size: 'large', soon: true, names: ['rottweiler', 'rottie', 'doberman', 'pointer', 'vizsla', 'weimaraner', 'great dane', 'dane'] },
];

export const CAT_BODIES: BodyEntry[] = [
  { id: 'shorthair', label: 'Short-hair', covers: 'Most house cats', size: 'medium', names: ['tabby', 'calico', 'tuxedo', 'domestic', 'short hair', 'shorthair', 'house cat', 'american shorthair', 'tortie', 'tortoiseshell'] },
  { id: 'longhair', label: 'Long-hair', covers: 'Maine Coon, Persian, Ragdoll', size: 'large', soon: true, names: ['maine coon', 'persian', 'ragdoll', 'long hair', 'longhair', 'norwegian forest', 'siberian'] },
  { id: 'chunky', label: 'Chunky', covers: 'British Shorthair, round faces', size: 'medium', soon: true, names: ['british shorthair', 'british', 'chunky', 'exotic', 'scottish fold'] },
  { id: 'slim', label: 'Slim', covers: 'Siamese, Oriental, Aby', size: 'small', soon: true, names: ['siamese', 'oriental', 'abyssinian', 'aby', 'bengal', 'sphynx'] },
];

/** Cat patterns Elon is painting as layers (shown as "coming soon" for now). */
export const CAT_PATTERNS = ['Tabby', 'Calico', 'Tuxedo', 'Bicolor', 'Pointed'];

export function bodiesFor(species: Species): BodyEntry[] {
  return species === 'cat' ? CAT_BODIES : DOG_BODIES;
}

/** The body a typed breed name belongs to, or none. Needs 3 letters. */
export function findBody(species: Species, typed: string): BodyEntry | undefined {
  const q = typed.trim().toLowerCase();
  if (q.length < 3) return undefined;
  const list = bodiesFor(species);
  // a whole name first ("boston terrier" is a Frenchie, not a terrier), then a start, then anywhere
  return (
    list.find((b) => b.names.includes(q)) ??
    list.find((b) => b.names.some((n) => n.startsWith(q) || q.startsWith(n + ' '))) ??
    list.find((b) => b.names.some((n) => n.includes(q)))
  );
}
