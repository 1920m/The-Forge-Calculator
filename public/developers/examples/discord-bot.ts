/**
 * Reference /forge-calc command for discord.js v14, using the Forge Calculator API. Drop the pieces you need into an
 * existing bot: the command definition, `handleForgeCalc` for interactions, and the embed builders.
 *
 *   /forge-calc catalogue ore:<autocomplete>
 *   /forge-calc calculator type:<Weapon|Armour> item:<autocomplete> ore1:<autocomplete> qty1:<1-99> [ore2 qty2 ... ore4 qty4]
 *
 * Results have five quality buttons (25/50/75/90/100%). Only the person who ran the command can press them; the bot
 * recalculates the same recipe at that quality and edits the message.
 *
 * Environment: FORGE_API_KEY (from the Forge Calculator admin), DISCORD_TOKEN, DISCORD_APP_ID, optional DISCORD_GUILD_ID.
 * Needs: npm i discord.js   (and forge-api.ts from the same folder)
 */
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags, REST, Routes,
  SlashCommandBuilder, StringSelectMenuBuilder,
  type AutocompleteInteraction, type ButtonInteraction, type ChatInputCommandInteraction, type Interaction, type StringSelectMenuInteraction,
} from "discord.js";
import { ForgeApi, ForgeApiError, autocomplete, type ForgeRequest, type Ore, type Ok } from "./forge-api";

const QUALITIES = [25, 50, 75, 90, 100] as const;
const RARITY_COLOUR: Record<string, number> = {
  Common: 0x9d9d9d, Uncommon: 0x5fbf4a, Rare: 0x3f8fdd, Epic: 0xa35ddb, Legendary: 0xf0b232, Mythic: 0xe0473b, Relic: 0xe8743b, Exotic: 0x3fd4c4, Divine: 0xffe066,
};

/* ------------------------------------------------------------------ command definition */

export const forgeCalcCommand = new SlashCommandBuilder()
  .setName("forge-calc")
  .setDescription("The Forge Calculator")
  .addSubcommand((s) => s.setName("catalogue").setDescription("Look up an ore")
    .addStringOption((o) => o.setName("ore").setDescription("Ore name").setRequired(true).setAutocomplete(true)))
  .addSubcommand((s) => {
    s.setName("calculator").setDescription("What a recipe forges, at 100% quality (buttons for other qualities)")
      .addStringOption((o) => o.setName("type").setDescription("Weapon or armour").setRequired(true).addChoices({ name: "Weapon", value: "weapon" }, { name: "Armour", value: "armour" }))
      .addStringOption((o) => o.setName("item").setDescription("The item you're aiming for").setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName("ore1").setDescription("Ore 1").setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName("qty1").setDescription("How many of ore 1").setRequired(true).setMinValue(1).setMaxValue(99));
    for (const n of [2, 3, 4]) {
      s.addStringOption((o) => o.setName(`ore${n}`).setDescription(`Ore ${n}`).setAutocomplete(true))
        .addIntegerOption((o) => o.setName(`qty${n}`).setDescription(`How many of ore ${n}`).setMinValue(1).setMaxValue(99));
    }
    return s;
  });

/** Registers the command (guild commands update instantly; global ones can take up to an hour). */
export async function registerForgeCalc(token: string, appId: string, guildId?: string) {
  const rest = new REST().setToken(token);
  const route = guildId ? Routes.applicationGuildCommands(appId, guildId) : Routes.applicationCommands(appId);
  await rest.put(route, { body: [forgeCalcCommand.toJSON()] });
}

/* ------------------------------------------------------------------ recipes behind the buttons */

type Pending = { userId: string; recipe: ForgeRequest; expires: number };
const recipes = new Map<string, Pending>(); // short token → recipe (custom IDs are limited to 100 characters)
const TTL = 15 * 60 * 1000;

function remember(userId: string, recipe: ForgeRequest): string {
  const now = Date.now();
  for (const [k, v] of recipes) if (v.expires < now) recipes.delete(k);
  const token = Math.random().toString(36).slice(2, 10);
  recipes.set(token, { userId, recipe, expires: now + TTL });
  return token;
}

/* ------------------------------------------------------------------ interactions */

