
import { config } from 'dotenv'
if (process.env.NODE_ENV !== "production") config()
import fetch from 'node-fetch'
import fs from 'fs-extra'
import { run } from "@grammyjs/runner"
import { apiThrottler } from "@grammyjs/transformer-throttler"
import { Bot, type Context, session, InlineKeyboard, InputFile } from 'grammy'
import { type Conversation, type ConversationFlavor, conversations, createConversation, } from "@grammyjs/conversations"
import { customAlphabet } from 'nanoid'
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12)
type MyContext = Context & ConversationFlavor
type MyConversation = Conversation<MyContext>
type Match = {
    _id: string,
    matchID: string,
    teamCount: number,
    type: string,
    team: {
        id: string,
        name: string,
        score: number
    }[],
    start: string,
    bettors: {
        betID: string,
        userID: string,
        name: string,
        matchID: string,
        teamID: string,
        team: number,
        amount: number,
        type: string,
        custom: boolean,
        timestamp: string
    }[],
    end: string,
    isDone: boolean,
    winner: string,
    payout_percent: number,
    comments: any,
    share_link: string,
    created: string,
    __v: any,
    declaredBy: string,
    profit: number
}
//@ts-ignore
const bot = new Bot<MyContext>(process.env.BOT_TOKEN)
const throttler = apiThrottler()
bot.api.config.use(throttler)
bot.use(session({ initial: () => ({}) }))
bot.use(conversations())
async function start(convo: MyConversation, ctx: MyContext) {
    let file_name: string = ""
    try {
        await ctx.reply(`Hi @${ctx.from?.username}, What can I do for you?`, {
            reply_markup: new InlineKeyboard()
                .text("Get Match Winners", "m-winners").row()
                .text("Get Match Losers", "m-losers").row()
                .text("Get Match Bettors", "m-stakers").row()
        })
        const { callbackQuery } = await convo.wait()
        if (callbackQuery?.data === "m-winners") {
            await ctx.reply("Please enter Match ID:")
            const { message } = await convo.wait()
            await ctx.reply("Checking match...")
            const MATCH_DATA: Match = await fetch(`${process.env.API}${message?.text}`).then(res => res.json())
            if (MATCH_DATA) {
                file_name = `${nanoid(5)}-${message?.text}-WINNERS.csv`
                let text = "Userid,Name,Stake Amount\n"
                MATCH_DATA.bettors.map((x) => {
                    if (x.teamID === MATCH_DATA.winner) {
                        text += `${x.userID},${x.name},${x.amount}\n`
                    }
                })
                fs.open(file_name, "a", async (err, fd) => {
                    if (err) {
                        throw new Error(err.message)
                    } else {
                        fs.write(fd, text, async (err, bytes) => {
                            if (err) {
                                await ctx.reply(err.message)
                            } else {
                                //convert to xlsx 
                                await ctx.replyWithDocument(new InputFile(file_name))
                                await fs.unlink(file_name)
                            }
                        })
                    }
                })
            } else {
                await ctx.reply("Match not found")
            }
            return
        } else if (callbackQuery?.data === "m-losers") {
            await ctx.reply("Please enter Match ID:")
            const { message } = await convo.wait()
            await ctx.reply("Checking match...")
            const MATCH_DATA: Match = await fetch(`${process.env.API}${message?.text}`).then(res => res.json())
            if (MATCH_DATA) {
                file_name = `${nanoid(5)}-${message?.text}-LOSERS.csv`
                let text = "Userid,Name,Stake Amount\n"
                MATCH_DATA.bettors.map((x) => {
                    if (x.teamID !== MATCH_DATA.winner) {
                        text += `${x.userID},${x.name},${x.amount}\n`
                    }
                })
                fs.open(file_name, "a", async (err, fd) => {
                    if (err) {
                        throw new Error(err.message)
                    } else {
                        fs.write(fd, text, async (err, bytes) => {
                            if (err) {
                                await ctx.reply(err.message)
                            } else {
                                //convert to xlsx 
                                await ctx.replyWithDocument(new InputFile(file_name))
                                await fs.unlink(file_name)
                            }
                        })
                    }
                })
            } else {
                await ctx.reply("Match not found")
            }
            return
        } else if (callbackQuery?.data === "m-stakers") {
            await ctx.reply("Please enter Match ID:")
            const { message } = await convo.wait()
            await ctx.reply("Checking match...")
            const MATCH_DATA: Match = await fetch(`${process.env.API}${message?.text}`).then(res => res.json())
            if (MATCH_DATA) {
                file_name = `${nanoid(5)}-${message?.text}-STAKERS.csv`
                let text = "Userid,Name,Stake Amount\n"
                MATCH_DATA.bettors.map((x) => {
                    text += `${x.userID},${x.name},${x.amount}\n`
                })
                fs.open(file_name, "a", async (err, fd) => {
                    if (err) {
                        await ctx.reply(err.message)
                    } else {
                        fs.write(fd, text, async (err, bytes) => {
                            if (err) {
                                throw new Error(err.message)
                            } else {
                                //convert to xlsx 
                                await ctx.replyWithDocument(new InputFile(file_name))
                                await fs.unlink(file_name)
                            }
                        })
                    }
                })
            } else {
                await ctx.reply("Match not found")
            }
            return
        } else {
            await ctx.reply("Invalid Reply")
            return
        }
    } catch (e) {
        await fs.unlink(file_name)
        await ctx.reply("An error occured")
        return
    }
}
bot.use(createConversation(start))
bot.command("start", async (ctx) => {
    const USERID = ctx.from?.id.toString()
    //@ts-ignore
    if (process.env.ADMINS?.split(",").includes(USERID)) {
        await ctx.conversation.enter("start")
    } else {
        await ctx.reply("401 Unauthorized")
    }
})
run(bot)
const setup = async () => {
    await bot.api.setMyCommands([
        { command: 'start', description: "Start Bot" }
    ])
}
setup()
console.log("> Bot Started")