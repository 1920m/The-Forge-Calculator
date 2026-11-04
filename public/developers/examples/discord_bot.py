"""
Minimal /forge-calc command for discord.py 2.x, using forge_api.py from the same folder.

    pip install discord.py
    FORGE_API_KEY=fc_live_... DISCORD_TOKEN=... python discord_bot.py

Same behaviour as the discord.js example: catalogue lookups, a calculator with autocomplete, five quality buttons that
only the person who ran the command can press, and a world picker when an item can come from more than one forge.
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional

import discord
from discord import app_commands

from forge_api import ForgeApi, ForgeApiError, autocomplete

QUALITIES = (25, 50, 75, 90, 100)
RARITY_COLOUR = {"Common": 0x9D9D9D, "Uncommon": 0x5FBF4A, "Rare": 0x3F8FDD, "Epic": 0xA35DDB, "Legendary": 0xF0B232,
                 "Mythic": 0xE0473B, "Relic": 0xE8743B, "Exotic": 0x3FD4C4, "Divine": 0xFFE066}

api = ForgeApi(os.environ.get("FORGE_API_KEY", ""), os.environ.get("FORGE_API_BASE", "https://the-forge-calculator.vercel.app/api/v1"))
client = discord.Client(intents=discord.Intents.default())
tree = app_commands.CommandTree(client)
group = app_commands.Group(name="forge-calc", description="The Forge Calculator")


def fmt(n: Optional[float]) -> str:
    return "–" if n is None else f"{n:,.2f}".rstrip("0").rstrip(".")


def pct(n: float) -> str:
    return f"{n:.3f}%" if 0 < n < 0.1 else f"{n:.2f}%" if n < 10 else f"{n:.1f}%"


def error_text(e: Exception) -> str:
    if not isinstance(e, ForgeApiError):
        return "Something went wrong. Try again in a moment."
    if e.code == "RATE_LIMITED":
        return f"The calculator is busy. Try again in {e.retry_after or 30} seconds."
    if e.status == 422:
        return e.message
    if e.status in (401, 403):
        return "The bot's Forge Calculator key isn't working. Tell the bot's owner."
    return "The Forge Calculator isn't answering right now. Try again in a few minutes."


def forge_embed(res: dict) -> discord.Embed:
    d, it = res["data"], res["data"]["item"]
    e = discord.Embed(title=it["name"], url=d["links"]["calculator"], colour=RARITY_COLOUR.get(d.get("rarity") or "", 0x8A5CC9),
                      description=f"{it['class']}{' · ' + it['slot'] if it.get('slot') else ''} · World {d['worldLabel']} · {d['quality']['label']} ({d['quality']['percent']}%)")
    e.add_field(name="Materials", value="\n".join(f"{o['count']} × {o['name']} ({round(o['share'] * 100)}%)" for o in d["ores"])[:1024], inline=False)
    e.add_field(name="Multiplier", value="–" if d["multiplier"] is None else f"{fmt(d['multiplier'])}×")
    e.add_field(name="Rarity", value=d.get("rarity") or "–")
    e.add_field(name="Damage" if it["stat"]["name"] == "damage" else "Defence", value=f"{fmt(it['stat']['value'])} {it['stat']['unit']}")
    w = it.get("weapon")
    if d["kind"] == "weapon" and w:
        dps = w.get("dps")
        speed = f"{w['attackInterval']}s per hit" + (f" · {fmt(dps['hitsPerSecond'])} hits/s" if dps else "") if w.get("attackInterval") else "–"
        e.add_field(name="Attack speed", value=speed)
        e.add_field(name="Estimated DPS", value=fmt(dps["total"]) if dps else "–")
    ch, lock = it["chance"], it["lock"]
    e.add_field(name="Chance", inline=False, value=f"{pct(ch['overall'])} overall ({pct(ch['inClass'])} of {it['class']}). "
                + (f"{it['class']} can be locked." if lock["lockable"] else f"Lockable from {lock['lockAt']} ores."))
    traits = "\n".join(f"**{t['ore']['name']}** ({round(t['strength'] * 100)}%): " + "; ".join(x["text"] for x in t["effects"]) for t in d["traits"]["active"])
    if traits:
        e.add_field(name="Traits", value=traits[:1024], inline=False)
    if it.get("image"):
        e.set_thumbnail(url=it["image"])
    notes = [w["message"] for w in res.get("warnings") or [] if w["code"] != "ESTIMATED_DPS"]
    e.set_footer(text=" ".join(([("DPS is an estimate, not measured in game.")] if d["kind"] == "weapon" else []) + notes)[:2048] or "Forge Calculator")
    return e


def ore_embed(o: dict) -> discord.Embed:
    e = discord.Embed(title=o["name"], colour=RARITY_COLOUR.get(o["rarity"], 0x8A5CC9))
    e.add_field(name="Rarity", value=o["rarity"])
    e.add_field(name="Multiplier", value="Takes the other ores' average" if o["multiplierRule"] == "average" else f"{o['multiplier']}×")
    e.add_field(name="Worlds", value=", ".join(map(str, o["worlds"])) or "–")
    e.add_field(name="Drop chance", value=f"1 in {o['dropChance']['oneIn']:,}" if o.get("dropChance") else "Unknown")
    e.add_field(name="Found in", value=o.get("foundIn") or "Unknown")
    good = [k for k in ("weapon", "armour") if o["hasTraits"][k]]
    e.add_field(name="Good for", value=" and ".join("weapons" if g == "weapon" else g for g in good) or "No traits")
    for t in o["traits"][:5]:
        where = "Weapon and armour trait" if len(t["appliesTo"]) == 2 else "Weapon trait" if t["appliesTo"][0] == "weapon" else "Armour trait"
        e.add_field(name=where, value=t["text"][:1024], inline=False)
    e.set_footer(text=o["traitRule"]["note"] + ("" if o["verified"] else " Some values aren't confirmed yet."))
    if o.get("image"):
        e.set_thumbnail(url=o["image"])
    return e


class Result(discord.ui.View):
    """Quality buttons for one calculation. Only the owner can press them; they stop working after 15 minutes."""

    def __init__(self, owner_id: int, recipe: dict, link: str):
        super().__init__(timeout=900)
        self.owner_id, self.recipe = owner_id, recipe
        for q in QUALITIES:
            b = discord.ui.Button(label=f"{q}%", style=discord.ButtonStyle.success if q == recipe.get("quality", 100) else discord.ButtonStyle.secondary,
                                  disabled=q == recipe.get("quality", 100), row=0)
            b.callback = self._quality(q)
            self.add_item(b)
        self.add_item(discord.ui.Button(label="Open in Forge Calculator", url=link, row=1))

    async def interaction_check(self, i: discord.Interaction) -> bool:
        if i.user.id != self.owner_id:
            await i.response.send_message("Only the person who ran this can change it. Run /forge-calc calculator for your own.", ephemeral=True)
            return False
        return True

    def _quality(self, q: int):
        async def run(i: discord.Interaction):
            await i.response.defer()
            await show(i, self.owner_id, {**self.recipe, "quality": q})
        return run


class WorldPick(discord.ui.View):
    def __init__(self, owner_id: int, recipe: dict, worlds: list, labels: list):
        super().__init__(timeout=900)
        self.owner_id, self.recipe = owner_id, recipe
        sel = discord.ui.Select(placeholder="Which world are you forging in?", options=[discord.SelectOption(label=f"World {l}", value=str(w)) for w, l in zip(worlds, labels)])
        sel.callback = self._pick
        self.sel = sel
        self.add_item(sel)

    async def interaction_check(self, i: discord.Interaction) -> bool:
        if i.user.id != self.owner_id:
            await i.response.send_message("Run /forge-calc calculator for your own result.", ephemeral=True)
            return False
        return True

    async def _pick(self, i: discord.Interaction):
        await i.response.defer()
        await show(i, self.owner_id, {**self.recipe, "world": int(self.sel.values[0])})


async def show(i: discord.Interaction, owner_id: int, recipe: dict):
    try:
        res = await asyncio.to_thread(api.calculate, recipe)
        recipe = {**recipe, "world": res["data"]["world"]}  # pin the world so button presses don't re-infer it
        await i.edit_original_response(content=None, embed=forge_embed(res), view=Result(owner_id, recipe, res["data"]["links"]["calculator"]))
    except ForgeApiError as e:
        if e.code == "WORLD_REQUIRED":
            await i.edit_original_response(content="This item can be forged in more than one world, with different odds. Pick yours:", embed=None,
                                            view=WorldPick(owner_id, recipe, e.details["worlds"], e.details["labels"]))
        else:
            await i.edit_original_response(content=error_text(e), embed=None, view=None)


async def ore_choices(_: discord.Interaction, current: str):
    try:
        ores = await asyncio.to_thread(api.ores)
        return [app_commands.Choice(**c) for c in autocomplete(ores, current)]
    except ForgeApiError:
        return []


async def item_choices(i: discord.Interaction, current: str):
    try:
        kind = i.namespace.type
        items = await asyncio.to_thread(api.armour if kind == "armour" else api.weapons)
        return [app_commands.Choice(**c) for c in autocomplete(items, current)]
    except ForgeApiError:
        return []


@group.command(name="catalogue", description="Look up an ore")
@app_commands.autocomplete(ore=ore_choices)
async def catalogue(i: discord.Interaction, ore: str):
    await i.response.defer()
    try:
        ores = await asyncio.to_thread(api.ores)
        found = next((o for o in ores if o["id"] == ore or o["name"].lower() == ore.lower()), None)
        if found:
            await i.edit_original_response(embed=ore_embed(found))
        else:
            await i.edit_original_response(content=f'No ore called "{ore}". Pick one from the list as you type.')
    except ForgeApiError as e:
        await i.edit_original_response(content=error_text(e))


@group.command(name="calculator", description="What a recipe forges, at 100% quality (buttons for other qualities)")
@app_commands.choices(type=[app_commands.Choice(name="Weapon", value="weapon"), app_commands.Choice(name="Armour", value="armour")])
@app_commands.autocomplete(item=item_choices, ore1=ore_choices, ore2=ore_choices, ore3=ore_choices, ore4=ore_choices)
async def calculator(i: discord.Interaction, type: app_commands.Choice[str], item: str,
                     ore1: str, qty1: app_commands.Range[int, 1, 99],
                     ore2: Optional[str] = None, qty2: Optional[app_commands.Range[int, 1, 99]] = None,
                     ore3: Optional[str] = None, qty3: Optional[app_commands.Range[int, 1, 99]] = None,
                     ore4: Optional[str] = None, qty4: Optional[app_commands.Range[int, 1, 99]] = None):
    counts: dict = {}
    for n, (oid, qty) in enumerate([(ore1, qty1), (ore2, qty2), (ore3, qty3), (ore4, qty4)], start=1):
        if not oid and not qty:
            continue
        if not oid or not qty:
            await i.response.send_message(f"Ore {n} needs both a name and a quantity.", ephemeral=True)
            return
        counts[oid] = min(99, counts.get(oid, 0) + qty)
    await i.response.defer()
    recipe = {"type": "forge", "kind": type.value, "item": item, "ores": [{"id": k, "count": v} for k, v in counts.items()], "quality": 100}
    await show(i, i.user.id, recipe)


tree.add_command(group)


@client.event
async def setup_hook():
    # Warm the catalogue cache so the first autocomplete answers instantly.
    try:
        for load in (api.ores, api.weapons, api.armour):
            await asyncio.to_thread(load)
    except ForgeApiError as e:
        print("forge-calc: catalogue not loaded yet:", e.message)
    guild = os.environ.get("DISCORD_GUILD_ID")
    if guild:
        tree.copy_global_to(guild=discord.Object(id=int(guild)))
        await tree.sync(guild=discord.Object(id=int(guild)))
    else:
        await tree.sync()


if __name__ == "__main__":
    client.run(os.environ["DISCORD_TOKEN"])