export async function handleForgeCalc(api: ForgeApi, i: Interaction): Promise<void> {
  if (i.isAutocomplete() && i.commandName === "forge-calc") return onAutocomplete(api, i);
  if (i.isChatInputCommand() && i.commandName === "forge-calc") {
    return i.options.getSubcommand() === "catalogue" ? onCatalogue(api, i) : onCalculator(api, i);
  }
  if (i.isButton() && i.customId.startsWith("fcq:")) return onQuality(api, i);
  if (i.isStringSelectMenu() && i.customId.startsWith("fcw:")) return onWorld(api, i);
}

async function onAutocomplete(api: ForgeApi, i: AutocompleteInteraction) {
  const focused = i.options.getFocused(true);
  try {
    if (focused.name === "item") {
      const type = i.options.getString("type");
      const list = type === "armour" ? await api.armour() : type === "weapon" ? await api.weapons() : [...await api.weapons(), ...await api.armour()];
      await i.respond(autocomplete(list, String(focused.value)));
    } else {
      await i.respond(autocomplete(await api.ores(), String(focused.value)));
    }
  } catch {
    await i.respond([]).catch(() => {}); // autocomplete must answer within 3 seconds; an empty list is better than nothing
  }
}

async function onCatalogue(api: ForgeApi, i: ChatInputCommandInteraction) {
  await i.deferReply();
  try {
    const typed = i.options.getString("ore", true);
    const ores = await api.ores();
    const ore = ores.find((o) => o.id === typed) ?? ores.find((o) => o.name.toLowerCase() === typed.toLowerCase());
    if (!ore) { await i.editReply(`No ore called "${typed}". Pick one from the list as you type.`); return; }
    await i.editReply({ embeds: [oreEmbed(ore)] });
  } catch (e) {
    await i.editReply(errorText(e));
  }
}

async function onCalculator(api: ForgeApi, i: ChatInputCommandInteraction) {
  const ores = new Map<string, number>();
  for (const n of [1, 2, 3, 4]) {
    const id = i.options.getString(`ore${n}`);
    const qty = i.options.getInteger(`qty${n}`);
    if (!id && !qty) continue;
    if (!id || !qty) { await i.reply({ content: `Ore ${n} needs both a name and a quantity.`, flags: MessageFlags.Ephemeral }); return; }
    ores.set(id, Math.min(99, (ores.get(id) ?? 0) + qty)); // the same ore twice: add them up
  }
  const recipe: ForgeRequest = {
    type: "forge", kind: i.options.getString("type", true) as "weapon" | "armour", item: i.options.getString("item", true),
    ores: [...ores].map(([id, count]) => ({ id, count })), quality: 100,
  };
  await i.deferReply(); // the API usually answers in well under a second, but deferring avoids Discord's 3-second limit
  await showResult(api, i.user.id, recipe, (msg) => i.editReply(msg));
}

async function onQuality(api: ForgeApi, i: ButtonInteraction) {
  const [, token, q] = i.customId.split(":");
  const pending = recipes.get(token);
  if (!pending || pending.expires < Date.now()) { await i.reply({ content: "This calculation has expired. Run /forge-calc calculator again.", flags: MessageFlags.Ephemeral }); return; }
  if (pending.userId !== i.user.id) { await i.reply({ content: "Only the person who ran this can change it. Run /forge-calc calculator for your own.", flags: MessageFlags.Ephemeral }); return; }
  await i.deferUpdate();
  const recipe = { ...pending.recipe, quality: Number(q) }; // same ores, item and world; only the quality changes
  await showResult(api, i.user.id, recipe, (msg) => i.editReply(msg), token);
}

async function onWorld(api: ForgeApi, i: StringSelectMenuInteraction) {
  const [, token] = i.customId.split(":");
  const pending = recipes.get(token);
  if (!pending || pending.userId !== i.user.id) { await i.reply({ content: "Run /forge-calc calculator for your own result.", flags: MessageFlags.Ephemeral }); return; }
  await i.deferUpdate();
  const recipe = { ...pending.recipe, world: Number(i.values[0]) as 2 | 3 | 4 };
  await showResult(api, i.user.id, recipe, (msg) => i.editReply(msg));
}

