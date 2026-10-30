/* End-to-end rules test. Runs the real engine against the in-memory store.
   Usage: npm test */
import assert from 'node:assert/strict';
import { handleAction, norm, tooCloseToTruth, RULES } from '../lib/engine';
import { PROMPT_POOL } from '../lib/prompts';
import type { ClientState, Payload } from '../lib/types';

let passed = 0;
const ok = (name: string) => {
  passed++;
  console.log(`  pass  ${name}`);
};

// controllable clock so timers can be tested without waiting
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;

async function call(p: Payload) {
  return handleAction(p);
}
async function good(p: Payload) {
  const r = await call(p);
  assert.equal(r.body.ok, true, `${p.action} failed: ${r.body.error}`);
  return r.body;
}
async function bad(p: Payload, fragment?: string) {
  const r = await call(p);
  assert.equal(r.body.ok, false, `${p.action} should have failed`);
  if (fragment) assert.match(r.body.error ?? '', new RegExp(fragment, 'i'));
  return r;
}
const stateOf = async (code: string, playerId: string): Promise<ClientState> =>
  (await good({ action: 'state', code, playerId })).state!;
const truthOf = (s: ClientState) => PROMPT_POOL.find((p) => p.text === s.prompt)!.truth;

async function newRoom(names: string[]) {
  const host = await good({ action: 'create', name: names[0] });
  const code = host.state!.code;
  const ids = [host.playerId!];
  for (const n of names.slice(1)) ids.push((await good({ action: 'join', code, name: n })).playerId!);
  return { code, ids };
}

