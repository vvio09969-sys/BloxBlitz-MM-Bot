import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  AttachmentBuilder,
  Events,
  type TextChannel,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Message,
  type GuildMember,
} from "discord.js";
import { logger } from "./lib/logger";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomInt } from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────
const GREEN = 0x1c651b;
const ORANGE = 0xe67e22;
const TRANSCRIPT_CHANNEL_ID = "1368644306533093467";
const TICKETS_CATEGORY_ID = "1464542591013097482";
const FLIP_DELAY_MS = 5000;
const COMMAND_COOLDOWN_MS = 5000;

// ─── Singleton client ─────────────────────────────────────────────────────────
// Keeping one client instance at module level prevents duplicate event handlers
// when the server hot-reloads. On each startBot() call the old client is
// destroyed before a new one is created, so only one client is ever active.
let activeClient: Client | null = null;
let botStartTime: number | null = null;
let isStarting = false;

export function getBotClient(): Client | null {
  return activeClient;
}

export function getBotUptime(): number | null {
  return botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : null;
}

export function getCoinflipSessionCount(): number {
  return coinflipSessions.size;
}

export function getTicketCounter(): number {
  return readCounter();
}

// ─── Ticket counter ───────────────────────────────────────────────────────────
function dataPath(): string {
  return join(process.cwd(), "data", "ticket-counter.json");
}

function readCounter(): number {
  const f = dataPath();
  if (!existsSync(f)) return 3667;
  try {
    return (JSON.parse(readFileSync(f, "utf8")) as { counter: number }).counter ?? 3667;
  } catch {
    return 3667;
  }
}

function useAndIncrementCounter(): number {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const n = readCounter();
  writeFileSync(dataPath(), JSON.stringify({ counter: n + 1 }));
  return n;
}

// ─── Coinflip state ───────────────────────────────────────────────────────────
interface PlayerChoice {
  userId: string;
  displayName: string;
  avatarUrl: string;
  side: "heads" | "tails";
}

interface CoinflipSession {
  mmId: string;
  players: PlayerChoice[];
  ft: number;
  scores: Record<string, number>;
  state: "picking_sides" | "mm_picking_ft" | "ready_check" | "flipping" | "done";
  readyPlayers: Set<string>;
  channelId: string;
  timeout?: NodeJS.Timeout;
}

const coinflipSessions = new Map<string, CoinflipSession>();
const coinflipCooldowns = new Map<string, number>();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STAFF_ROLE_IDS = [
  "1468393771837296740",
  "1468393768330858680",
  "1468393773410029639",
  "1464306691368550517",
  "1400871936862453933",
];

function isStaff(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    STAFF_ROLE_IDS.some((id) => member.roles.cache.has(id))
  );
}

// ─── Ticket spam guard ────────────────────────────────────────────────────────
const creatingTickets = new Set<string>();

function buildSidesRow(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("cf_heads")
      .setLabel("🪙 Heads")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("cf_tails")
      .setLabel("🎭 Tails")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

function buildSidesRowLocked(takenSide: "heads" | "tails"): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("cf_heads")
      .setLabel("🪙 Heads")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(takenSide === "heads"),
    new ButtonBuilder()
      .setCustomId("cf_tails")
      .setLabel("🎭 Tails")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(takenSide === "tails"),
  );
}