type Reply = { content?: string; embeds?: EmbedBuilder[]; components?: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] };

async function showResult(api: ForgeApi, userId: string, recipe: ForgeRequest, send: (r: Reply) => Promise<unknown>, existingToken?: string) {
  try {
    const res = await api.calculate<ForgeData>(recipe);
    const token = existingToken ?? remember(userId, { ...recipe, world: res.data.world as 2 | 3 | 4 });
    if (existingToken) { const p = recipes.get(existingToken); if (p) p.recipe = { ...p.recipe, quality: recipe.quality }; }
    await send({ content: "", embeds: [forgeEmbed(res)], components: resultButtons(token, recipe.quality ?? 100, res.data.links.calculator) });
  } catch (e) {
    if (e instanceof ForgeApiError && e.code === "WORLD_REQUIRED") {
      // The item comes out of more than one world's forge with different odds: ask once.
      const d = e.details as { worlds: number[]; labels: string[] };
      const token = remember(userId, recipe);
      const menu = new StringSelectMenuBuilder().setCustomId(`fcw:${token}`).setPlaceholder("Which world are you forging in?")
        .addOptions(d.worlds.map((w, n) => ({ label: `World ${d.labels[n]}`, value: String(w) })));
      await send({ content: "This item can be forged in more than one world, with different odds. Pick yours:", embeds: [], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });
      return;
    }
    await send({ content: errorText(e), embeds: [], components: [] });
  }
}

function resultButtons(token: string, quality: number, link: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(QUALITIES.map((q) => new ButtonBuilder()
    .setCustomId(`fcq:${token}:${q}`).setLabel(`${q}%`).setStyle(q === quality ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(q === quality)));
  const web = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link).setLabel("Open in Forge Calculator"));
  return [row, web];
}

/* ------------------------------------------------------------------ embeds */

type ForgeData = {
  world: number; worldLabel: string; worldInferred: boolean; kind: "weapon" | "armour"; quality: { percent: number; label: string };
  ores: { id: string; name: string; count: number; share: number }[]; totalOres: number; multiplier: number | null; rarity: string | null;
  item: {
    id: string; name: string; class: string; slot: string | null; image: string | null;
    stat: { name: string; unit: string; value: number | null };
    weapon: { attackInterval: number | null; dps: { total: number; hitsPerSecond: number } | null } | null;
    chance: { overall: number; inClass: number; classChance: number }; lock: { lockable: boolean; lockAt: number };
  };
  traits: { active: { ore: { name: string }; strength: number; effects: { text: string }[] }[] };
  links: { calculator: string };
};

const pct = (n: number) => `${n < 0.1 && n > 0 ? n.toFixed(3) : n < 10 ? n.toFixed(2) : n.toFixed(1)}%`;
const fmt = (n: number | null | undefined, d = 2) => (n == null ? "–" : n.toLocaleString("en-GB", { maximumFractionDigits: d }));

export function forgeEmbed(res: Ok<ForgeData>): EmbedBuilder {
  const d = res.data, it = d.item;
  const e = new EmbedBuilder()
    .setTitle(it.name).setURL(d.links.calculator).setColor(RARITY_COLOUR[d.rarity ?? ""] ?? 0x8a5cc9)
    .setDescription(`${it.class}${it.slot ? ` · ${it.slot}` : ""} · World ${d.worldLabel} · ${d.quality.label} (${d.quality.percent}%)`)
    .addFields(
      { name: "Materials", value: d.ores.map((o) => `${o.count} × ${o.name} (${Math.round(o.share * 100)}%)`).join("\n").slice(0, 1024) },
      { name: "Multiplier", value: d.multiplier == null ? "–" : `${fmt(d.multiplier)}×`, inline: true },
      { name: "Rarity", value: d.rarity ?? "–", inline: true },
      { name: it.stat.name === "damage" ? "Damage" : "Defence", value: `${fmt(it.stat.value)} ${it.stat.unit}`, inline: true },
    );
  if (d.kind === "weapon" && it.weapon) {
    const hps = it.weapon.dps?.hitsPerSecond;
    e.addFields(
      { name: "Attack speed", value: it.weapon.attackInterval ? `${it.weapon.attackInterval}s per hit${hps ? ` · ${fmt(hps)} hits/s` : ""}` : "–", inline: true },
      { name: "Estimated DPS", value: it.weapon.dps ? fmt(it.weapon.dps.total) : "–", inline: true },
    );
  }
  e.addFields({ name: "Chance", value: `${pct(it.chance.overall)} overall (${pct(it.chance.inClass)} of ${it.class}). ${it.lock.lockable ? `${it.class} can be locked.` : `Lockable from ${it.lock.lockAt} ores.`}` });
  const traits = d.traits.active.map((t) => `**${t.ore.name}** (${Math.round(t.strength * 100)}%): ${t.effects.map((x) => x.text).join("; ")}`).join("\n");
  if (traits) e.addFields({ name: "Traits", value: traits.slice(0, 1024) });
  if (it.image) e.setThumbnail(it.image);
  const notes = (res.warnings ?? []).filter((w) => w.code !== "ESTIMATED_DPS").map((w) => w.message);
  e.setFooter({ text: [d.kind === "weapon" ? "DPS is an estimate, not measured in game." : "", ...notes].filter(Boolean).join(" ").slice(0, 2048) || "Forge Calculator" });
  return e;
}

