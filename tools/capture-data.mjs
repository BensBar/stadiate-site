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
