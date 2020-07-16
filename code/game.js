class Vec {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    plus(other) {
        return new Vec(this.x + other.x, this.y + other.y);
    }

    times(factor) {
        return new Vec(this.x * factor, this.y * factor);
    }
}

const scale = 20;


class Player {
    constructor(pos, speed) {
        this.pos = pos;
        this.speed = speed;
        this.size = new Vec(0.8, 1.5);
    }

    static create(pos) {
        return new Player(pos.plus(new Vec(0, -1.5)), new Vec(0, 0));
    }

    update(time, state, keys) {
        const playerXSpeed = 7;
        const gravity = 30;
        const jumpSpeed = 17;
        let newPlayer = new Player(this.pos, this.speed);
        let xSpeed = 0;
        if (keys.ArrowLeft) {
            xSpeed -= playerXSpeed;
        }
        if (keys.ArrowRight) {
            xSpeed += playerXSpeed;
        }
        let posX = new Player(this.pos.plus(new Vec(xSpeed * time, 0)), this.speed);
        if (state.touches(posX, "wall")) {
            xSpeed = 0;
        }
        newPlayer.pos = newPlayer.pos.plus(new Vec(xSpeed * time, 0));

        let ySpeed = this.speed.y + gravity * time;
        let posY = new Player(this.pos.plus(new Vec(0, ySpeed * time)), this.speed);
        if (state.touches(posY, "wall")) {
            if (keys.ArrowUp && ySpeed > 0) {
                ySpeed = -jumpSpeed;
            }else{
                ySpeed = 0;
            }
        }
        newPlayer.pos = newPlayer.pos.plus(new Vec(0, ySpeed * time));
        newPlayer.speed.x = xSpeed;
        newPlayer.speed.y = ySpeed;
        return newPlayer;

    }

    get type() {
        return "player";
    }
}

class Coin {
    constructor(pos, basePos, wobble) {
        this.basePos = basePos;
        this.wobble = wobble;
        this.pos = pos;
        this.size = new Vec(0.6, 0.6);
    }

    get type() {
        return "coin";
    }

    update(time) {
        const wobbleSpeed = 8, wobbleDist = 0.07;
        let wobble = this.wobble + time * wobbleSpeed;
        let offset = Math.sin(wobble) * wobbleDist;
        return new Coin(this.basePos.plus(new Vec(0, offset)), this.basePos, wobble);
    }

    static create(pos) {
        return new Coin(pos, pos, Math.random() * Math.PI * 2);
    }

    collide(state) {
        state.actors = state.actors.filter(actor => actor != this);
        if (state.actors.every(actor => actor.type != "coin")) {
            state.status = "win";
        }
    }

}

class Lava {
    constructor(pos, speed, reset) {
        this.pos = pos;
        this.speed = speed;
        this.reset = reset;
        this.size = new Vec(1, 1);
    }

    get type() {
        return "lava";
    }

    update(time, state) {
        let newLava = new Lava(this.pos, this.speed, this.reset);
        newLava.pos = newLava.pos.plus(newLava.speed.times(time));
        if (state.touches(newLava, "wall")) {
            if (newLava.reset) {
                newLava.pos = newLava.reset;
            } else {
                newLava.pos = this.pos;
                newLava.speed = newLava.speed.times(-1);
            }
        }
        return newLava;
    }

    static create(pos, ch) {
        let newLava;
        if (ch == '=') {
            newLava = new Lava(pos, new Vec(2, 0));
        } else if (ch == '|') {
            newLava = new Lava(pos, new Vec(0, 2));
        } else {
            newLava = new Lava(pos, new Vec(0, 3), pos);
        }
        return newLava;
    }

    collide(state) {
        state.status = "lost";
    }
}

const levelChars = {
    ".": "empty", "#": "wall", "+": "lava",
    "@": Player, "o": Coin,
    "=": Lava, "v": Lava, "|": Lava
}

class Level {
    constructor(level) {
        this.actors = [];
        let rows = level.trim().split("\n").map(l => [...l]);
        this.rows = rows.map((row, y) => {
            return row.map((ch, x) => {
                let type = levelChars[ch];
                if (typeof (type) === "string") return type;
                this.actors.push(type.create(new Vec(x, y), ch));
                return "empty";
            });
        });
        this.height = this.rows.length;
        this.width = this.rows[0].length;
    }
}

class State {
    constructor(level, actors, status) {
        this.status = status;
        this.actors = actors;
        this.level = level;
    }
    update(time, keys) {
        let actors = this.actors.map(actor => actor.update(time, this, keys));
        let newState = new State(this.level, actors, this.status);
        if (newState.status != "playing") return newState;
        let player = newState.player;
        if (this.touches(player, "lava")) {
            newState.status = "lost";
            return newState;
        }
        for (let actor of actors) {
            if (actor.type != "player" && overlap(actor, player)) {
                actor.collide(newState);
            }
        }
        return newState;

    }

