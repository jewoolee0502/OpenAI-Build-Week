import { createHash } from "node:crypto";
import { escapeHtmlText } from "./safety.js";

function promptColor(prompt: string): string {
  const hue = Number.parseInt(createHash("sha256").update(prompt).digest("hex").slice(0, 4), 16) % 360;
  return `hsl(${hue} 78% 62%)`;
}

export function createDemoGame(prompt: string, versionNumber = 1): { title: string; html: string } {
  const shortPrompt = prompt.replace(/\s+/g, " ").trim().slice(0, 80);
  const title = shortPrompt.length > 42 ? `${shortPrompt.slice(0, 39)}…` : shortPrompt;
  const color = promptColor(prompt);
  const faster = /fast|faster|speed|快|更快/i.test(prompt);
  const threeLives = /three lives|3 lives|三个生命|三条命/i.test(prompt);
  const safeIdea = escapeHtmlText(shortPrompt);

  return {
    title: title || "My ImagineLab Game",
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtmlText(title || "My ImagineLab Game")}</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:ui-rounded,system-ui,sans-serif;touch-action:none}
    body{background:linear-gradient(145deg,#15122d,#252052);color:white}.game{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden}
    .glow{position:absolute;width:60vmin;height:60vmin;border-radius:50%;background:${color};filter:blur(100px);opacity:.2;left:20%;top:20%}
    header{position:absolute;z-index:3;left:0;right:0;display:flex;align-items:center;gap:12px;padding:18px}.pill{padding:8px 12px;border-radius:999px;background:#ffffff18;border:1px solid #ffffff2b;backdrop-filter:blur(12px);font-weight:800}
    .idea{margin-left:auto;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dcd7ff}.target{position:absolute;width:72px;height:72px;border-radius:24px;background:${color};display:grid;place-items:center;font-size:34px;box-shadow:0 12px 40px color-mix(in srgb,${color} 50%,transparent);user-select:none}
    .player{position:absolute;bottom:24px;width:92px;height:28px;border-radius:20px;background:#fff;box-shadow:0 10px 35px #ffffff55;transform:translateX(-50%)}
    .center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:36px;z-index:4;background:#15122dee;transition:.25s}.card{max-width:430px}.badge{display:inline-grid;place-items:center;width:58px;height:58px;border-radius:20px;background:${color};font-size:27px}.center h1{font-size:clamp(30px,8vw,54px);line-height:.95;margin:18px 0 12px}.center p{color:#cfc8ec;line-height:1.5}.center button{border:0;border-radius:18px;padding:14px 22px;background:#fff;color:#17152b;font:800 17px inherit;cursor:pointer}
    .hidden{opacity:0;pointer-events:none;transform:scale(.97)}
  </style>
</head>
<body>
  <main class="game" id="game">
    <div class="glow"></div>
    <header><span class="pill">Score <b id="score">0</b></span><span class="pill">Lives <b id="lives">${threeLives ? 3 : 5}</b></span><span class="idea">${safeIdea}</span></header>
    <div class="target" id="target">✦</div><div class="player" id="player"></div>
    <section class="center" id="intro"><div class="card"><span class="badge">✦</span><h1>${escapeHtmlText(title || "Catch the Sparks")}</h1><p>Move the bright paddle with your finger or mouse. Catch as many imagination sparks as you can.</p><button id="start">Start playing</button><p>Demo generator · version ${versionNumber}</p></div></section>
  </main>
  <script>
    const game=document.getElementById('game'),target=document.getElementById('target'),player=document.getElementById('player'),scoreEl=document.getElementById('score'),livesEl=document.getElementById('lives'),intro=document.getElementById('intro');
    let score=0,lives=${threeLives ? 3 : 5},x=innerWidth/2,y=120,vx=${faster ? 4.8 : 3.2},vy=${faster ? 5.4 : 3.7},running=false,last=0;
    function placePlayer(clientX){const r=game.getBoundingClientRect();x=Math.max(46,Math.min(r.width-46,clientX-r.left));player.style.left=x+'px'}
    game.addEventListener('pointermove',e=>placePlayer(e.clientX));game.addEventListener('pointerdown',e=>placePlayer(e.clientX));
    document.getElementById('start').addEventListener('click',()=>{running=true;intro.classList.add('hidden');requestAnimationFrame(loop)});
    function reset(){const r=game.getBoundingClientRect();target.style.left=Math.max(0,Math.random()*(r.width-72))+'px';target.style.top='82px';y=82;vy=Math.abs(vy)}
    function loop(t){if(!running)return;const dt=Math.min(2,(t-last)/16.67||1);last=t;const r=game.getBoundingClientRect();let tx=parseFloat(target.style.left)||r.width/2;y+=vy*dt;tx+=vx*dt;if(tx<0||tx>r.width-72){vx*=-1;tx=Math.max(0,Math.min(r.width-72,tx))}target.style.left=tx+'px';target.style.top=y+'px';
      const tr=target.getBoundingClientRect(),pr=player.getBoundingClientRect();if(tr.bottom>=pr.top&&tr.right>pr.left&&tr.left<pr.right&&vy>0){score++;scoreEl.textContent=score;vy=-Math.abs(vy)*1.035;y=pr.top-r.top-74}
      if(y>r.height){lives--;livesEl.textContent=lives;if(lives<=0){running=false;intro.querySelector('h1').textContent='You caught '+score+' sparks!';intro.querySelector('p').textContent='Every try is a new experiment. Change the game and play again.';intro.querySelector('button').textContent='Play again';intro.classList.remove('hidden');score=0;lives=${threeLives ? 3 : 5};scoreEl.textContent=0;livesEl.textContent=lives}else reset()}
      requestAnimationFrame(loop)}
    reset();placePlayer(innerWidth/2);addEventListener('resize',()=>placePlayer(innerWidth/2));
  </script>
</body>
</html>`,
  };
}
