import real, { StoryStore as RealStore } from "../src/index.js";
// stub AI: returns valid + invalid lines for whichever speakers the prompt allows
export class StoryStore extends RealStore {
  constructor(ctx, env) {
    super(ctx, { ...env, AI: { async run(_m, { messages }) {
      const ids = /Allowed speaker ids: ([^.]*)\./.exec(messages[1].content)[1].split(", ");
      const n = Math.random().toString(36).slice(2, 6);
      return { response: "Here you go:\n```json\n" + JSON.stringify([
        { speaker: ids[0], text: `Stay sharp ${n}, the Foot are close and I don't like it.` },
        { speaker: ids[ids.length - 1], text: `Nobody leaves this place ${n} until we finish the job.` },
        { speaker: ids[0], text: "What the hell was that?" },
        { speaker: "nobody", text: "Wrong speaker here today." },
        { speaker: ids[0], text: "x".repeat(90) },
      ]) + "\n```" };
    } } });
  }
}
export default { async fetch(req, env) {
  const u = new URL(req.url);
  const st = env.STORE.get(env.STORE.idFromName("t"));
  if (u.pathname === "/gen") return Response.json(await st.generate((u.searchParams.get("p") || "").split(",").filter(Boolean), 3));
  if (u.pathname === "/pack") return Response.json(await st.pack(+(u.searchParams.get("since") || 0)));
  return Response.json(await st.stats());
} };