    get player() {
        return this.actors.find(actor => actor.type == "player");
    }

    touches(actor, type) {
        let pos = actor.pos;
        let size = actor.size;
        let xStart = Math.floor(pos.x), xEnd = Math.ceil(pos.x + size.x),
            yStart = Math.floor(pos.y), yEnd = Math.ceil(pos.y + size.y);
        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                let isOutside = x < 0 || y < 0 || x >= this.level.width || y >= this.level.height;
                let block = isOutside ? "wall" : this.level.rows[y][x];
                if (block == type) return true;
            }
        }
        return false;
    }

}

function elt(name, attrs, ...children) {
    let element = document.createElement(name);
    for (let attr of Object.keys(attrs)) {
        element.setAttribute(attr, attrs[attr]);
    }
    for (let child of children) {
        element.appendChild(child);
    }
    return element;
}

function drawGrid(level) {
    return elt("table", { class: "background", style: `width: ${level.width * scale}px` },
        ...level.rows.map(row => elt("tr", { style: `height: ${scale}px` },
            ...row.map(type => elt("td", { class: `${type}` })))
        ));
}

function drawActors(actors) {
    return elt("div", {}, ...actors.map(actor => {
        let element = elt("div", { class: `actor ${actor.type}` });
        element.style.top = `${actor.pos.y * scale}px`;
        element.style.left = `${actor.pos.x * scale}px`;
        element.style.width = `${actor.size.x * scale}px`;
        element.style.height = `${actor.size.y * scale}px`;
        return element;
    }));
}

function overlap(actor1, actor2) {
    let pos1 = actor1.pos, pos2 = actor2.pos, size1 = actor1.size, size2 = actor2.size;
    return pos1.x < pos2.x + size2.x && pos2.x < pos1.x + size1.x
        && pos1.y < pos2.y + size2.y && pos2.y < pos1.y + size1.y;
}

class DOMDisplay {
    constructor(parent, level) {
        this.dom = elt("div", { class: "game" }, drawGrid(level));
        this.actorLayer = undefined;
        parent.appendChild(this.dom);
    }

    clear() {
        this.dom.remove();
    }
    syncState(state) {
        if (this.actorLayer) this.actorLayer.remove();
        this.actorLayer = drawActors(state.actors);
        this.dom.appendChild(this.actorLayer);
        this.dom.className = `game ${state.status}`;
        this.scrollPlayerIntoView(state);
    }

    scrollPlayerIntoView(state) {
        let width = this.dom.clientWidth, height = this.dom.clientHeight;
        let margin = width / 3;
        let player = state.player;
        let center = player.pos.plus(player.size.times(0.5)).times(scale);
        if (center.x < this.dom.scrollLeft + margin) {
            this.dom.scrollLeft = center.x - margin;
        } else if (center.x > this.dom.scrollLeft + width - margin) {
            this.dom.scrollLeft = center.x + margin - width;
        }

        if (center.y < this.dom.scrollTop + margin) {
            this.dom.scrollTop = center.y - margin;
        } else if (center.y > this.dom.scrollTop + height - margin) {
            this.dom.scrollTop = center.y + margin - height;
        }

    }


}

function trackKeys(keys) {
    let down = Object.create(null);
    function track(event) {
        if (keys.includes(event.key)) {
            down[event.key] = (event.type === "keydown");
        }
    }
    window.addEventListener("keyup", track);
    window.addEventListener("keydown", track);
    return down;
}

const arrowKeys = trackKeys(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

async function runGame(levels, Display) {
    let index = 0;
    while (index < levels.length) {
        let status = await runLevel(new Level(levels[index]), Display);
        if (status == "win") {
            index++;
        }
    }
}

function runLevel(level, Display) {
    let display = new Display(document.body, level);
    let state = new State(level, level.actors, "playing");
    let ending = 1;
    return new Promise(resolve => {
        runAnimation(time => {
            state = state.update(time, arrowKeys);
            display.syncState(state);
            if (state.status == "playing") {
                return true;
            } else if (ending > 0) {
                ending -= time;
                return true;
            } else {
                display.clear();
                resolve(state.status);
                return false;
            }
        });


    })
}

function runAnimation(frameFunc) {
    let lastTime = undefined;
    function frame(time) {
        if (lastTime) {
            let interval = Math.min(100, time - lastTime) / 1000;
            let status = frameFunc(interval);
            if (!status) return;
        }
        lastTime = time;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

}
