import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.ts";
import { Database } from "../src/database.ts";
import { GenerationService } from "../src/generation.ts";
import { PostgresStore } from "../src/store.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const assetsDirectory = join(scriptDirectory, "../demo-assets");
const childPublicId = process.argv[2] ?? "KID-T33J-GZ5X";
const projectTitle = "The Lost Little Wish";

const template = await readFile(join(assetsDirectory, "lost-little-wish-demo.html"), "utf8");
const background = await readFile(join(assetsDirectory, "lost-little-wish-background-v1.webp"));
const backgroundDataUri = `data:image/webp;base64,${background.toString("base64")}`;

const builds = [
  {
    key: "lost-wish-listen",
    chapters: 1,
    forgivingChoices: false,
    gentleTiming: false,
    fullBleed: false,
    minutesAgo: 45,
    prompt:
      "I want Lumi the fox to collect five glowing blue whispers in the moonlight. The player should tap the brightest whisper, avoid the noisy thorn cloud, and have three lantern hearts, a score, and a combo so every tap has a clear result.",
  },
  {
    key: "lost-wish-memory",
    chapters: 2,
    forgivingChoices: false,
    gentleTiming: false,
    fullBleed: false,
    minutesAgo: 35,
    prompt:
      "I tested the first adventure and the whispers disappeared too fast. Keep each one glowing longer, add a clear hint, and then let the whispers play a three-note pattern that the player repeats as a memory round.",
  },
  {
    key: "lost-wish-kindness",
    chapters: 3,
    forgivingChoices: false,
    gentleTiming: false,
    fullBleed: false,
    minutesAgo: 27,
    prompt:
      "After playing the memory round, I noticed three notes felt clearer and more fun than a long pattern. Keep the gentle timing and add a final story choice where Lumi helps the lost wish by listening and choosing a kind answer. Show stars, a final score, and a replay button.",
  },
  {
    key: "lost-wish-forgiving",
    chapters: 3,
    forgivingChoices: true,
    gentleTiming: false,
    fullBleed: false,
    minutesAgo: 20,
    prompt:
      "I played the whole adventure twice and noticed that losing on the story choice made the ending feel less kind. Let the player try that answer again, keep the encouraging hint, and celebrate listening, memory, and kindness together at the end.",
  },
  {
    key: "lost-wish-gentle-timing",
    chapters: 3,
    forgivingChoices: true,
    gentleTiming: true,
    fullBleed: false,
    minutesAgo: 12,
    prompt:
      "I watched someone new try the game and noticed they lost a heart while reading. Make the glowing whisper wait instead of punishing slow readers, keep the timer as a gentle visual hint, and let hearts only change after an actual tap on the wrong thing.",
  },
  {
    key: "lost-wish-fullscreen",
    chapters: 3,
    forgivingChoices: true,
    gentleTiming: true,
    fullBleed: true,
    minutesAgo: 8,
    prompt:
      "I tried the game on a tall phone and noticed the empty bars made the forest feel small. Make the moonlight world fill the whole portrait screen, keep every glowing whisper lined up with its picture, and still show the complete scene safely on a tablet turned sideways.",
  },
  {
    key: "lost-wish-console-safe",
    chapters: 3,
    forgivingChoices: true,
    gentleTiming: true,
    fullBleed: true,
    minutesAgo: 3,
    prompt:
      "I playtested the full-screen version and noticed the return-to-console control could cover the score. Move the score, chapter, hearts, and mission into a clear band below it so the game rules and the five-second exit are both easy to use.",
  },
];

function htmlForBuild(versionNumber, chapters, forgivingChoices, gentleTiming, fullBleed) {
  const html = template
    .replaceAll("__BACKGROUND_DATA_URI__", backgroundDataUri)
    .replaceAll("__BUILD_VERSION__", String(versionNumber))
    .replaceAll("__CHAPTER_COUNT__", String(chapters))
    .replaceAll("__FORGIVING_CHOICES__", String(forgivingChoices))
    .replaceAll("__GENTLE_TIMING__", String(gentleTiming))
    .replaceAll("__FULL_BLEED__", String(fullBleed));
  if (Buffer.byteLength(html, "utf8") > 300_000) {
    throw new Error("The demo game bundle exceeds the 300 KB game limit");
  }
  return html;
}

const config = loadConfig({ openAiApiKey: undefined });
const database = new Database(config.databaseUrl);
const store = new PostgresStore(database);