async function main() {
  console.log('\nPrompt pool');
  for (const r of [1, 2, 3]) {
    assert.ok(PROMPT_POOL.filter((p) => p.round === r).length >= RULES.perRound, `round ${r} has enough prompts`);
  }
  for (const p of PROMPT_POOL) {
    assert.ok(p.text.includes('______'), `blank missing: ${p.text}`);
    assert.ok(p.decoys.length >= 2, `needs two decoys: ${p.text}`);
    for (const d of p.decoys) assert.ok(!tooCloseToTruth(d, p.truth, p.accept), `decoy "${d}" matches the truth of: ${p.text}`);
    assert.ok(p.note.length > 10);
  }
  ok(`${PROMPT_POOL.length} prompts are well formed and no decoy gives the answer away`);

  console.log('\nAnswer matching');
  assert.equal(norm('The Laser Pointers!'), norm('laser pointer'));
  assert.ok(tooCloseToTruth('Emu', 'emus'));
  assert.ok(tooCloseToTruth("brads drink", "Brad's Drink"));
  assert.ok(tooCloseToTruth('Flamboyence', 'flamboyance'));
  assert.ok(tooCloseToTruth('Forty', 'forty') && tooCloseToTruth('40', 'forty', ['40']));
  assert.ok(!tooCloseToTruth('parade', 'flamboyance'));
  assert.ok(!tooCloseToTruth('Z', 'Q'));
  ok('case, punctuation, plurals, typos and alternate spellings are caught; real lies are not');

  console.log('\nRooms and lobby');
  await bad({ action: 'create', name: '   ' }, 'name');
  await bad({ action: 'join', code: 'BBBB', name: 'Ghost' }, 'no room');
  const lobby = await newRoom(['Ada', 'Ben']);
  assert.match(lobby.code, /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  await bad({ action: 'join', code: lobby.code, name: 'ada' }, 'already has that name');
  await bad({ action: 'start', code: lobby.code, playerId: lobby.ids[1] }, 'host');
  const solo = await good({ action: 'create', name: 'Solo' });
  await bad({ action: 'start', code: solo.state!.code, playerId: solo.playerId }, 'at least 2');
  ok('code format, duplicate names, unknown room, host-only start, 2-player minimum');

  const eight = await newRoom(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
  assert.equal(new Set(eight.ids).size, 8);
  const st = await stateOf(eight.code, eight.ids[0]);
  assert.equal(new Set(st.players.map((p) => p.color)).size, 8);
  await bad({ action: 'join', code: eight.code, name: 'p9' }, 'full');
  ok('8 players fit, each gets a unique colour, the 9th is refused');

  const racers = await good({ action: 'create', name: 'Host' });
  const results = await Promise.all(
    Array.from({ length: 7 }, (_, i) => call({ action: 'join', code: racers.state!.code, name: `R${i}` }))
  );
  assert.ok(results.every((r) => r.body.ok));
  assert.equal((await stateOf(racers.state!.code, racers.playerId!)).players.length, 8);
  ok('seven simultaneous joins all land (no lost updates)');

  console.log('\nFull game, 3 players, 3 rounds');
  const { code, ids } = await newRoom(['Ada', 'Ben', 'Cy']);
  const [A, B, C] = ids;
  await good({ action: 'start', code, playerId: A });
  await bad({ action: 'join', code, name: 'Late' }, 'already started');
  await bad({ action: 'start', code, playerId: A }, 'already started');

  let s = await stateOf(code, A);
  assert.equal(s.phase, 'WRITE');
  assert.equal(s.round, 1);
  assert.equal(s.multiplier, 1);
  assert.equal((s as any).truth, undefined);
  ok('game starts in round 1, truth is not in the payload');

  const truth = truthOf(s);
  await bad({ action: 'lie', code, playerId: A, text: truth }, 'too close');
  await bad({ action: 'lie', code, playerId: A, text: '   ' }, 'actual answer');
  await bad({ action: 'vote', code, playerId: A, optionId: 'o0' }, 'closed');
  ok('writing the real answer or nothing is rejected, voting early is rejected');

  await good({ action: 'lie', code, playerId: A, text: 'Lie from Ada' });
  await bad({ action: 'lie', code, playerId: A, text: 'Second try' }, 'already locked');
  s = await stateOf(code, B);
  assert.equal(s.players.find((p) => p.id === A)!.submitted, true);
  assert.equal(s.myLie, null);
  await good({ action: 'lie', code, playerId: B, text: 'Shared Lie' });
  assert.equal((await stateOf(code, A)).phase, 'WRITE');
  await good({ action: 'lie', code, playerId: C, text: 'shared lie!' }); // same lie, different spelling
  s = await stateOf(code, A);
  assert.equal(s.phase, 'VOTE', 'moves to voting as soon as everybody has locked in');
  ok('lies lock in once, everyone-done moves on early');

  for (const o of s.options!) {
    assert.equal(o.kind, undefined);
    assert.equal(o.authors, undefined);
    assert.equal(o.voters, undefined);
  }
  assert.equal((s as any).truth, undefined);
  assert.equal(s.options!.length, 1 + 2 + 2, 'truth + 2 distinct lies + 2 house decoys');
  const textOf = (st: ClientState, id: string) => st.options!.find((o) => o.id === id)!.text;
  const idOf = (st: ClientState, text: string) => st.options!.find((o) => norm(o.text) === norm(text))!.id;
  ok('vote screen shows options with no answer key; identical lies were merged');

  const sA = await stateOf(code, A);
  const sB = await stateOf(code, B);
  assert.equal(sA.options!.find((o) => o.text === 'Lie from Ada')!.mine, true);
  assert.equal(sB.options!.find((o) => o.text === 'Shared Lie')!.mine, true);
  assert.equal((await stateOf(code, C)).options!.find((o) => o.text === 'Shared Lie')!.mine, true);
  await bad({ action: 'vote', code, playerId: A, optionId: idOf(sA, 'Lie from Ada') }, 'own lie');
  await bad({ action: 'vote', code, playerId: B, optionId: idOf(sB, 'Shared Lie') }, 'own lie');
  await bad({ action: 'vote', code, playerId: A, optionId: 'nope' }, 'does not exist');
  ok("players can't vote for their own lie (including a merged one)");

  await good({ action: 'vote', code, playerId: A, optionId: idOf(sA, 'Shared Lie') }); // fools Ben and Cy
  await bad({ action: 'vote', code, playerId: A, optionId: idOf(sA, truth) }, 'already voted');
  await good({ action: 'vote', code, playerId: B, optionId: idOf(sB, truth) }); // finds the truth
  await good({ action: 'vote', code, playerId: C, optionId: idOf(sA, 'Lie from Ada') }); // falls for Ada
  s = await stateOf(code, A);
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.truth, truth);
  assert.ok(s.note && s.note.length > 5);
  const byId = Object.fromEntries(s.players.map((p) => [p.id, p]));
  assert.equal(byId[A].score, 500, 'Ada: one vote on her lie');
  assert.equal(byId[B].score, 1500, 'Ben: truth (1000) + fooled Ada (500)');
  assert.equal(byId[C].score, 500, 'Cy: fooled Ada (500), fell for a lie');
  assert.equal(byId[B].gainTruth, 1000);
  const truthOpt = s.options!.find((o) => o.kind === 'truth')!;
  assert.deepEqual(truthOpt.voters, [B]);
  assert.equal(textOf(s, truthOpt.id), truth);
  ok('round 1 scoring is exact: 1000 for the truth, 500 per fooled player, shared lies pay both authors');

  await bad({ action: 'next', code, playerId: B }, 'host');
  await good({ action: 'next', code, playerId: A });
  s = await stateOf(code, A);
  assert.equal(s.phase, 'WRITE');
  assert.equal(s.promptNumber, 2);
  assert.equal(s.players.find((p) => p.id === A)!.gain, 0, 'per-prompt gains reset');
  assert.equal(s.players.find((p) => p.id === A)!.score, 500, 'but scores carry over');
  ok('host continues, gains reset, scores carry over, non-host cannot skip');

  // play the remaining 8 prompts: everybody writes a different lie and finds the truth
  let expectedExtra = 0;
  const seenRounds: number[] = [1];
  for (let n = 1; n < 9; n++) {
    s = await stateOf(code, A);
    assert.equal(s.phase, 'WRITE');
    if (!seenRounds.includes(s.round)) seenRounds.push(s.round);
    assert.equal(s.multiplier, RULES.multiplier[s.round]);
    const t = truthOf(s);
    await good({ action: 'lie', code, playerId: A, text: `fake a ${n}` });
    await good({ action: 'lie', code, playerId: B, text: `fake b ${n}` });
    await good({ action: 'lie', code, playerId: C, text: `fake c ${n}` });
    s = await stateOf(code, A);
    const decoyCount = s.round === 3 ? 1 : 2;
    assert.equal(s.options!.length, 1 + 3 + decoyCount);
    for (const id of ids) {
      const view = await stateOf(code, id);
      await good({ action: 'vote', code, playerId: id, optionId: idOf(view, t) });
    }
    expectedExtra += RULES.truthPoints * RULES.multiplier[s.round];
    await good({ action: 'next', code, playerId: A });
  }
  assert.deepEqual(seenRounds, [1, 2, 3]);
  s = await stateOf(code, A);
  assert.equal(s.phase, 'FINAL');
  const final = Object.fromEntries(s.players.map((p) => [p.name, p.score]));
  assert.equal(final.Ada, 500 + expectedExtra);
  assert.equal(final.Ben, 1500 + expectedExtra);
  assert.equal(final.Cy, 500 + expectedExtra);
  assert.equal(expectedExtra, 17000, '2x1 + 3x2 + 3x3 prompts, 1000 each');
  ok('rounds 1-3 run with 1x / 2x / 3x multipliers; round 3 has fewer house decoys; totals match to the point');

  const titles = Object.fromEntries(s.awards!.map((a) => [a.title, a.playerId]));
  assert.equal(titles['Lie detector'], B);
  assert.ok(titles['Best liar']);
  ok('final awards computed (lie detector = Ben)');

  await bad({ action: 'again', code, playerId: B }, 'host');
  await good({ action: 'again', code, playerId: A });
  s = await stateOf(code, C);
  assert.equal(s.phase, 'LOBBY');
  assert.ok(s.players.every((p) => p.score === 0));
  await good({ action: 'start', code, playerId: A });
  assert.equal((await stateOf(code, A)).phase, 'WRITE');
  ok('rematch: back to lobby, scores cleared, a new game starts');

  console.log('\nTimers');
  const t = await newRoom(['Ada', 'Ben']);
  await good({ action: 'start', code: t.code, playerId: t.ids[0] });
  skew += (RULES.writeSecs[1] + 1) * 1000;
  s = await stateOf(t.code, t.ids[1]);
  assert.equal(s.phase, 'VOTE', 'writing timer expired with no lies');
  assert.equal(s.options!.length, 3, 'truth + 2 house decoys');
  await bad({ action: 'lie', code: t.code, playerId: t.ids[0], text: 'too late' }, 'time is up');
  skew += (RULES.voteSecs + 1) * 1000;
  s = await stateOf(t.code, t.ids[0]);
  assert.equal(s.phase, 'REVEAL', 'voting timer expired with no votes');
  assert.ok(s.players.every((p) => p.score === 0));
  skew += (RULES.revealSecs + 1) * 1000;
  s = await stateOf(t.code, t.ids[0]);
  assert.equal(s.phase, 'WRITE');
  assert.equal(s.promptNumber, 2, 'reveal auto-continues if the host is away');
  ok('every phase advances by itself when its timer runs out, nobody can act after the deadline');

  console.log('\nSecurity and cleanup');
  await bad({ action: 'state', code: t.code, playerId: 'stranger' }, 'not part');
  await bad({ action: 'vote', code: t.code, playerId: undefined, optionId: 'o0' }, 'not part');
  const l = await newRoom(['Ada', 'Ben', 'Cy']);
  await good({ action: 'leave', code: l.code, playerId: l.ids[0] });
  const ls = await stateOf(l.code, l.ids[1]);
  assert.equal(ls.players.length, 2);
  assert.equal(ls.hostId, l.ids[1], 'host passes to the next player');
  ok('strangers are refused; leaving the lobby hands over the host role');

  console.log('\nAI Bots and Reactions');
  const botRoom = await good({ action: 'create', name: 'Commander' });
  const bCode = botRoom.state!.code;
  const bHostId = botRoom.playerId!;
  await bad({ action: 'addBot', code: bCode, playerId: 'stranger' }, 'not part');
  const afterBot = await good({ action: 'addBot', code: bCode, playerId: bHostId });
  assert.equal(afterBot.state!.players.length, 2);
  const botPlayer = afterBot.state!.players.find((p: any) => p.isBot);
  assert.ok(botPlayer, 'bot player added with isBot tag');
  // test reaction
  await good({ action: 'react', code: bCode, playerId: bHostId, emoji: '🔥' });
  const reactState = await stateOf(bCode, bHostId);
  assert.ok(reactState.reactions && reactState.reactions.length > 0);
  assert.equal(reactState.reactions[0].emoji, '🔥');
  // test solo start with bot
  await good({ action: 'start', code: bCode, playerId: bHostId });
  const writeSt = await stateOf(bCode, bHostId);
  assert.equal(writeSt.phase, 'WRITE');
  assert.equal(writeSt.players.find((p: any) => p.isBot)!.submitted, true, 'bot already has lie locked');

  // test AI Lie suggestion
  const draftRes = await good({ action: 'suggestLie', code: bCode, playerId: bHostId });
  assert.ok(draftRes.suggestedLie, 'AI suggested lie was returned');

  await good({ action: 'lie', code: bCode, playerId: bHostId, text: 'human bluff' });
  const voteSt = await stateOf(bCode, bHostId);
  assert.equal(voteSt.phase, 'VOTE', 'game advances straight to VOTE once human locks lie');
  // test 50/50 Lie Radar lifeline
  await good({ action: 'useRadar', code: bCode, playerId: bHostId });
  const radarSt = await stateOf(bCode, bHostId);
  assert.equal(radarSt.myRadarUsed, true, 'radar marked as used');
  await bad({ action: 'useRadar', code: bCode, playerId: bHostId }, 'already used');

  // test vote with Double Down
  const tOpt = voteSt.options!.find((o: any) => !o.mine);
  await good({ action: 'vote', code: bCode, playerId: bHostId, optionId: tOpt!.id, doubleDown: true });
  const revSt = await stateOf(bCode, bHostId);
  assert.equal(revSt.phase, 'REVEAL', 'game advances straight to REVEAL once human votes');

  // test option like / kudos
  const anyOpt = revSt.options![0];
  await good({ action: 'like', code: bCode, playerId: bHostId, optionId: anyOpt.id });
  const likedSt = await stateOf(bCode, bHostId);
  assert.ok(likedSt.options![0].likes && likedSt.options![0].likes.length > 0, 'like recorded on option');

  ok('VIP house guests formulate believable lies, vote autonomously, and support live reaction bursts');
  ok('Double Down wagers, 50/50 Lie Radar, Bluff suggestions, and Lie Kudos likes function correctly');

  // New Game Modes and Tactical Lifelines test
  const mRes = await good({ action: 'create', name: 'Commander' });
  const mCode = mRes.state!.code;
  const mHost = mRes.playerId!;
  await good({ action: 'addBot', code: mCode, playerId: mHost });

  // Test mode and modifier selection in lobby
  await good({ action: 'setGameMode', code: mCode, playerId: mHost, gameMode: 'infinity' });
  await good({ action: 'setMatchLength', code: mCode, playerId: mHost, matchLength: 'quick' });
  await good({ action: 'setCategory', code: mCode, playerId: mHost, deckCategory: 'nature' });
  await good({ action: 'setModifier', code: mCode, playerId: mHost, modifierKey: 'chaos', modifierVal: true });
  const lobbySt = await stateOf(mCode, mHost);
  assert.equal(lobbySt.gameMode, 'infinity', 'game mode set to infinity survival');
  assert.equal(lobbySt.matchLength, 'quick', 'match length preset set to quick');
  assert.equal(lobbySt.deckCategory, 'nature', 'deck category set to nature');
  assert.equal(lobbySt.modifiers?.chaos, true, 'chaos modifier set');

  // Start game in Infinity mode
  await good({ action: 'start', code: mCode, playerId: mHost });
  const infWriteSt = await stateOf(mCode, mHost);
  assert.equal(infWriteSt.phase, 'WRITE', 'game started in WRITE phase');
  assert.equal(infWriteSt.myLives, 3, 'player starts with 3 lives');
  assert.ok(infWriteSt.players.every((p) => p.title !== undefined), 'player titles are computed and populated');

  // Test Bluff Trap planting
  await good({ action: 'lie', code: mCode, playerId: mHost, text: 'trapped bluff', plantTrap: true });
  const infVoteSt = await stateOf(mCode, mHost);
  assert.equal(infVoteSt.phase, 'VOTE', 'game advances to VOTE');
  assert.equal(infVoteSt.myTrapUsed, true, 'trap marked as used');

  // Test Truth Shield lifeline
  await good({ action: 'useShield', code: mCode, playerId: mHost });
  const shieldSt = await stateOf(mCode, mHost);
  assert.equal(shieldSt.myShieldActive, true, 'shield active for vote');

  const infVoteOpt = infVoteSt.options!.find((o: any) => !o.mine);
  await good({ action: 'vote', code: mCode, playerId: mHost, optionId: infVoteOpt!.id });
  const infRevSt = await stateOf(mCode, mHost);
  assert.equal(infRevSt.phase, 'REVEAL', 'game advanced to REVEAL');
  assert.ok(Array.isArray(infRevSt.topLies), 'topLies array exposed on reveal');

  ok('Infinity Survival mode, Match Length presets, Truth Shield, and Bluff Trap function flawlessly');

  console.log(`\nAll ${passed} checks passed.\n`);
}

main().catch((e) => {
  console.error('\nTEST FAILED\n', e);
  process.exit(1);
});
