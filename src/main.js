import kaplay from "kaplay";
import "kaplay/global";

// ─── INICIALIZAÇÃO ───
const k = kaplay({
    width: 400,
    height: 700,
    background: "#0a0a1a",
    letterbox: true,
    touchToMouse: false,
});

// ─── ESTADO ───
let score = 0;
let highScore = 0;
let gameRunning = false;
let gameOverFlag = false;
let spawnTimer = 0;
let difficulty = 1;
let touchPos = null;

// ─── FUNDO ESTRELADO ───
for (let i = 0; i < 60; i++) {
    const s = k.rand(1, 3);
    k.add([
        k.rect(s, s),
        k.pos(k.rand(0, k.width()), k.rand(0, k.height())),
        k.color(k.rgb(255, 255, 255, k.rand(0.1, 0.4))),
        k.z(0),
        "star",
        { speed: k.rand(0.2, 0.8) },
    ]);
}

// ─── HELPER: desenhar triângulo ───
function drawTriangle(pos, size, col, opacity = 1) {
    k.drawPolygon({
        pts: [
            k.vec2(pos.x, pos.y - size),
            k.vec2(pos.x - size * 0.85, pos.y + size * 0.65),
            k.vec2(pos.x + size * 0.85, pos.y + size * 0.65),
        ],
        color: col,
        opacity,
    });
}

// ─── CRIAR JOGADOR ───
function createPlayer() {
    const p = k.add([
        k.rect(1, 1),
        k.pos(k.width() / 2, k.height() - 80),
        k.area({ shape: new k.Polygon([k.vec2(0, -18), k.vec2(-14, 14), k.vec2(14, 14)]) }),
        k.z(10),
        "player",
        { speed: 280 },
    ]);

    p.onDraw(() => {
        // Glow
        drawTriangle(p.pos, 22, k.rgb(80, 180, 255, 0.2));
        // Triângulo principal
        drawTriangle(p.pos, 18, k.rgb(80, 180, 255));
        // Triângulo interno (detalhe)
        drawTriangle(p.pos, 8, k.rgb(140, 210, 255));
    });

    return p;
}

// ─── SPAWN OBSTÁCULO (círculo) ───
function spawnObstacle() {
    const size = k.rand(16, 32);
    const speed = k.rand(80, 150) + difficulty * 15;

    const obs = k.add([
        k.rect(1, 1),
        k.pos(k.rand(size, k.width() - size), -size),
        k.area({ shape: new k.Circle(k.vec2(0, 0), size) }),
        k.z(5),
        "obstacle",
        { size, speed, t: k.rand(0, 6) },
    ]);

    obs.onDraw(() => {
        const s = obs.size;
        // Sombra
        k.drawCircle(k.vec2(0, 0), s + 4, k.rgb(200, 40, 40, 0.2));
        // Círculo principal
        k.drawCircle(k.vec2(0, 0), s, k.rgb(255, 80, 80));
        // Círculo interno
        k.drawCircle(k.vec2(0, 0), s * 0.5, k.rgb(200, 40, 40));
    });

    obs.onUpdate(() => {
        obs.move(0, obs.speed * k.dt());
        obs.t += k.dt();
        if (obs.pos.y > k.height() + obs.size) k.destroy(obs);
    });

    return obs;
}

// ─── SPAWN COLETÁVEL (quadrado) ───
function spawnCollectible() {
    const size = k.rand(10, 14);
    const x = k.rand(size, k.width() - size);

    const col = k.add([
        k.rect(1, 1),
        k.pos(x, -size * 2),
        k.area({ shape: new k.Rect(k.vec2(-size, -size), k.vec2(size * 2, size * 2)) }),
        k.z(3),
        "collectible",
        { size, rot: 0, bobOffset: k.rand(0, Math.PI * 2) },
    ]);

    col.onDraw(() => {
        const s = col.size;
        // Rotação
        k.pushRotate(col.rot);
        // Glow
        k.drawRect(k.vec2(-s - 4, -s - 4), k.vec2(s * 2 + 8, s * 2 + 8), k.rgb(255, 220, 50, 0.15));
        // Quadrado principal
        k.drawRect(k.vec2(-s, -s), k.vec2(s * 2, s * 2), k.rgb(255, 220, 50));
        // Quadrado interno
        k.drawRect(k.vec2(-s * 0.4, -s * 0.4), k.vec2(s * 0.8, s * 0.8), k.rgb(255, 240, 150));
        k.popTransform();
    });

    col.onUpdate(() => {
        col.move(0, (50 + difficulty * 8) * k.dt());
        col.rot += 100 * k.dt();
        if (col.pos.y > k.height() + col.size * 2) k.destroy(col);
    });

    return col;
}

