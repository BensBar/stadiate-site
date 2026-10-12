const selections = [
  ['nfl', 'football/nfl', '401872971'],
  ['nfl', 'football/nfl', '401872968'],
  ['nfl', 'football/nfl', '401872967'],
  ['nfl', 'football/nfl', '401872976'],
  ['ncaaf', 'football/college-football', '401856705'],
  ['ncaaf', 'football/college-football', '401856707'],
  ['mlb', 'baseball/mlb', '401908014'],
];

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Capture source failed: ${response.status} ${url}`);
  return response.json();
}

export function scoreboardFromSummary(summary, league) {
  const competition = summary.header?.competitions?.[0];
  if (!competition || competition.status?.type?.state !== 'post') {
    throw new Error('Historical captures require a verified final game');
  }
  const teams = competition.competitors.map(({ team, score, homeAway, record }) => {
    if (!team.id || !team.abbreviation || !/^\d+$/.test(String(score))) {
      throw new Error('Historical capture source has missing team or score data');
    }
    return {
      id: String(team.id), abbrev: team.abbreviation, name: team.displayName,
      location: team.location, nickname: team.name, shortName: team.name,
      score: String(score), homeAway, color: team.color, alternateColor: team.alternateColor,
      logo: team.logos?.[0]?.href,
      record: record?.find((item) => item.type === 'total')?.summary,
    };
  });
  if (teams.length !== 2 || !teams.some((t) => t.homeAway === 'home') || !teams.some((t) => t.homeAway === 'away')) {
    throw new Error('Historical capture must have one home and one away team');
  }
  return {
    game: `${league}:${summary.header.id}`, sport: league, league, teams,
    date: competition.date, state: 'post', status: competition.status.type.description,
    clock: competition.status.displayClock ?? '',
    meta: { period: competition.status.period ?? null },
    action: { kind: league === 'mlb' ? 'diamond' : 'field', lastPlay: null },
    info: {},
  };
}

export function playersFromSummary(summary) {
  return (summary.boxscore?.players ?? []).flatMap((team) => {
    const passing = team.statistics?.find((group) => group.name === 'passing');
    const entry = passing?.athletes?.[0];
    if (!entry) return [];
    const stats = ['completions/passingAttempts', 'passingYards', 'passingTouchdowns'].map((key) => {
      const index = passing.keys.indexOf(key);
      if (index < 0 || entry.stats[index] == null || !passing.labels[index]) {
        throw new Error(`Missing historical player stat: ${key}`);
      }
      return { label: passing.labels[index], value: entry.stats[index] };
    });
    return [{
      athlete: {
        id: entry.athlete.id, teamId: String(team.team.id),
        name: entry.athlete.displayName, jersey: entry.athlete.jersey,
        position: entry.athlete.position?.abbreviation,
        headshot: entry.athlete.headshot?.href,
      },
      stats,
    }];
  });
}

export async function loadCaptureGames(base) {
  const sources = await Promise.all(selections.map(async ([league, path, id]) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${id}`;
    const summary = await getJson(url);
    if (String(summary.header?.id) !== id) throw new Error(`Unexpected event returned by ${url}`);
    const game = scoreboardFromSummary(summary, league);
    if (league !== 'mlb') {
      const gamecast = await getJson(`${base}/api/gamecast/${encodeURIComponent(game.game)}?mode=primary`);
      if (gamecast.game !== game.game || !gamecast.plays?.length) {
        throw new Error(`No historical play-by-play for ${game.game}`);
      }
      const lastPlay = gamecast.plays[0];
      for (const team of game.teams) {
        const finalScore = team.homeAway === 'home' ? lastPlay.homeScore : lastPlay.awayScore;
        if (Number(team.score) !== finalScore) throw new Error(`Final score and play feed disagree for ${game.game}`);
      }
      game.plays = gamecast.plays;
      game.action.lastPlay = lastPlay;
      game.spotlightPlayers = playersFromSummary(summary);
    }
    return { game, url };
  }));
  return { games: sources.map(({ game }) => game), sources };
}

