// School subjects the parser recognises, with the short names people type.
// The first name in each list is the one that gets stored.

const SUBJECTS: Array<[name: string, aliases: string[]]> = [
  ['Further Maths', ['further maths', 'further math', 'fm']],
  ['Maths', ['maths', 'math', 'mathematics', 'algebra', 'geometry']],
  ['Chemistry', ['chemistry', 'chem']],
  ['Physics', ['physics', 'phys']],
  ['Biology', ['biology', 'bio']],
  ['Science', ['science', 'sci']],
  ['English Literature', ['english literature', 'english lit', 'eng lit', 'literature', 'lit']],
  ['English', ['english', 'eng']],
  ['History', ['history', 'hist']],
  ['Geography', ['geography', 'geo', 'geog']],
  ['Computer Science', ['computer science', 'comp sci', 'compsci', 'computing', 'cs', 'ict']],
  ['Economics', ['economics', 'econ']],
  ['Business', ['business', 'business studies']],
  ['Psychology', ['psychology', 'psych']],
  ['Sociology', ['sociology']],
  ['French', ['french']],
  ['Spanish', ['spanish']],
  ['German', ['german']],
  ['Russian', ['russian']],
  ['Armenian', ['armenian']],
  ['Art', ['art']],
  ['Music', ['music']],
  ['Drama', ['drama']],
  ['PE', ['pe', 'p.e.']],
  ['Religious Studies', ['religious studies', 'rs', 're']],
  ['Design & Technology', ['design and technology', 'dt', 'd&t']],
];

interface AliasEntry {
  name: string;
  words: string[];
}

// Longest alias first, so 'further maths' wins over 'maths'.
const ALIASES: AliasEntry[] = SUBJECTS.flatMap(([name, aliases]) =>
  aliases.map((a) => ({ name, words: a.split(' ') })),
).sort((a, b) => b.words.length - a.words.length);

/** Finds a subject in a list of lower case words. */
export function detectSubject(words: string[]): string | undefined {
  for (const { name, words: alias } of ALIASES) {
    for (let i = 0; i + alias.length <= words.length; i++) {
      if (alias.every((w, j) => words[i + j] === w)) return name;
    }
  }
  return undefined;
}

export function subjectNames(): string[] {
  return SUBJECTS.map(([name]) => name);
}