// ─── PARTÍCULAS ───
function spawnParticles(px, py, col, count = 8) {
    for (let i = 0; i < count; i++) {
        const s = k.rand(2, 5);
        const p = k.add([
            k.rect(s, s),
            k.pos(px, py),
            k.color(col),
            k.z(20),
            "particle",
            { vel: k.vec2(k.rand(-150, 150), k.rand(-150, 150)), life: k.rand(0.3, 0.7) },
        ]);
        p.onUpdate(() => {
            p.move(p.vel.x * k.dt(), p.vel.y * k.dt());
            p.life -= k.dt();
            if (p.life <= 0) k.destroy(p);
        });
    }
}

// ─── HUD ───
let scoreLabel, highLabel;

function createHUD() {
    scoreLabel = k.add([
        k.text("0", { size: 36 }),
        k.pos(20, 20),
        k.color(k.WHITE),
        k.fixed(),
        k.z(100),
    ]);

    highLabel = k.add([
        k.text(`BEST: ${highScore}`, { size: 14 }),
        k.pos(20, 60),
        k.color(k.rgb(150, 150, 180)),
        k.fixed(),
        k.z(100),
    ]);
}

function updateHUD() {
    if (scoreLabel) scoreLabel.text = `${score}`;
    if (highLabel) highLabel.text = `BEST: ${highScore}`;
}

// ─── TELA INICIAL ───
let titleObjects = [];
let player;

function showTitle() {
    gameRunning = false;
    gameOverFlag = false;
    score = 0;

    player = createPlayer();
    player.opacity = 0;

    titleObjects = [];

    const bg = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(k.rgb(10, 10, 30)),
        k.z(50),
        k.opacity(1),
    ]);
    titleObjects.push(bg);

    const t1 = k.add([
        k.text("SHAPE", { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2 - 100),
        k.anchor("center"),
        k.color(k.rgb(80, 180, 255)),
        k.z(51),
    ]);
    titleObjects.push(t1);

    const t2 = k.add([
        k.text("SURVIVOR", { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2 - 55),
        k.anchor("center"),
        k.color(k.rgb(255, 80, 80)),
        k.z(51),
    ]);
    titleObjects.push(t2);

    const hint = k.add([
        k.text("TOQUE PARA JOGAR", { size: 16 }),
        k.pos(k.width() / 2, k.height() / 2 + 90),
        k.anchor("center"),
        k.color(k.rgb(150, 150, 180)),
        k.z(51),
    ]);
    titleObjects.push(hint);
}

function hideTitle() {
    titleObjects.forEach(o => k.destroy(o));
    titleObjects = [];
}

// ─── GAME OVER ───
function showGameOver() {
    gameOverFlag = true;
    if (score > highScore) highScore = score;
    k.shake(12);

    const bg = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(k.BLACK),
        k.opacity(0),
        k.z(50),
    ]);
    bg.onUpdate(() => {
        bg.opacity = k.lerp(bg.opacity, 0.7, k.dt() * 3);
    });

    k.wait(0.4, () => {
        k.add([
            k.text("GAME OVER", { size: 36 }),
            k.pos(k.width() / 2, k.height() / 2 - 60),
            k.anchor("center"),
            k.color(k.rgb(255, 80, 80)),
            k.z(51),
        ]);
        k.add([
            k.text(`${score}`, { size: 56 }),
            k.pos(k.width() / 2, k.height() / 2 + 10),
            k.anchor("center"),
            k.color(k.WHITE),
            k.z(51),
        ]);
        k.add([
            k.text(`MELHOR: ${highScore}`, { size: 16 }),
            k.pos(k.width() / 2, k.height() / 2 + 60),
            k.anchor("center"),
            k.color(k.rgb(150, 150, 180)),
            k.z(51),
        ]);
        k.add([
            k.text("TOQUE PARA REINICIAR", { size: 14 }),
            k.pos(k.width() / 2, k.height() / 2 + 110),
            k.anchor("center"),
            k.color(k.rgb(150, 150, 180)),
            k.z(51),
        ]);
    });
}

