const fs = require("fs");

const DATA_FILE = "smr-show-schedule.json";
const OUTPUT_FILE = "smr-show-schedule.xml";

const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

const DAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getLondonDate(date) {
  return new Date(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date).split("/").reverse().join("-") + "T00:00:00"
  );
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function createDate(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function getOccurrences(show, startDate, daysAhead = 30) {
  const occurrences = [];

  for (let i = 0; i < daysAhead; i++) {
    const date = addDays(startDate, i);
    const day = date.getDay();

    let include = false;
    let dj = show.dj || "";

    if (show.type === "once") {
      const target = new Date(`${show.date}T00:00:00`);
      include =
        date.getFullYear() === target.getFullYear() &&
        date.getMonth() === target.getMonth() &&
        date.getDate() === target.getDate();
    }

    if (show.type === "daily") {
      include = true;
    }

    if (show.type === "weekly") {
      include = day === DAYS[show.day];
    }

    if (show.type === "weekday") {
      include = day >= 1 && day <= 5;

      if (show.djByDay && show.djByDay[String(day)]) {
        dj = show.djByDay[String(day)];
      }
    }

    if (include) {
      const start = createDate(date, show.start);
      const end = createDate(date, show.end);

      // Overnight shows such as 22:00–07:00
      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }

      occurrences.push({
        show,
        dj,
        start,
        end
      });
    }
  }

  return occurrences;
}

const now = new Date();
const startDate = getLondonDate(now);

let occurrences = [];

for (const show of data.shows) {
  occurrences.push(...getOccurrences(show, startDate, 30));
}

occurrences = occurrences
  .filter(item => item.start >= now)
  .sort((a, b) => a.start - b.start)
  .slice(0, 40);

function formatRFC822(date) {
  return date.toUTCString();
}

const items = occurrences.map(item => {
  const title = item.dj
    ? `${item.show.name} with ${item.dj}`
    : item.show.name;

  const description =
    `${item.show.name} with ${item.dj || "Social Music Radio"} ` +
    `from ${item.start.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    })} to ${item.end.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    })}.`;

  const guid =
    `smr-${item.show.name}-${item.start.toISOString()}`
      .replace(/[^a-zA-Z0-9-]/g, "-");

  return `
    <item>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(description)}</description>
      <pubDate>${formatRFC822(item.start)}</pubDate>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <category>Radio Show</category>
    </item>`;
}).join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Social Music Radio - Show Schedule</title>
    <link>https://www.socialmusicradio.uk/</link>
    <description>Upcoming Social Music Radio shows and presenters</description>
    <language>en-gb</language>
    <ttl>60</ttl>

${items}

  </channel>
</rss>
`;

fs.writeFileSync(OUTPUT_FILE, rss.trim() + "\n");

console.log(`Generated ${OUTPUT_FILE}`);