export function oreEmbed(o: Ore): EmbedBuilder {
  const e = new EmbedBuilder().setTitle(o.name).setColor(RARITY_COLOUR[o.rarity] ?? 0x8a5cc9)
    .addFields(
      { name: "Rarity", value: o.rarity, inline: true },
      { name: "Multiplier", value: o.multiplierRule === "average" ? "Takes the other ores' average" : `${o.multiplier}×`, inline: true },
      { name: "Worlds", value: o.worlds.join(", ") || "–", inline: true },
      { name: "Drop chance", value: o.dropChance ? `1 in ${o.dropChance.oneIn.toLocaleString("en-GB")}` : "Unknown", inline: true },
      { name: "Found in", value: o.foundIn ?? "Unknown", inline: true },
      { name: "Good for", value: [o.hasTraits.weapon && "weapons", o.hasTraits.armour && "armour"].filter(Boolean).join(" and ") || "No traits", inline: true },
    );
  for (const t of o.traits.slice(0, 5)) {
    const where = t.appliesTo.length === 2 ? "Weapon and armour trait" : t.appliesTo[0] === "weapon" ? "Weapon trait" : "Armour trait";
    e.addFields({ name: where, value: t.text.slice(0, 1024) });
  }
  e.setFooter({ text: `${o.traitRule.note}${o.verified ? "" : " Some values aren't confirmed yet."}` });
  if (o.image) e.setThumbnail(o.image);
  return e;
}

/** What to tell the user for each kind of failure. */
export function errorText(e: unknown): string {
  if (!(e instanceof ForgeApiError)) return "Something went wrong. Try again in a moment.";
  if (e.code === "RATE_LIMITED") return `The calculator is busy. Try again in ${e.retryAfter ?? 30} seconds.`;
  if (e.status === 422) return e.message; // the recipe itself: unknown ore, too few ores, wrong item type...
  if (e.status === 401 || e.status === 403) return "The bot's Forge Calculator key isn't working. Tell the bot's owner.";
  return "The Forge Calculator isn't answering right now. Try again in a few minutes.";
}

/* ------------------------------------------------------------------ stand-alone run (npx tsx discord-bot.ts) */

if (process.argv[1]?.endsWith("discord-bot.ts")) {
  const { FORGE_API_KEY, DISCORD_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID } = process.env;
  if (!FORGE_API_KEY || !DISCORD_TOKEN || !DISCORD_APP_ID) throw new Error("Set FORGE_API_KEY, DISCORD_TOKEN and DISCORD_APP_ID.");
  const api = new ForgeApi(FORGE_API_KEY);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.on(Events.InteractionCreate, (i) => { void handleForgeCalc(api, i).catch((err) => console.error("forge-calc:", err)); });
  // Warm the catalogue cache so the first autocomplete answers instantly.
  void Promise.all([api.ores(), api.weapons(), api.armour()]).catch((err) => console.error("forge-calc: catalogue not loaded yet:", err.message));
  void registerForgeCalc(DISCORD_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID).then(() => client.login(DISCORD_TOKEN));
}