// ─── START GAME ───
function startGame() {
    hideTitle();
    k.destroyAll("obstacle");
    k.destroyAll("collectible");
    k.destroyAll("particle");
    k.destroyAll("gameOverBg");

    // Destroi textos de game over
    get("go-text").forEach(k.destroy);

    score = 0;
    difficulty = 1;
    spawnTimer = 0;
    gameRunning = true;
    gameOverFlag = false;

    if (player) k.destroy(player);
    player = createPlayer();

    // Remove HUD antigo e recria
    if (scoreLabel) k.destroy(scoreLabel);
    if (highLabel) k.destroy(highLabel);
    createHUD();

    // Lógica do jogador
    player.onUpdate(() => {
        if (!gameRunning) return;

        let mx = 0, my = 0;

        // Desktop: teclado
        if (k.isKeyDown("left") || k.isKeyDown("a")) mx = -1;
        if (k.isKeyDown("right") || k.isKeyDown("d")) mx = 1;
        if (k.isKeyDown("up") || k.isKeyDown("w")) my = -1;
        if (k.isKeyDown("down") || k.isKeyDown("s")) my = 1;

        // Mobile: toque
        if (touchPos) {
            const dx = touchPos.x - player.pos.x;
            const dy = touchPos.y - player.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 10) {
                mx = dx / dist;
                my = dy / dist;
            }
        }

        if (mx || my) {
            const len = Math.sqrt(mx * mx + my * my);
            player.move(
                (mx / len) * player.speed * k.dt(),
                (my / len) * player.speed * k.dt()
            );
        }

        // Limites
        player.pos.x = k.clamp(player.pos.x, 18, k.width() - 18);
        player.pos.y = k.clamp(player.pos.y, 18, k.height() - 18);
    });
}

// ─── INPUT ───
k.onTouchStart((pos) => {
    if (!gameRunning && !gameOverFlag) {
        startGame();
        return;
    }
    if (gameOverFlag) {
        k.destroyAll("gameOverBg");
        startGame();
        return;
    }
    touchPos = pos;
});

k.onTouchMove((pos) => {
    if (gameRunning) touchPos = pos;
});

k.onTouchEnd(() => { touchPos = null; });

k.onClick(() => {
    if (gameOverFlag) {
        k.destroyAll("gameOverBg");
        startGame();
    }
});

k.onKeyPress("space", () => {
    if (gameOverFlag) {
        k.destroyAll("gameOverBg");
        startGame();
    }
});

k.onKeyPress("r", () => {
    if (gameOverFlag) {
        k.destroyAll("gameOverBg");
        startGame();
    }
});

// ─── COLISÕES ───
k.onCollide("player", "obstacle", (p, obs) => {
    if (!gameRunning) return;
    spawnParticles(p.pos.x, p.pos.y, k.rgb(255, 80, 80), 14);
    gameRunning = false;
    showGameOver();
});

k.onCollide("player", "collectible", (p, col) => {
    if (!gameRunning) return;
    score++;
    difficulty = 1 + Math.floor(score / 3) * 0.5;
    spawnParticles(col.pos.x, col.pos.y, k.rgb(255, 220, 50), 6);
    k.destroy(col);
    updateHUD();
});

// ─── LOOP PRINCIPAL ───
k.onUpdate(() => {
    if (!gameRunning || gameOverFlag) return;

    spawnTimer += k.dt();
    const interval = Math.max(0.35, 1.5 - difficulty * 0.15);

    if (spawnTimer >= interval) {
        spawnTimer = 0;
        spawnObstacle();
        if (difficulty > 2 && k.rand(0, 1) > 0.5) spawnObstacle();
    }

    // Spawn coletáveis
    const cols = k.get("collectible");
    if (cols.length < 3 && k.rand(0, 1) > 0.98) spawnCollectible();
});

// ─── INICIAR ───
showTitle();

console.log("🦖 Shape Survivor - Kaplay Next");