try {
  await database.migrate();
  const targetResult = await database.pool.query(
    `select p.id, p.child_user_id, gl.guardian_user_id
     from projects p
     join users child on child.id = p.child_user_id
     join guardian_links gl on gl.child_user_id = child.id and gl.status = 'active'
     where child.child_public_id = $1 and p.title = $2
     limit 1`,
    [childPublicId, projectTitle],
  );
  const target = targetResult.rows[0];
  if (!target) {
    throw new Error(`Could not find linked demo project “${projectTitle}” for ${childPublicId}`);
  }

  const versionIds = new Map();
  await database.transaction(async (client) => {
    await client.query("select id from projects where id = $1 for update", [target.id]);
    const maximumResult = await client.query(
      "select coalesce(max(version_number), 0)::int as maximum from project_versions where project_id = $1",
      [target.id],
    );
    let nextVersion = maximumResult.rows[0].maximum + 1;

    for (const build of builds) {
      const { minutesAgo } = build;
      const existingResult = await client.query(
        "select id, version_number from project_versions where project_id = $1 and prompt = $2 limit 1",
        [target.id, build.prompt],
      );
      const existing = existingResult.rows[0];
      if (existing) {
        versionIds.set(build.key, { id: existing.id, versionNumber: existing.version_number });
        await client.query(
          "update project_versions set created_at = now() - ($2::int * interval '1 minute') where id = $1",
          [existing.id, minutesAgo],
        );
        await client.query(
          `update activity_events
           set metadata = $3::jsonb, created_at = now() - ($4::int * interval '1 minute')
           where project_id = $1 and type = 'edit' and metadata->>'instruction' = $2`,
          [
            target.id,
            build.prompt,
            JSON.stringify({ instruction: build.prompt, versionNumber: existing.version_number }),
            minutesAgo,
          ],
        );
        continue;
      }

      const versionNumber = nextVersion;
      nextVersion += 1;
      const versionResult = await client.query(
        `insert into project_versions (project_id, version_number, prompt, html, created_at)
         values ($1, $2, $3, $4, now() - ($5::int * interval '1 minute'))
         returning id, version_number`,
        [
          target.id,
          versionNumber,
          build.prompt,
          htmlForBuild(
            versionNumber,
            build.chapters,
            build.forgivingChoices,
            build.gentleTiming,
            build.fullBleed,
          ),
          minutesAgo,
        ],
      );
      const version = versionResult.rows[0];
      versionIds.set(build.key, { id: version.id, versionNumber: version.version_number });
      await client.query(
        `insert into activity_events (child_user_id, project_id, type, metadata, created_at)
         values ($1, $2, 'edit', $3::jsonb, now() - ($4::int * interval '1 minute'))`,
        [
          target.child_user_id,
          target.id,
          JSON.stringify({
            instruction: build.prompt,
            versionNumber: version.version_number,
          }),
          minutesAgo,
        ],
      );
    }

    const finalVersion = versionIds.get("lost-wish-console-safe");
    await client.query(
      "update projects set current_version_id = $2, updated_at = now() where id = $1",
      [target.id, finalVersion.id],
    );

    const processEvents = [
      {
        key: "lost-wish-plan",
        version: "lost-wish-listen",
        type: "game_plan",
        minutesAgo: 44,
        payload: {
          childStatement:
            "Lumi listens for five small voices. Blue whispers help, the noisy cloud gets in the way, and the golden star is the goal.",
          playerGoal: "Find all five whispers without losing three lantern glows.",
        },
      },
      {
        key: "lost-wish-prediction",
        version: "lost-wish-listen",
        type: "prediction",
        minutesAgo: 43,
        payload: {
          childStatement:
            "I think the bright moving ring will make the whisper easier to notice than the thorn cloud.",
        },
      },
      {
        key: "lost-wish-playtest-one",
        version: "lost-wish-listen",
        type: "playtest",
        minutesAgo: 40,
        payload: {
          childStatement:
            "I missed two whispers because they faded before I could tap them, but the score and hearts made sense.",
          result: "Five whispers were found after one retry.",
        },
      },
      {
        key: "lost-wish-reflection-one",
        version: "lost-wish-memory",
        type: "reflection",
        minutesAgo: 34,
        payload: {
          childStatement:
            "Slower whispers felt fairer. I added the memory song because listening should mean remembering too.",
        },
      },
      {
        key: "lost-wish-playtest-two",
        version: "lost-wish-memory",
        type: "playtest",
        minutesAgo: 31,
        payload: {
          childStatement:
            "Three notes were fun to repeat. A longer pattern felt frustrating, so I kept the short one.",
          result: "The memory round was completed twice.",
        },
      },
      {
        key: "lost-wish-reflection-two",
        version: "lost-wish-kindness",
        type: "reflection",
        minutesAgo: 25,
        payload: {
          childStatement:
            "My favorite part is that the ending is not only about points. Lumi wins by helping the wish feel heard.",
        },
      },
      {
        key: "lost-wish-reflection-three",
        version: "lost-wish-forgiving",
        type: "reflection",
        minutesAgo: 18,
        payload: {
          childStatement:
            "I changed the ending because a kindness game should help the player learn from a choice instead of punishing them.",
        },
      },
      {
        key: "lost-wish-playtest-three",
        version: "lost-wish-gentle-timing",
        type: "playtest",
        minutesAgo: 10,
        payload: {
          childStatement:
            "A new player paused to read and the whisper faded. The game should wait and encourage them instead.",
          result: "The first round was replayed with a slower reading pace.",
        },
      },
      {
        key: "lost-wish-reflection-four",
        version: "lost-wish-gentle-timing",
        type: "reflection",
        minutesAgo: 9,
        payload: {
          childStatement:
            "I kept the moving timer as a clue, but removed its penalty because noticing the real obstacle is the rule I want to teach.",
        },
      },
      {
        key: "lost-wish-playtest-fullscreen",
        version: "lost-wish-fullscreen",
        type: "playtest",
        minutesAgo: 6,
        payload: {
          childStatement:
            "On the tall phone, the forest now reaches every edge and all five blue whispers still match their touch spots.",
          result: "Portrait and landscape layouts were both opened and played.",
        },
      },
      {
        key: "lost-wish-reflection-fullscreen",
        version: "lost-wish-fullscreen",
        type: "reflection",
        minutesAgo: 5,
        payload: {
          childStatement:
            "Filling the screen makes Lumi's world feel like the adventure, while the simpler sideways view keeps the rules readable.",
        },
      },
      {
        key: "lost-wish-playtest-console-safe",
        version: "lost-wish-console-safe",
        type: "playtest",
        minutesAgo: 1,
        payload: {
          childStatement:
            "I opened the game from the developer console and checked that the return button no longer covers the score or instructions.",
          result: "The native return control and game HUD were both visible and touchable.",
        },
      },
      {
        key: "lost-wish-reflection-console-safe",
        version: "lost-wish-console-safe",
        type: "reflection",
        minutesAgo: 0,
        payload: {
          childStatement:
            "The exit is part of how someone plays my game, so I made space for it instead of hiding the score underneath.",
        },
      },
    ];

    for (const event of processEvents) {
      const version = versionIds.get(event.version);
      await client.query(
        `insert into creative_process_events (
           child_user_id, project_id, project_version_id, type, payload, created_at
         )
         select $1, $2, $3, $4, $5::jsonb, now() - ($6::int * interval '1 minute')
         where not exists (
           select 1 from creative_process_events
           where project_id = $2 and payload->>'childStatement' = $7
         )`,
        [
          target.child_user_id,
          target.id,
          version.id,
          event.type,
          JSON.stringify(event.payload),
          event.minutesAgo,
          event.payload.childStatement,
        ],
      );
      await client.query(
        `update creative_process_events
         set payload = $3::jsonb, created_at = now() - ($4::int * interval '1 minute')
         where project_id = $1 and type = $2 and payload->>'childStatement' = $5`,
        [
          target.id,
          event.type,
          JSON.stringify(event.payload),
          event.minutesAgo,
          event.payload.childStatement,
        ],
      );

      if (event.type === "playtest" || event.type === "reflection") {
        await client.query(
          `insert into activity_events (child_user_id, project_id, type, metadata, created_at)
           select $1, $2, $3, $4::jsonb, now() - ($5::int * interval '1 minute')
           where not exists (
             select 1 from activity_events
             where project_id = $2 and type = $3 and metadata->>'note' = $6
           )`,
          [
            target.child_user_id,
            target.id,
            event.type,
            JSON.stringify({
              note: event.payload.childStatement,
              versionNumber: version.versionNumber,
            }),
            event.minutesAgo,
            event.payload.childStatement,
          ],
        );
        await client.query(
          `update activity_events
           set metadata = $3::jsonb, created_at = now() - ($4::int * interval '1 minute')
           where project_id = $1 and type = $2 and metadata->>'note' = $5`,
          [
            target.id,
            event.type,
            JSON.stringify({
              note: event.payload.childStatement,
              versionNumber: version.versionNumber,
            }),
            event.minutesAgo,
            event.payload.childStatement,
          ],
        );
      }
    }
  });

  const projects = await store.listProjectsWithVersionsForChild(target.child_user_id);
  const generation = new GenerationService(config);
  const content = await generation.createChildInsight({
    childUserId: target.child_user_id,
    projects,
  });
  const insight = await store.saveChildInsight({
    childUserId: target.child_user_id,
    requestedByGuardianUserId: target.guardian_user_id,
    sourceProjectIds: projects.map((project) => project.id),
    sourceVersionIds: projects.flatMap((project) => project.versions.map((version) => version.id)),
    content,
  });

  console.log(
    JSON.stringify(
      {
        childPublicId,
        project: projectTitle,
        currentVersion: versionIds.get("lost-wish-console-safe").versionNumber,
        insightId: insight.id,
        radar: insight.radar.dimensions.map(({ key, level, label }) => ({ key, level, label })),
      },
      null,
      2,
    ),
  );
} finally {
  await database.close();
}