// Rebuild the game exactly as it stood at one verified scoring play, so a capture
// can show a moment mid-game instead of the final. Every value still comes from
// the public ESPN summary for a completed game; nothing is interpolated.
export function gameAtScoringPlay(summary, league, playId) {
  const game = scoreboardFromSummary(summary, league);
  const scoring = (summary.scoringPlays ?? []).find((play) => String(play.id) === playId);
  if (!scoring) throw new Error(`No verified scoring play ${playId}`);

  const ordered = (summary.drives?.previous ?? []).flatMap((drive) => drive.plays ?? []);
  const index = ordered.findIndex((play) => String(play.id) === playId);
  if (index < 0) throw new Error(`Scoring play ${playId} is missing from the drive chart`);
  const through = ordered.slice(0, index + 1);

  const play = ordered[index];
  if (play.awayScore !== scoring.awayScore || play.homeScore !== scoring.homeScore) {
    throw new Error(`Drive chart and scoring summary disagree at ${playId}`);
  }
  if (play.clock?.displayValue !== scoring.clock?.displayValue
    || play.period?.number !== scoring.period?.number) {
    throw new Error(`Clock mismatch for ${playId}`);
  }

  for (const team of game.teams) {
    team.score = String(team.homeAway === 'home' ? play.homeScore : play.awayScore);
  }
  game.state = 'in';
  game.status = `${ordinal(play.period.number)} Quarter`;
  game.clock = play.clock.displayValue;
  game.meta = { period: play.period.number };
  game.plays = through.map(toFeedPlay).reverse();
  game.action = { kind: 'field', lastPlay: game.plays[0] };
  // ESPN only publishes end-of-game box scores, so there is no honest player line
  // for this moment. Showing the final totals beside a first-quarter clock would
  // misrepresent the play, so the spotlight is left empty.
  game.spotlightPlayers = [];
  game.capturedPlay = {
    id: String(play.id), text: scoring.text, type: scoring.type?.text,
    period: play.period.number, clock: play.clock.displayValue,
    awayScore: play.awayScore, homeScore: play.homeScore,
  };
  return game;
}

function ordinal(n) {
  return ['', '1st', '2nd', '3rd', '4th'][n] ?? `Period ${n}`;
}

function toFeedPlay(play) {
  const start = play.start ?? {};
  const end = play.end ?? {};
  if (!play.id || !play.text || !play.clock?.displayValue || !play.period?.number) {
    throw new Error(`Incomplete play in drive chart: ${play.id ?? 'unknown'}`);
  }
  return {
    id: String(play.id),
    seq: Number(play.sequenceNumber),
    text: play.text,
    shortText: play.shortText ?? play.text,
    scoring: Boolean(play.scoringPlay),
    scoreValue: 0,
    teamId: play.teamParticipants?.[0]?.id ?? start.team?.id ?? null,
    period: play.period.number,
    clock: play.clock.displayValue,
    homeScore: play.homeScore,
    awayScore: play.awayScore,
    wallclock: play.wallclock,
    typeId: play.type?.id ?? null,
    typeText: play.type?.text ?? null,
    athletes: [],
    down: start.down ?? 0,
    distance: start.distance ?? 0,
    yardsToEndzone: start.yardsToEndzone ?? 0,
    endYardsToEndzone: end.yardsToEndzone ?? 0,
    endDown: end.down ?? 0,
    endDistance: end.distance ?? 0,
    downDistanceText: start.downDistanceText ?? null,
    shortDownDistanceText: start.shortDownDistanceText ?? null,
    possessionText: start.possessionText ?? null,
    possessionTeamId: start.team?.id ?? null,
    yards: play.statYardage ?? 0,
    turnover: Boolean(play.isTurnover),
    penalty: Boolean(play.isPenalty),
  };
}