function buildFtRow(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cf_ft:1:${channelId}`)
      .setLabel("First to 1 Win")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cf_ft:3:${channelId}`)
      .setLabel("First to 3 Wins")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cf_ft:5:${channelId}`)
      .setLabel("First to 5 Wins")
      .setStyle(ButtonStyle.Primary),
  );
}

function buildReadyRow(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("cf_ready")
      .setLabel("✅ Ready to Flip")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
  );
}

// ─── Coinflip: start ──────────────────────────────────────────────────────────
async function handleCoinflipCommand(message: Message): Promise<void> {
  if (!isStaff(message.member)) return;

  const channel = message.channel as TextChannel;
  if (!channel.name?.startsWith("ticket-")) {
    const msg = await message.reply("Coinflip can only be started inside a ticket channel.");
    setTimeout(() => msg.delete().catch(() => {}), 4000);
    return;
  }

  const channelId = message.channel.id;

  const lastUse = coinflipCooldowns.get(channelId) ?? 0;
  const now = Date.now();
  if (now - lastUse < COMMAND_COOLDOWN_MS) {
    const secs = Math.ceil((COMMAND_COOLDOWN_MS - (now - lastUse)) / 1000);
    const msg = await message.reply(`Please wait **${secs}** more second(s) before starting a new coinflip.`);
    setTimeout(() => msg.delete().catch(() => {}), 4000);
    return;
  }

  if (coinflipSessions.has(channelId)) {
    await message.reply("A coinflip is already in progress in this channel.");
    return;
  }

  coinflipCooldowns.set(channelId, now);
  setTimeout(() => coinflipCooldowns.delete(channelId), COMMAND_COOLDOWN_MS + 1000);

  const SESSION_EXPIRY_MS = 15 * 60 * 1000;
  const session: CoinflipSession = {
    mmId: message.author.id,
    players: [],
    ft: 1,
    scores: {},
    state: "picking_sides",
    readyPlayers: new Set(),
    channelId,
  };
  session.timeout = setTimeout(() => {
    if (coinflipSessions.get(channelId) === session) {
      coinflipSessions.delete(channelId);
    }
  }, SESSION_EXPIRY_MS);
  coinflipSessions.set(channelId, session);

  await message.delete().catch((err) => { logger.error({ err }, "Failed to delete message"); });

  const embed = new EmbedBuilder()
    .setTitle("🪙 Coinflip — Choose Your Side!")
    .setDescription(
      `A coinflip has been initiated by <@${message.author.id}>!\n\n` +
        "Both players, select your side below.\n\n" +
        "**🪙 Heads** or **🎭 Tails?**",
    )
    .setColor(GREEN)
    .setFooter({ text: "Waiting for 2 players to choose sides..." })
    .setTimestamp();

  await (message.channel as TextChannel).send({
    embeds: [embed],
    components: [buildSidesRow()],
  });
}

// ─── Coinflip: side selection ─────────────────────────────────────────────────
async function handleSideSelection(
  interaction: ButtonInteraction,
  side: "heads" | "tails",
): Promise<void> {
  const channelId = interaction.channelId;
  const session = coinflipSessions.get(channelId);

  if (!session || session.state !== "picking_sides") {
    await interaction.reply({ content: "No active coinflip awaiting side selection.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (session.players.find((p) => p.userId === interaction.user.id)) {
    await interaction.reply({ content: "You have already chosen your side!", flags: MessageFlags.Ephemeral });
    return;
  }

  if (session.players.length >= 2) {
    await interaction.reply({ content: "Both players have already chosen their sides.", flags: MessageFlags.Ephemeral });
    return;
  }

  const alreadyTaken = session.players.some((p) => p.side === side);
  if (alreadyTaken) {
    await interaction.reply({ content: "That side has already been chosen.", flags: MessageFlags.Ephemeral });
    return;
  }

  const member = interaction.member as GuildMember;
  session.players.push({
    userId: interaction.user.id,
    displayName: member?.displayName ?? interaction.user.username,
    avatarUrl: interaction.user.displayAvatarURL({ size: 256 }),
    side,
  });
  session.scores[interaction.user.id] = 0;

  await interaction.reply({
    content: `<@${interaction.user.id}> chose **${side === "heads" ? "🪙 Heads" : "🎭 Tails"}**!`,
  });

  // After first pick — lock that button so only the remaining side is clickable
  if (session.players.length === 1) {
    await interaction.message.edit({ components: [buildSidesRowLocked(side)] }).catch(() => {});
  }

  if (session.players.length === 2) {
    session.state = "mm_picking_ft";

    const p1 = session.players[0]!;
    const p2 = session.players[1]!;

    const sidesEmbed = new EmbedBuilder()
      .setTitle("🪙 Both Sides Chosen!")
      .setDescription(
        `<@${p1.userId}> → **${p1.side === "heads" ? "🪙 Heads" : "🎭 Tails"}**\n` +
          `<@${p2.userId}> → **${p2.side === "heads" ? "🪙 Heads" : "🎭 Tails"}**\n\n` +
          "⏳ **The MM is selecting the match format in their DMs. Please be patient...**",
      )
      .setColor(GREEN)
      .setTimestamp();

    await interaction.message.edit({ embeds: [sidesEmbed], components: [] });

    const ticketChannelId = interaction.channelId;
    const ftEmbed = new EmbedBuilder()
      .setTitle("🎮 Select Match Format")
      .setDescription(
        `**Ticket:** <#${ticketChannelId}>\n\n` +
          `<@${p1.userId}> → ${p1.side === "heads" ? "🪙 Heads" : "🎭 Tails"}\n` +
          `<@${p2.userId}> → ${p2.side === "heads" ? "🪙 Heads" : "🎭 Tails"}\n\n` +
          "Choose the match format:",
      )
      .setColor(GREEN);

    try {
      const mm = await interaction.guild!.members.fetch(session.mmId);
      await mm.send({ embeds: [ftEmbed], components: [buildFtRow(ticketChannelId)] });
    } catch {
      await (interaction.channel as TextChannel).send({
        content: `<@${session.mmId}>, your DMs are closed. Select the format here:`,
        embeds: [ftEmbed],
        components: [buildFtRow(ticketChannelId)],
      });
    }
  }
}

