#!/bin/bash

# Logseq Daily Journal Automation
# 매일 아침 6시에 실행되어 오늘의 저널 생성 + 날씨 추가

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGSEQ_GRAPH_PATH="${LOGSEQ_GRAPH_PATH:-/Users/hbk/Documents/logseq}"
WEATHER_LOCATION="${WEATHER_LOCATION:-용인시 수지구 동천동}"

# 오늘 날짜
TODAY=$(date +%Y_%m_%d)
JOURNAL_FILE="$LOGSEQ_GRAPH_PATH/journals/${TODAY}.md"

# 이미 존재하면 스킵
if [ -f "$JOURNAL_FILE" ]; then
    echo "Journal already exists: $JOURNAL_FILE"
    exit 0
fi

# Node.js로 저널 생성 + 날씨 추가
cd "$SCRIPT_DIR"
export JOURNAL_FILE="$JOURNAL_FILE"
export WEATHER_LOCATION="$WEATHER_LOCATION"
/opt/homebrew/bin/node -e "
import('./dist/weather-scraper.js').then(async (mod) => {
  const fs = await import('fs');

  const location = process.env.WEATHER_LOCATION || '용인시 수지구 동천동';
  const scraper = new mod.WeatherScraper(location);
  const weather = await scraper.getWeather();

  let weatherLines = '';
  if (weather) {
    const lines = scraper.formatWeatherForLogseq(weather);
    weatherLines = lines.map(l => '\t\t- ' + l).join('\n');
  }

  const template = \`- [[일기]]
\t- [[날씨]]
\${weatherLines}
\t- [[오늘의 일기]]
\t\t- [[행복도]]
\t\t\t-
\t\t- [[오늘의 행복]]
\t\t\t-
\t\t- [[오늘의 컨디션]]
\t\t\t-
\t\t- [[오늘 잘 해낸 일]]
\t\t\t-
\t\t- [[TIL]]
\t\t\t-
- [[Tasks]]
\t-
\`;

  const journalPath = process.env.JOURNAL_FILE;
  fs.writeFileSync(journalPath, template);
  console.log('Created journal:', journalPath);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
"

echo "Daily journal created successfully"
