import { randomBytes, randomInt, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
export const digest = value => createHash('sha256').update(String(value)).digest('hex');
export const secret = () => randomBytes(32).toString('hex');
const invitationAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const invitationToken = () => Array.from({length:12}, () => invitationAlphabet[randomInt(invitationAlphabet.length)]).join('');
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}
export function passwordMatches(password, record) {
  if (!record?.salt || !record?.hash || typeof password !== 'string' || password.length > 1024) return false;
  const actual = scryptSync(password, record.salt, 64), expected = Buffer.from(record.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function participantView(content, person, expires) {
  const { participants, houses, draws = {} } = content;
  const mode = houses.mode || (houses.enabled === false ? 'off' : 'draw');
  const assign = {}, publicDraws = {};
  const people = participants.people.map(p => {
    const house = houses.assign?.[p.code];
    if (mode !== 'off' && house && (mode === 'immediate' || draws[p.code] === house || p.id === person?.id)) assign[p.id] = house;
    if (mode !== 'off' && house && draws[p.code] === house) publicDraws[p.id] = house;
    // code here is a display identifier, never an invitation credential.
    return { id: p.id, code: p.id, name: p.name, name_en:p.name_en||'', bank: p.bank || '', bank_en:p.bank_en||'', photo: p.photo || '' };
  });
  const clean = {
    server: true, role: 'participant', me: person ? { id: person.id, code: person.id, language:person.language||'ru' } : null,
    participants: { people }, tasks: content.tasks, program: content.program, site: content.site,
    houses: { mode, enabled: mode !== 'off', ceremony: houses.ceremony || {}, houses: houses.houses || [], assign },
    draws: publicDraws, offlineUntil: Math.min(expires, Date.now() + 7 * 86400e3)
  };
  return clean;
}