// ─── Coinflip: FT selection ───────────────────────────────────────────────────
async function handleFtSelection(
  interaction: ButtonInteraction,
  ft: number,
  ticketChannelId: string,
): Promise<void> {
  const session = coinflipSessions.get(ticketChannelId);
  if (!session || session.state !== "mm_picking_ft") {
    await interaction.reply({ content: "No coinflip waiting for format selection.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.user.id !== session.mmId) {
    await interaction.reply({ content: "Only the MM can select the match format.", flags: MessageFlags.Ephemeral });
    return;
  }

  session.ft = ft;
  session.state = "ready_check";
  session.readyPlayers.clear();

  try {
    await interaction.update({ components: [] });
  } catch (err) {
    logger.error({ err }, "Failed to update FT interaction");
  }

  const ticketChannel = interaction.client.channels.cache.get(ticketChannelId) as
    | TextChannel
    | undefined;
  if (!ticketChannel) return;

  if (session.players.length < 2) return;
  const [p1, p2] = session.players as [PlayerChoice, PlayerChoice];

  const formatEmbed = new EmbedBuilder()
    .setTitle(`🎮 Format Selected: First to ${ft} Win${ft > 1 ? "s" : ""}!`)
    .setDescription(
      `The MM has chosen **First to ${ft} win${ft > 1 ? "s" : ""}**.\n\n` +
        `<@${p1.userId}> → **${p1.side === "heads" ? "🪙 Heads" : "🎭 Tails"}**\n` +
        `<@${p2.userId}> → **${p2.side === "heads" ? "🪙 Heads" : "🎭 Tails"}**`,
    )
    .setColor(GREEN)
    .setTimestamp();

  await ticketChannel.send({ embeds: [formatEmbed] });

  const readyEmbed = new EmbedBuilder()
    .setTitle("✅ Ready Check")
    .setDescription(
      `<@${p1.userId}> and <@${p2.userId}>, click **Ready to Flip** when you are prepared.\n\n` +
        "Flips will **not** start until both players are ready.",
    )
    .setColor(GREEN)
    .setTimestamp();

  await ticketChannel.send({
    embeds: [readyEmbed],
    components: [buildReadyRow()],
  });
}

// ─── Coinflip: ready check ────────────────────────────────────────────────────
async function handleReadyButton(interaction: ButtonInteraction): Promise<void> {
  const session = coinflipSessions.get(interaction.channelId);
  if (!session || session.state !== "ready_check") {
    await interaction.reply({ content: "No coinflip waiting for ready confirmation.", flags: MessageFlags.Ephemeral });
    return;
  }

  const isPlayer = session.players.find((p) => p.userId === interaction.user.id);
  if (!isPlayer) {
    await interaction.reply({ content: "Only the players in this coinflip can click Ready.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (session.readyPlayers.has(interaction.user.id)) {
    await interaction.reply({ content: "You are already marked as ready!", flags: MessageFlags.Ephemeral });
    return;
  }

  session.readyPlayers.add(interaction.user.id);
  const other = session.players.find((p) => p.userId !== interaction.user.id);
  if (!other) return;
  const bothReady = session.readyPlayers.has(other.userId);

  if (!bothReady) {
    await interaction.reply({
      content: `<@${interaction.user.id}> is ready to flip! ✅ Waiting for <@${other.userId}>...`,
    });
    return;
  }

  await interaction.reply({
    content: `<@${interaction.user.id}> is ready to flip! ✅ **Both players are ready — let's go!** 🪙`,
  });

  try {
    await interaction.message.edit({ components: [buildReadyRow(true)] });
  } catch {}

  if (session.timeout) clearTimeout(session.timeout);
  session.timeout = undefined;
  session.state = "flipping";
  setTimeout(() => runFlipLoop(interaction.channel as TextChannel, session), 1500);
}

// ─── Coinflip: flip loop ──────────────────────────────────────────────────────
async function runFlipLoop(channel: TextChannel, session: CoinflipSession): Promise<void> {
  if (session.state !== "flipping") return;

  const result = randomInt(0, 2) === 0 ? "heads" : "tails";
  const emoji = result === "heads" ? "🪙" : "🎭";
  const flipWinner = session.players.find((p) => p.side === result);

  if (flipWinner) {
    session.scores[flipWinner.userId] = (session.scores[flipWinner.userId] ?? 0) + 1;
  }

  const p1 = session.players[0]!;
  const p2 = session.players[1]!;
  const s1 = session.scores[p1.userId] ?? 0;
  const s2 = session.scores[p2.userId] ?? 0;

  const flipEmbed = new EmbedBuilder()
    .setTitle(`${emoji} **${result.toUpperCase()}!**`)
    .setDescription(
      `${flipWinner ? `<@${flipWinner.userId}> wins this flip!` : "No winner this flip."}\n\n` +
        `**Scoreboard:**\n` +
        `<@${p1.userId}> (${p1.side === "heads" ? "🪙 Heads" : "🎭 Tails"}) — **${s1}** win${s1 !== 1 ? "s" : ""}\n` +
        `<@${p2.userId}> (${p2.side === "heads" ? "🪙 Heads" : "🎭 Tails"}) — **${s2}** win${s2 !== 1 ? "s" : ""}`,
    )
    .setColor(GREEN)
    .setTimestamp();

  try {
    await channel.send({ embeds: [flipEmbed] });
  } catch {
    session.state = "done";
    coinflipSessions.delete(session.channelId);
    return;
  }

  const gameWinner = session.players.find((p) => (session.scores[p.userId] ?? 0) >= session.ft);
  if (gameWinner) {
    session.state = "done";
    coinflipSessions.delete(session.channelId);

    await new Promise((r) => setTimeout(r, 1500));

    const winnerEmbed = new EmbedBuilder()
      .setTitle(`🏆 ${gameWinner.displayName.toUpperCase()} IS THE WINNER!`)
      .setDescription(
        `Congratulations to <@${gameWinner.userId}>!\n\n` +
          `**Final Score:**\n` +
          `<@${p1.userId}> — **${session.scores[p1.userId] ?? 0}** win${(session.scores[p1.userId] ?? 0) !== 1 ? "s" : ""}\n` +
          `<@${p2.userId}> — **${session.scores[p2.userId] ?? 0}** win${(session.scores[p2.userId] ?? 0) !== 1 ? "s" : ""}`,
      )
      .setThumbnail(gameWinner.avatarUrl)
      .setColor(GREEN)
      .setTimestamp();

    await channel.send({ embeds: [winnerEmbed] });
    return;
  }

  session.timeout = setTimeout(() => runFlipLoop(channel, session), FLIP_DELAY_MS);
}

// ─── !bbv ─────────────────────────────────────────────────────────────────────
async function handleBbv(message: Message): Promise<void> {
  if (!isStaff(message.member)) return;

  const embed = new EmbedBuilder()
    .setTitle("⭐ Vouch Reminder")
    .setDescription(
      "This trade has been successfully completed with the assistance of a **Middleman**.\n\n" +
        "Please take a moment to leave a vouch for your MM within **1 hour**.\n\n" +
        "> Vouching helps maintain our trusted Middleman reputation system and is greatly appreciated by the community.\n\n" +
        "⚠️ Failure to vouch within the time limit may result in a **warning**.",
    )
    .setColor(ORANGE)
    .setFooter({ text: "Thank you for using our MM service!" })
    .setTimestamp();

  await (message.channel as TextChannel).send({ embeds: [embed] });
  await message.delete().catch((err) => { logger.error({ err }, "Failed to delete message"); });
}

// ─── Transcript helper ────────────────────────────────────────────────────────
async function fetchAllMessages(channel: TextChannel): Promise<Message[]> {
  const messages: Message[] = [];
  let lastId: string | undefined;

  const MAX_MESSAGES = 3000;
  while (messages.length < MAX_MESSAGES) {
    const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
    if (fetched.size === 0) break;
    messages.push(...fetched.values());
    lastId = fetched.last()?.id;
    if (fetched.size < 100) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

// ─── !tc ──────────────────────────────────────────────────────────────────────
async function handleTc(message: Message): Promise<void> {
  const channel = message.channel as TextChannel;
  if (!channel.name.startsWith("ticket-")) return;

  const isOwner = channel.topic?.startsWith(`owner:${message.author.id}`);
  if (!isStaff(message.member) && !isOwner) {
    await message.reply({ content: "Only the ticket owner or staff can close this ticket." });
    return;
  }

  const sorted = await fetchAllMessages(channel);

  const lines = sorted.map((m) => {
    const time = new Date(m.createdTimestamp).toISOString();
    const parts: string[] = [];
    if (m.content) parts.push(m.content);
    for (const embed of m.embeds) {
      parts.push(`[Embed: ${embed.title ?? "untitled"}${embed.description ? ` — ${embed.description.slice(0, 80)}` : ""}]`);
    }
    if (m.attachments.size > 0) parts.push(`[Attachments: ${m.attachments.map((a) => a.url).join(", ")}]`);
    if (m.stickers.size > 0) parts.push(`[Stickers: ${m.stickers.map((s) => s.name).join(", ")}]`);
    const content = parts.length > 0 ? parts.join(" | ") : "[no content]";
    return `[${time}] ${m.author.username}: ${content}`;
  });

  const transcriptCh = message.guild?.channels.cache.get(TRANSCRIPT_CHANNEL_ID) as
    | TextChannel
    | undefined;

  if (transcriptCh) {
    const buf = Buffer.from(lines.join("\n"), "utf8");
    const file = new AttachmentBuilder(buf, { name: `${channel.name}-transcript.txt` });
    const tEmbed = new EmbedBuilder()
      .setTitle(`📋 Transcript — ${channel.name}`)
      .setDescription(`Closed by **${message.author.username}**`)
      .setColor(GREEN)
      .setTimestamp();
    await transcriptCh.send({ embeds: [tEmbed], files: [file] });
  }

  const closeEmbed = new EmbedBuilder()
    .setTitle("🔒 Ticket Closing")
    .setDescription(
      "This ticket is being closed. Transcript has been saved to the logs channel.\nChannel will be deleted in **5 seconds**.",
    )
    .setColor(GREEN)
    .setTimestamp();

  await (message.channel as TextChannel).send({ embeds: [closeEmbed] });
  await message.delete().catch((err) => { logger.error({ err }, "Failed to delete message"); });

  setTimeout(async () => {
    await channel.delete("Ticket closed via !tc").catch(() => {});
  }, 5000);
}

// ─── /panel ───────────────────────────────────────────────────────────────────
async function handlePanel(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  if (channel?.name?.startsWith("ticket-")) {
    await interaction.reply({
      content: "⚠️ The panel cannot be posted inside a ticket channel. Use it in a public channel instead.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("MM TICKETS")
    .setDescription(
      "🎫 Middleman Ticket Panel\n\n" +
        "Need a trusted middleman for your deal?\n" +
        "Open a ticket and provide the following information clearly:\n\n" +
        "⚠️ Do not ping staff repeatedly.\n" +
        "⚠️ Scamming, fake proofs, or wasting MM time may result in punishment.\n" +
        "⚠️ Both parties must confirm the deal before the MM proceeds.\n\n" +
        "Click the button below to create a ticket.",
    )
    .setColor(GREEN);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("Open Ticket")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🎫"),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

// ─── /add ─────────────────────────────────────────────────────────────────────
async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isStaff(interaction.member as GuildMember)) {
    await interaction.reply({ content: "You do not have permission to use this command.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = interaction.channel as TextChannel;
  if (!channel.name.startsWith("ticket-")) {
    await interaction.reply({ content: "This command can only be used inside a ticket channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const target = interaction.options.getUser("user", true);

  await channel.permissionOverwrites.edit(target.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });

  const embed = new EmbedBuilder()
    .setTitle("✅ User Added to Ticket")
    .setDescription(`<@${target.id}> has been added to this ticket.`)
    .setColor(GREEN)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ─── /remove ──────────────────────────────────────────────────────────────────
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isStaff(interaction.member as GuildMember)) {
    await interaction.reply({ content: "You do not have permission to use this command.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = interaction.channel as TextChannel;
  if (!channel.name.startsWith("ticket-")) {
    await interaction.reply({ content: "This command can only be used inside a ticket channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const target = interaction.options.getUser("user", true);

  const owner = channel.topic?.match(/^owner:(\d+)/)?.[1];
  if (owner && target.id === owner) {
    await interaction.reply({ content: "You cannot remove the ticket owner.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (target.id === interaction.client.user?.id) {
    await interaction.reply({ content: "You cannot remove the bot from this channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  await channel.permissionOverwrites.delete(target.id).catch((err) => {
    logger.error({ err }, "Failed to delete permission overwrite for /remove");
  });

  const embed = new EmbedBuilder()
    .setTitle("🚫 User Removed from Ticket")
    .setDescription(`<@${target.id}> has been removed from this ticket by <@${interaction.user.id}>.`)
    .setColor(0xed4245)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  const transcriptCh = interaction.guild?.channels.cache.get(TRANSCRIPT_CHANNEL_ID) as TextChannel | undefined;
  if (transcriptCh) {
    const logEmbed = new EmbedBuilder()
      .setTitle("🚫 User Removed")
      .addFields(
        { name: "Channel", value: `<#${channel.id}> (${channel.name})`, inline: true },
        { name: "Removed User", value: `<@${target.id}> (${target.username})`, inline: true },
        { name: "By", value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
      )
      .setColor(0xed4245)
      .setTimestamp();
    await transcriptCh.send({ embeds: [logEmbed] }).catch((err) => {
      logger.error({ err }, "Failed to log /remove to transcript channel");
    });
  }
}

// ─── Open ticket button ───────────────────────────────────────────────────────
async function handleOpenTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This button can only be used inside a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (creatingTickets.has(interaction.user.id)) {
    const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_ticket_creation")
        .setLabel("Cancel & Start Over")
        .setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({
      content: "You are already creating a ticket. Click below to cancel and start fresh.",
      flags: MessageFlags.Ephemeral,
      components: [cancelRow],
    });
    return;
  }

  creatingTickets.add(interaction.user.id);
  // Auto-release after 10 min in case user dismisses the modal without submitting
  setTimeout(() => creatingTickets.delete(interaction.user.id), 10 * 60 * 1000);

  const guild = interaction.guild;

  const existing = guild.channels.cache.find(
    (c) =>
      c.parentId === TICKETS_CATEGORY_ID &&
      c.type === ChannelType.GuildText &&
      (c as TextChannel).topic?.startsWith(`owner:${interaction.user.id}`),
  );

  if (existing) {
    creatingTickets.delete(interaction.user.id);
    await interaction.reply({
      content: `You already have an open ticket: <#${existing.id}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("ticket_form")
    .setTitle("Open a MM Ticket");

  const purposeInput = new TextInputBuilder()
    .setCustomId("ticket_purpose")
    .setLabel("What's this ticket for?")
    .setPlaceholder("cross-trade or coinflip")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  const givingInput = new TextInputBuilder()
    .setCustomId("you_giving")
    .setLabel("What are you giving?")
    .setPlaceholder("e.g. Huge Cat")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const receivingInput = new TextInputBuilder()
    .setCustomId("opponent_giving")
    .setLabel("What is your opponent giving?")
    .setPlaceholder("e.g. 10 Diamonds")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const opponentInput = new TextInputBuilder()
    .setCustomId("opponent_user")
    .setLabel("Your opponent's username")
    .setPlaceholder("e.g. Username#0000")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(purposeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(givingInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(receivingInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(opponentInput),
  );

  await interaction.showModal(modal);
}

// ─── Ticket form submit ───────────────────────────────────────────────────────
async function handleTicketFormSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guild = interaction.guild!;

    // Second duplicate check — catches races that slipped past the modal guard
    const alreadyExists = guild.channels.cache.find(
      (c) =>
        c.parentId === TICKETS_CATEGORY_ID &&
        c.type === ChannelType.GuildText &&
        (c as TextChannel).topic?.startsWith(`owner:${interaction.user.id}`),
    );
    if (alreadyExists) {
      await interaction.editReply(`You already have an open ticket: <#${alreadyExists.id}>`);
      return;
    }

    const botMember = guild.members.me;
    if (!botMember) {
      await interaction.editReply("Bot member not available — please try again.");
      return;
    }

    const ticketNumber = useAndIncrementCounter();
    const channelName = `ticket-${ticketNumber}`;

    const purpose = interaction.fields.getTextInputValue("ticket_purpose");
    const giving = interaction.fields.getTextInputValue("you_giving");
    const opponentGiving = interaction.fields.getTextInputValue("opponent_giving");
    const opponent = interaction.fields.getTextInputValue("opponent_user");

    let channel;
    try {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKETS_CATEGORY_ID,
        topic: `owner:${interaction.user.id}`,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: botMember.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to create ticket channel");
      await interaction.editReply("Failed to create ticket. Please contact staff.");
      return;
    }

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 Ticket #${ticketNumber}`)
      .setDescription(
        `Welcome <@${interaction.user.id}>! A **middleman** will assist you shortly.\n\n` +
          "Use `!tc` to close this ticket when your deal is complete.",
      )
      .addFields(
        { name: "🎯 Ticket Purpose", value: purpose, inline: true },
        { name: "👤 Opponent", value: opponent, inline: true },
        { name: "✅ You Are Giving", value: giving, inline: true },
        { name: "❌ Opponent Is Giving", value: opponentGiving, inline: true },
      )
      .setColor(GREEN)
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
    await interaction.editReply(`Your ticket has been created: <#${channel.id}>`);
  } finally {
    creatingTickets.delete(interaction.user.id);
  }
}

// ─── !cancel ──────────────────────────────────────────────────────────────────
async function handleCancelCommand(message: Message): Promise<void> {
  if (!isStaff(message.member)) return;

  const channelId = message.channel.id;
  const session = coinflipSessions.get(channelId);

  if (!session) {
    const msg = await message.reply("There is no active coinflip in this channel.");
    setTimeout(() => msg.delete().catch(() => {}), 4000);
    return;
  }

  if (message.author.id !== session.mmId) {
    const msg = await message.reply("Only the MM who started this coinflip can cancel it.");
    setTimeout(() => msg.delete().catch(() => {}), 4000);
    return;
  }

  if (session.state === "flipping") {
    const msg = await message.reply("Cannot cancel a flip that is already in progress.");
    setTimeout(() => msg.delete().catch(() => {}), 4000);
    return;
  }

  session.state = "done";
  if (session.timeout) clearTimeout(session.timeout);
  coinflipSessions.delete(channelId);

  const embed = new EmbedBuilder()
    .setTitle("❌ Coinflip Cancelled")
    .setDescription("The coinflip has been cancelled by the MM.")
    .setColor(0xed4245)
    .setTimestamp();

  await message.delete().catch((err) => { logger.error({ err }, "Failed to delete message"); });
  await (message.channel as TextChannel).send({ embeds: [embed] });
}

// ─── Slash command registration ───────────────────────────────────────────────
async function registerCommands(token: string, clientId: string): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Send the MM Tickets panel to this channel")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("add")
      .setDescription("Add a user to this ticket")
      .addUserOption((o) =>
        o.setName("user").setDescription("The user to add to this ticket").setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("remove")
      .setDescription("Remove a user from this ticket")
      .addUserOption((o) =>
        o.setName("user").setDescription("The user to remove from this ticket").setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info("Slash commands registered globally");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}

// ─── Bot startup ──────────────────────────────────────────────────────────────
// The singleton guard is the fix for duplicate embeds on reconnect / hot-reload.
// When the server restarts, Node re-executes this module, calling startBot() again.
// Without the guard, a second Client is created and both clients attach handlers —
// so every message triggers two (or more) responses. Destroying the old client
// first ensures exactly one client is ever active at a time.
export async function startBot(): Promise<void> {
  if (isStarting) {
    logger.warn("Bot is already starting");
    return;
  }

  isStarting = true;

  try {
    const token = process.env["Bot_token"];
    const clientId = process.env["Client_id"];

    if (!token || !clientId) {
      logger.warn("Bot_token or Client_id not set — bot will not start");
      return;
    }

    // Clear all in-memory state so stale sessions/timers don't survive hot-reload
    for (const session of coinflipSessions.values()) {
      if (session.timeout) clearTimeout(session.timeout);
    }
    coinflipSessions.clear();
    coinflipCooldowns.clear();
    creatingTickets.clear();

    // Tear down the previous client before creating a new one
    if (activeClient) {
      logger.info("Destroying previous Discord client before restart");
      activeClient.removeAllListeners();
      try {
        activeClient.destroy();
      } catch (err) {
        logger.error({ err }, "Failed to destroy previous client");
      }
      activeClient = null;
      // Brief pause so Discord's WS has time to fully close before re-connecting
      await new Promise((r) => setTimeout(r, 2000));
    }

    await registerCommands(token, clientId);

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });

    // Guard against stacked listeners if the module is ever re-evaluated
    client.removeAllListeners();

    // Store reference before attaching handlers so it's always set
    activeClient = client;

    // Dedup set — prevents Discord ACK retries from processing an interaction twice
    const handledInteractions = new Set<string>();

    client.once(Events.ClientReady, () => {
      botStartTime = Date.now();
      logger.info({ tag: client.user?.tag }, "Discord bot is online");
    });

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || !message.guild) return;
      logger.info({ pid: process.pid, content: message.content, author: message.author.tag }, "Message received");
      const cmd = message.content.trim().split(/\s+/)[0]?.toLowerCase();
      if (cmd === "!bbv") await handleBbv(message).catch((e) => logger.error({ e }, "!bbv error"));
      else if (cmd === "!tc") await handleTc(message).catch((e) => logger.error({ e }, "!tc error"));
      else if (cmd === "!coinflip")
        await handleCoinflipCommand(message).catch((e) => logger.error({ e }, "!coinflip error"));
      else if (cmd === "!cancel")
        await handleCancelCommand(message).catch((e) => logger.error({ e }, "!cancel error"));
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      // Deduplicate — Discord can retry interactions on slow response / WS reconnect
      if (handledInteractions.has(interaction.id)) return;
      handledInteractions.add(interaction.id);
      setTimeout(() => handledInteractions.delete(interaction.id), 60_000);

      try {
        if (interaction.isChatInputCommand()) {
          if (interaction.commandName === "panel") await handlePanel(interaction);
          else if (interaction.commandName === "add") await handleAdd(interaction);
          else if (interaction.commandName === "remove") await handleRemove(interaction);
        } else if (interaction.isButton()) {
          const id = interaction.customId;
          if (id === "cancel_ticket_creation") {
            creatingTickets.delete(interaction.user.id);
            await interaction.update({ content: "Cancelled. Click **Open Ticket** again to start fresh.", components: [] });
          } else if (id === "open_ticket") await handleOpenTicket(interaction);
          else if (id === "cf_heads") await handleSideSelection(interaction, "heads");
          else if (id === "cf_tails") await handleSideSelection(interaction, "tails");
          else if (id.startsWith("cf_ft:")) {
            const parts = id.split(":");
            const ft = parseInt(parts[1] ?? "1", 10);
            const ticketChannelId = parts[2] ?? "";
            await handleFtSelection(interaction, ft, ticketChannelId);
          } else if (id === "cf_ready") await handleReadyButton(interaction);
        } else if (interaction.isModalSubmit()) {
          if (interaction.customId === "ticket_form") await handleTicketFormSubmit(interaction);
        }
      } catch (err) {
        logger.error({ err }, "Interaction error");
      }
    });

    client.on("error", (err) => logger.error({ err }, "Discord client error"));

    client.on(Events.ChannelDelete, (channel) => {
      const session = coinflipSessions.get(channel.id);
      if (session) {
        if (session.timeout) clearTimeout(session.timeout);
        coinflipSessions.delete(channel.id);
      }
    });

    await client.login(token);
  } finally {
    isStarting = false;
  }
}
