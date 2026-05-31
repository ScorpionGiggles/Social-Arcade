const socket = io();

const COLORS = ['#ff4444','#44ff44','#4488ff','#ffdd44','#ff44ff','#44ffff','#ff8844','#aa44ff','#ffffff','#44ffaa'];
const BUILD_COLORS = ['#666666','#8B4513','#228B22','#4169E1','#FFD700','#ff4444','#888888','#ffffff'];
const BG_COLORS = ['#0f0f18','#08080f','#0a140a','#141428','#1a0a0a','#0e0e1a','#0c180c','#0a0a18','#1a1a1a','#0a0a0a'];
const TEMPLATES = [
    {id:'blank',    label:'Blank',        bg:'#0f0f18', desc:'Free build & explore'},
    {id:'maze',     label:'Maze',         bg:'#08080f', desc:'Find the exit!'},
    {id:'snake',    label:'Snake.io',     bg:'#0a140a', desc:'Eat & grow, don\'t crash'},
    {id:'geometry', label:'Geometry Dash',bg:'#1a0a0a', desc:'Jump over obstacles'},
    {id:'tiles',    label:'Tiles',        bg:'#0e0e1a', desc:'Tap the tiles'},
    {id:'racer',    label:'Drift Racer',  bg:'#0a0a18', desc:'Drift, dodge, collect coins'},
    {id:'x_o',      label:'X O',          bg:'#0a1a10', desc:'Tic Tac Toe'},
    {id:'battleship',label:'Battleship',   bg:'#0a1420', desc:'Naval combat 2p'},
];
const GRID=40,WORLD_W=800,WORLD_H=600,PS=30,SPEED=160,SPEECH_DUR=3000;
const COLS=20,ROWS=15;

const state={
    screen:'login',username:'',color:'#ff4444',playerId:null,isHost:false,
    roomCode:null,players:{},blocks:{},buildMode:false,buildAction:'place',
    buildColor:'#666666',keys:{},lastSent:0,lastTime:0,hoverGridX:-1,hoverGridY:-1,
    imageCache:{},template:'blank',bgColor:'#0f0f18',modeState:{}
};
function $(id){return document.getElementById(id);}

// === COLLISION ===
function collides(x,y,blocks){
    const pr=x+PS, pb=y+PS;
    for(const bid in blocks){
        const b=blocks[bid], bl=b.grid_x*GRID, bt=b.grid_y*GRID, br=bl+GRID, bb=bt+GRID;
        if(pr>bl&&x<br&&pb>bt&&y<bb) return true;
    }
    return false;
}
function hasBlockAt(blocks,gx,gy){
    return !!blocks[`${gx}_${gy}`];
}

// === MODE REGISTRY ===
const MODES={};

// ---- BLANK ----
MODES.blank={};
MODES.blank.init=function(){state.modeState={};$('build-tools').style.display=state.isHost?'flex':'none';};
MODES.blank.update=function(dt,me){
    let dx=0,dy=0;
    if(state.keys['w']||state.keys['arrowup'])dy=-1;
    if(state.keys['s']||state.keys['arrowdown'])dy=1;
    if(state.keys['a']||state.keys['arrowleft'])dx=-1;
    if(state.keys['d']||state.keys['arrowright'])dx=1;
    if(dx&&dy){dx*=0.7071;dy*=0.7071;}
    if(dx||dy){
        let nx=me.x+dx*SPEED*dt, ny=me.y+dy*SPEED*dt;
        nx=Math.max(0,Math.min(WORLD_W-PS,nx));ny=Math.max(0,Math.min(WORLD_H-PS,ny));
        me.x=nx;me.y=ny;
        const now=performance.now();
        if(now-state.lastSent>50){socket.emit('player_move',{x:Math.round(me.x),y:Math.round(me.y)});state.lastSent=now;}
    }
};

// ---- MAZE ----
MODES.maze={};
MODES.maze.init=function(){
    state.modeState={won:false,exitX:0,exitY:0};
    $('build-tools').style.display='none';
    // Find exit (a gap in the bottom-right area)
    for(let y=ROWS-1;y>=0;y--){
        for(let x=COLS-1;x>=0;x--){
            if(!state.blocks[`${x}_${y}`]){
                state.modeState.exitX=x;state.modeState.exitY=y;x=-1;y=-1;break;
            }
        }
    }
    // Place player at first open cell
    const me=state.players[state.playerId];
    if(me){
        for(let yy=0;yy<14;yy++){
            for(let xx=0;xx<20;xx++){
                if(!state.blocks[`${xx}_${yy}`]){
                    me.x=xx*GRID+(GRID-PS)/2;
                    me.y=yy*GRID+(GRID-PS)/2;
                    yy=99;xx=99;break;
                }
            }
        }
    }
};
MODES.maze.render=function(ctx){
    const ms=state.modeState;
    if(ms.exitX!==undefined){
        ctx.fillStyle='#44ff88';ctx.globalAlpha=0.6;
        ctx.fillRect(ms.exitX*GRID,ms.exitY*GRID,GRID,GRID);
        ctx.globalAlpha=1;
    }
    if(ms.won){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#44ff88';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('YOU WIN!',WORLD_W/2,WORLD_H/2-20);
        ctx.fillStyle='#aaa';ctx.font='20px sans-serif';
        ctx.fillText('Press Leave to return',WORLD_W/2,WORLD_H/2+40);
    }
};
MODES.maze.update=function(dt,me){
    let dx=0,dy=0;
    if(state.keys['w']||state.keys['arrowup'])dy=-1;
    if(state.keys['s']||state.keys['arrowdown'])dy=1;
    if(state.keys['a']||state.keys['arrowleft'])dx=-1;
    if(state.keys['d']||state.keys['arrowright'])dx=1;
    if(dx&&dy){dx*=0.7071;dy*=0.7071;}
    if(dx||dy&&!state.modeState.won){
        let nx=me.x+dx*SPEED*dt, ny=me.y;
        nx=Math.max(0,Math.min(WORLD_W-PS,nx));
        if(!collides(nx,ny,state.blocks)) me.x=nx;
        ny=me.y+dy*SPEED*dt;
        ny=Math.max(0,Math.min(WORLD_H-PS,ny));
        if(!collides(me.x,ny,state.blocks)) me.y=ny;
        const now=performance.now();
        if(now-state.lastSent>50){
            // Check win
            const gx=Math.floor((me.x+PS/2)/GRID), gy=Math.floor((me.y+PS/2)/GRID);
            if(gx===state.modeState.exitX&&gy===state.modeState.exitY) state.modeState.won=true;
            socket.emit('player_move',{x:Math.round(me.x),y:Math.round(me.y)});state.lastSent=now;
        }
    }
};

// ---- SNAKE ----
MODES.snake={};
MODES.snake.init=function(){
    state.modeState={
        segments:[{x:10,y:7},{x:9,y:7},{x:8,y:7}],
        dir:{x:1,y:0},nextDir:{x:1,y:0},food:{x:15,y:7},
        moveTimer:0,moveInterval:0.15,dead:false,score:0
    };
    $('build-tools').style.display='none';
    MODES.snake.spawnFood();
};
MODES.snake.spawnFood=function(){
    const ms=state.modeState,occupied=new Set(ms.segments.map(s=>`${s.x}_${s.y}`));
    let fx,fy,attempts=0;
    do{fx=Math.floor(Math.random()*(COLS-2))+1;fy=Math.floor(Math.random()*(ROWS-2))+1;attempts++;}
    while((occupied.has(`${fx}_${fy}`)||state.blocks[`${fx}_${fy}`])&&attempts<500);
    ms.food={x:fx,y:fy};
};
MODES.snake.update=function(dt){
    const ms=state.modeState;
    if(ms.dead) return;
    // Direction input
    if(state.keys['arrowup']||state.keys['w']){if(ms.dir.y!==1)ms.nextDir={x:0,y:-1};}
    if(state.keys['arrowdown']||state.keys['s']){if(ms.dir.y!==-1)ms.nextDir={x:0,y:1};}
    if(state.keys['arrowleft']||state.keys['a']){if(ms.dir.x!==1)ms.nextDir={x:-1,y:0};}
    if(state.keys['arrowright']||state.keys['d']){if(ms.dir.x!==-1)ms.nextDir={x:1,y:0};}

    ms.moveTimer+=dt;
    if(ms.moveTimer<ms.moveInterval) return;
    ms.moveTimer=0;
    ms.dir={...ms.nextDir};

    const head=ms.segments[0];
    let nx=head.x+ms.dir.x, ny=head.y+ms.dir.y;
    // Wall wrap OR wall death — for snake.io style, wall = death
    if(nx<0||nx>=COLS||ny<0||ny>=ROWS){ms.dead=true;return;}
    // Self collision
    for(let i=0;i<ms.segments.length;i++){if(ms.segments[i].x===nx&&ms.segments[i].y===ny){ms.dead=true;return;}}
    // Other players (basic — check positions)
    for(const pid in state.players){
        if(pid===state.playerId) continue;
        const p=state.players[pid];
        if(p.snakeSegments){
            for(const s of p.snakeSegments){if(s.x===nx&&s.y===ny){ms.dead=true;return;}}
        }
    }

    ms.segments.unshift({x:nx,y:ny});
    // Eat food
    if(nx===ms.food.x&&ny===ms.food.y){ms.score++;ms.moveInterval=Math.max(0.08,ms.moveInterval-0.002);MODES.snake.spawnFood();}
    else ms.segments.pop();

    // Broadcast snake state
    const now=performance.now();
    if(now-state.lastSent>100){
        socket.emit('snake_state',{
            segments:ms.segments.slice(0,20),dir:ms.dir,food:ms.food,score:ms.score,dead:ms.dead
        });
        state.lastSent=now;
    }
};
MODES.snake.render=function(ctx){
    const ms=state.modeState;
    // Food
    ctx.fillStyle='#ff4488';
    ctx.beginPath();ctx.arc(ms.food.x*GRID+GRID/2,ms.food.y*GRID+GRID/2,GRID/3,0,Math.PI*2);ctx.fill();
    // Snake
    ms.segments.forEach((s,i)=>{
        ctx.fillStyle=i===0?'#44ff88':'#33cc66';
        ctx.shadowBlur=i===0?12:4;ctx.shadowColor='#44ff88';
        ctx.fillRect(s.x*GRID+2,s.y*GRID+2,GRID-4,GRID-4);
        ctx.shadowBlur=0;
    });
    // Other players' snakes
    for(const pid in state.players){
        if(pid===state.playerId||!state.players[pid].snakeSegments) continue;
        const segs=state.players[pid].snakeSegments;
        segs.forEach((s,i)=>{
            ctx.fillStyle=i===0?'#ff8844':'#cc6633';
            ctx.fillRect(s.x*GRID+2,s.y*GRID+2,GRID-4,GRID-4);
        });
    }
    if(ms.dead){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#ff4444';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('YOU DIED',WORLD_W/2,WORLD_H/2-20);
        ctx.fillStyle='#aaa';ctx.font='20px sans-serif';
        ctx.fillText('Score: '+ms.score,WORLD_W/2,WORLD_H/2+30);
        ctx.fillText('Wait for respawn...',WORLD_W/2,WORLD_H/2+60);
    }
    // Score HUD
    ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('Score: '+ms.score,10,10);
};

// ---- GEOMETRY ----
MODES.geometry={};
MODES.geometry.renderBlocks='scroll';
MODES.geometry.init=function(){
    state.modeState={vy:0,onGround:true,scrollX:0,dead:false,score:0};
    $('build-tools').style.display='none';
    const me=state.players[state.playerId];
    if(me){me.x=120;me.y=WORLD_H-PS-40;}
};
MODES.geometry.update=function(dt,me){
    const ms=state.modeState;
    if(ms.dead) return;
    const gravity=900,jumpSpeed=-400,groundY=WORLD_H-PS-40;
    me.x=120;
    ms.scrollX+=dt*150;
    ms.score=Math.floor(ms.scrollX/10);
    if((state.keys['w']||state.keys[' ']||state.keys['arrowup'])&&ms.onGround){ms.vy=jumpSpeed;ms.onGround=false;}
    ms.vy+=gravity*dt;
    me.y+=ms.vy*dt;
    if(me.y>=groundY){me.y=groundY;ms.vy=0;ms.onGround=true;}
    // Obstacle collision with scroll offset
    for(const bid in state.blocks){
        const b=state.blocks[bid];
        const bx=b.grid_x*GRID-(ms.scrollX||0), by=b.grid_y*GRID;
        if(me.x+PS>bx&&me.x<bx+GRID&&me.y+PS>by&&me.y<by+GRID){ms.dead=true;break;}
    }
    const now=performance.now();
    if(now-state.lastSent>50){
        socket.emit('player_move',{x:Math.round(me.x),y:Math.round(me.y)});
        state.lastSent=now;
    }
    if(me.y>WORLD_H+50) ms.dead=true;
};
MODES.geometry.render=function(ctx){
    const ms=state.modeState;
    ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('Score: '+ms.score,10,10);
    if(ms.dead){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#ff4444';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('GAME OVER',WORLD_W/2,WORLD_H/2-20);
        ctx.fillStyle='#aaa';ctx.font='20px sans-serif';
        ctx.fillText('Score: '+ms.score,WORLD_W/2,WORLD_H/2+30);
    }
};

// ---- TILES ----
MODES.tiles={};
MODES.tiles.init=function(){
    state.modeState={tiles:[],timer:0,interval:0.6,gameOver:false,score:0,nextCol:0};
    $('build-tools').style.display='none';
};
MODES.tiles.update=function(dt){
    const ms=state.modeState;
    if(ms.gameOver) return;
    ms.timer+=dt;
    if(ms.timer>ms.interval){
        ms.timer=0;
        const col=Math.floor(Math.random()*4);
        const colors=['#ff4444','#44ff44','#4488ff','#ffdd44'];
        ms.tiles.push({col,color:colors[col],y:0});
        ms.interval=Math.max(0.2,0.6-ms.score*0.01);
    }
    for(const t of ms.tiles) t.y+=dt*3;
    // Check missed (tile passed bottom)
    for(let i=ms.tiles.length-1;i>=0;i--){
        if(ms.tiles[i].y*GRID>WORLD_H-20){ms.gameOver=true;return;}
    }
};
MODES.tiles.handleClick=function(cx,cy){
    const ms=state.modeState;
    if(ms.gameOver) return;
    const colW=WORLD_W/4,clickedCol=Math.floor(cx/colW);
    // Find the lowest tile in that column near the bottom
    let best=null,bestIdx=-1;
    for(let i=0;i<ms.tiles.length;i++){
        const t=ms.tiles[i];
        if(t.col===clickedCol){
            const ty=t.y*GRID;
            if(ty>WORLD_H-GRID-20&&!t.hit){best=t;bestIdx=i;}
        }
    }
    if(best){best.hit=true;ms.score++;ms.tiles.splice(bestIdx,1);}
    else{ms.gameOver=true;}
};
MODES.tiles.renderOverlay=function(ctx){
    const ms=state.modeState;
    const colW=WORLD_W/4;
    // Column guides
    ctx.strokeStyle='rgba(255,255,255,0.08)';
    for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(i*colW,0);ctx.lineTo(i*colW,WORLD_H);ctx.stroke();}
    // Player bars at bottom
    const barColors=['#ff4444','#44ff44','#4488ff','#ffdd44'];
    for(let i=0;i<4;i++){
        ctx.fillStyle=barColors[i];
        ctx.globalAlpha=0.3;
        ctx.fillRect(i*colW+4,WORLD_H-16,colW-8,12);
        ctx.globalAlpha=1;
        ctx.fillStyle='rgba(255,255,255,0.15)';
        ctx.fillRect(i*colW+4,WORLD_H-4,colW-8,4);
    }
    // Falling tiles
    for(let i=0;i<ms.tiles.length;i++){
        const t=ms.tiles[i];
        if(t.hit) continue;
        const ty=t.y*GRID;
        if(ty<-GRID||ty>WORLD_H+GRID) continue;
        ctx.fillStyle=t.color;
        ctx.shadowBlur=8;ctx.shadowColor=t.color;
        ctx.fillRect(t.col*colW+4,ty+4,colW-8,GRID-8);
        ctx.shadowBlur=0;
    }
    // Score
    ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('Score: '+ms.score,10,10);
    if(ms.gameOver){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#ff4444';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('GAME OVER',WORLD_W/2,WORLD_H/2);
        ctx.fillStyle='#aaa';ctx.font='20px sans-serif';
        ctx.fillText('Score: '+ms.score,WORLD_W/2,WORLD_H/2+40);
    }
};

// ---- RACER (Drift Racer) ----
MODES.racer={renderBlocks:false};
MODES.racer.init=function(){
    state.modeState={
        speed:0,angle:0,drift:0,
        coins:0,totalCoins:0,finished:false
    };
    $('build-tools').style.display='none';
    // Count total coins on the track
    let c=0;
    for(const bid in state.blocks){
        if(state.blocks[bid].color==='#ffdd44') c++;
    }
    state.modeState.totalCoins=c;
    // Place player on track
    const me=state.players[state.playerId];
    if(me){me.x=100;me.y=100;}
};
MODES.racer.update=function(dt,me){
    const ms=state.modeState;
    if(ms.finished) return;
    const accel=1500,brake=1200,turn=3.5,friction=500,maxSpeed=650,driftGain=3.0;

    let turning=false;
    if(state.keys['w']||state.keys['arrowup']) ms.speed+=accel*dt;
    if(state.keys['s']||state.keys['arrowdown']) ms.speed-=brake*dt;
    if(state.keys['a']||state.keys['arrowleft']){ms.angle-=turn*dt;turning=true;}
    if(state.keys['d']||state.keys['arrowright']){ms.angle+=turn*dt;turning=true;}

    if(!state.keys['w']&&!state.keys['s']&&!(state.keys['arrowup']||state.keys['arrowdown'])){
        if(ms.speed>0) ms.speed=Math.max(0,ms.speed-friction*dt);
        else if(ms.speed<0) ms.speed=Math.min(0,ms.speed+friction*dt);
    }
    ms.speed=Math.max(-80,Math.min(maxSpeed,ms.speed));

    // Drift: when turning at speed, car oversteers
    if(turning&&Math.abs(ms.speed)>60){
        const sign=state.keys['a']||state.keys['arrowleft']?-1:1;
        ms.drift+=sign*driftGain*dt*(ms.speed/maxSpeed);
    }
    // Drift decays back toward 0
    ms.drift*=Math.max(0,1-1.8*dt);
    ms.drift=Math.max(-0.6,Math.min(0.6,ms.drift));

    // Movement (open map - no walls)
    const moveAngle=ms.angle+ms.drift;
    me.x+=Math.cos(moveAngle)*ms.speed*dt;
    me.y+=Math.sin(moveAngle)*ms.speed*dt;
    me.x=Math.max(0,Math.min(WORLD_W-PS,me.x));
    me.y=Math.max(0,Math.min(WORLD_H-PS,me.y));

    // Coin collection (by AABB)
    const toRemove=[];
    for(const bid in state.blocks){
        const b=state.blocks[bid];
        if(b.color!=='#ffdd44') continue;
        const bl=b.grid_x*GRID,bt=b.grid_y*GRID;
        if(me.x+PS>bl&&me.x<bl+GRID&&me.y+PS>bt&&me.y<bt+GRID) toRemove.push(bid);
    }
    for(const bid of toRemove){
        const b=state.blocks[bid];
        ms.coins++;delete state.blocks[bid];
        socket.emit('remove_block',{grid_x:b.grid_x,grid_y:b.grid_y});
    }
    if(ms.coins>=ms.totalCoins&&ms.totalCoins>0){
        ms.finished=true;socket.emit('race_finished',{player_id:state.playerId});
    }
    const now=performance.now();
    if(now-state.lastSent>30){
        socket.emit('player_move',{x:Math.round(me.x),y:Math.round(me.y)});
        state.lastSent=now;
    }
};
MODES.racer.render=function(ctx){
    const ms=state.modeState;
    // Draw player car with drift visual
    const me=state.players[state.playerId];
    if(me){
        ctx.save();
        ctx.translate(me.x+PS/2,me.y+PS/2);
        ctx.rotate(ms.angle);
        // Car body (match hitbox PS=30 better)
        const hw=14,hh=10;
        ctx.fillStyle=state.color;
        ctx.shadowBlur=10;ctx.shadowColor=state.color;
        ctx.fillRect(-hw,-hh,hw*2,hh*2);
        ctx.shadowBlur=0;
        // Car outline
        ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;
        ctx.strokeRect(-hw,-hh,hw*2,hh*2);
        ctx.strokeStyle='transparent';
        // Windshield
        ctx.fillStyle='rgba(255,255,255,0.15)';
        ctx.fillRect(-6,-hh+2,12,5);
        // Drift sparks
        if(Math.abs(ms.drift)>0.05&&Math.abs(ms.speed)>50){
            ctx.fillStyle='#ffdd44';
            ctx.globalAlpha=Math.min(1,Math.abs(ms.drift)*2);
            const sx=ms.drift>0?-(hw+2):(hw+2);
            ctx.beginPath();ctx.arc(sx,0,3,0,Math.PI*2);ctx.fill();
            ctx.globalAlpha=1;
        }
        ctx.restore();
        // Draw other players as simple cars
        for(const pid in state.players){
            if(pid===state.playerId) continue;
            const p=state.players[pid];
            ctx.save();
            ctx.translate(p.x+PS/2,p.y+PS/2);
            ctx.fillStyle=p.color;
            ctx.fillRect(-12,-8,24,16);
            ctx.restore();
        }
    }
    // Draw coins with glow
    for(const bid in state.blocks){
        const b=state.blocks[bid];
        if(b.color!=='#ffdd44') continue;
        const cx=b.grid_x*GRID+GRID/2,cy=b.grid_y*GRID+GRID/2;
        ctx.save();
        ctx.shadowBlur=20;ctx.shadowColor='#ffdd44';
        ctx.fillStyle='#ffdd44';
        ctx.beginPath();ctx.arc(cx,cy,GRID/2-6,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,200,0.5)';
        ctx.beginPath();ctx.arc(cx-2,cy-2,GRID/4,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
    // HUD
    ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('Coins: '+ms.coins+'/'+ms.totalCoins+'  Speed: '+Math.floor(Math.abs(ms.speed)),10,10);
    ctx.fillStyle='#888';ctx.font='13px sans-serif';
    ctx.fillText('Drift: '+(Math.abs(ms.drift)*100).toFixed(0)+'%',10,34);
    if(ms.finished){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#ffdd44';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('ALL COINS COLLECTED!',WORLD_W/2,WORLD_H/2-10);
        ctx.fillStyle='#aaa';ctx.font='20px sans-serif';
        ctx.fillText('Winner!',WORLD_W/2,WORLD_H/2+40);
    }
};

// ---- X O ----
MODES.x_o={};
MODES.x_o.init=function(){
    const pcount=Object.keys(state.players).length;
    state.modeState={
        board:Array(9).fill(null),turn:'X',mySymbol:null,gameOver:false,winner:null,
        waiting:pcount<2
    };
    $('build-tools').style.display='none';
    if(state.isHost) state.modeState.mySymbol='X';
    else state.modeState.mySymbol='O';
};
MODES.x_o.onPlayerJoined=function(){
    const ms=state.modeState;
    if(ms.waiting&&Object.keys(state.players).length>=2){ms.waiting=false;addSystemMessage('XO game started! X goes first.');}
};
MODES.x_o.handleClick=function(cx,cy){
    const ms=state.modeState;
    if(ms.gameOver||ms.mySymbol!==ms.turn) return;
    // Map click to board cell (3x3 grid in center)
    const bx=Math.floor((cx-120)/187), by=Math.floor((cy-60)/160);
    if(bx<0||bx>2||by<0||by>2) return;
    const idx=by*3+bx;
    if(ms.board[idx]!==null) return;
    ms.board[idx]=ms.mySymbol;
    MODES.x_o.checkWin();
    ms.turn=ms.mySymbol==='X'?'O':'X';
    socket.emit('xo_move',{index:idx,symbol:ms.mySymbol});
};
MODES.x_o.onMove=function(data){
    const ms=state.modeState;
    if(ms.board[data.index]===null){
        ms.board[data.index]=data.symbol;
        MODES.x_o.checkWin();
        ms.turn=data.symbol==='X'?'O':'X';
    }
};
MODES.x_o.checkWin=function(){
    const ms=state.modeState,b=ms.board;
    const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const [a,bc,c] of wins){
        if(b[a]&&b[a]===b[bc]&&b[a]===b[c]){ms.winner=b[a];ms.gameOver=true;return;}
    }
    if(b.every(c=>c!==null)){ms.gameOver=true;ms.winner='tie';}
};
MODES.x_o.renderOverlay=function(ctx){
    const ms=state.modeState;
    const ox=120,oy=60,cw=187,ch=160;
    ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;
    for(let i=1;i<3;i++){
        ctx.beginPath();ctx.moveTo(ox+i*cw,oy);ctx.lineTo(ox+i*cw,oy+3*ch);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ox,oy+i*ch);ctx.lineTo(ox+3*cw,oy+i*ch);ctx.stroke();
    }
    for(let i=0;i<9;i++){
        if(!ms.board[i]) continue;
        const gx=i%3,gy=Math.floor(i/3),cx2=ox+gx*cw+cw/2,cy2=oy+gy*ch+ch/2;
        ctx.fillStyle=ms.board[i]==='X'?'#ff4444':'#4488ff';
        ctx.font='bold 60px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(ms.board[i],cx2,cy2);
    }
    // HUD
    ctx.fillStyle='#fff';ctx.font='16px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('You: '+ms.mySymbol,10,10);
    ctx.fillText('Turn: '+ms.turn,10,34);
    if(ms.waiting){
        ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#aaa';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('Waiting for opponent...',WORLD_W/2,WORLD_H/2);
    }
    if(ms.gameOver){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#ffdd44';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(ms.winner==='tie'?'TIE!':ms.winner+' WINS!',WORLD_W/2,WORLD_H/2);
    }
};

// ---- BATTLESHIP ----
MODES.battleship={};
MODES.battleship.init=function(){
    if(state.modeState.ready&&state.modeState.turn){$('build-tools').style.display='none';return;}
    state.modeState={gridSize:7,myShips:[],hits:[],misses:[],enemyHits:[],enemyMisses:[],
        turn:null,winner:null,myId:null,enemyId:null,ready:false,waiting:true};
    $('build-tools').style.display='none';
};
MODES.battleship.onPlayerJoined=function(){
    const ms=state.modeState;
    if(ms.waiting&&Object.keys(state.players).length>=2){
        ms.waiting=false;
        socket.emit('battleship_get_state');
    }
};
MODES.battleship.handleClick=function(cx,cy){
    const ms=state.modeState;
    if(ms.waiting||ms.winner||!ms.ready) return;
    if(ms.turn!==state.playerId) return;
    const gridSize=ms.gridSize,cellW=WORLD_W/gridSize,cellH=WORLD_H/gridSize;
    const gx=Math.floor(cx/cellW),gy=Math.floor(cy/cellH);
    if(gx<0||gx>=gridSize||gy<0||gy>=gridSize) return;
    const cell=gy*gridSize+gx;
    if(ms.hits.includes(cell)||ms.misses.includes(cell)) return;
    socket.emit('battleship_attack',{cell});
};
MODES.battleship.renderOverlay=function(ctx){
    const ms=state.modeState;
    const gs=ms.gridSize,cellW=WORLD_W/gs,cellH=WORLD_H/gs;
    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
    for(let i=0;i<=gs;i++){
        ctx.beginPath();ctx.moveTo(i*cellW,0);ctx.lineTo(i*cellW,WORLD_H);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,i*cellH);ctx.lineTo(WORLD_W,i*cellH);ctx.stroke();
    }
    if(ms.waiting){
        ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#aaa';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('Waiting for opponent...',WORLD_W/2,WORLD_H/2);
        return;
    }
    // Split field: left half = my board, right half = enemy board
    const half=WORLD_W/2;
    ctx.strokeStyle='rgba(255,255,255,0.05)';
    ctx.beginPath();ctx.moveTo(half,0);ctx.lineTo(half,WORLD_H);ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#888';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText('Your fleet',half/2,WORLD_H-4);
    ctx.fillText('Enemy waters',half+half/2,WORLD_H-4);
    // My ships (left half)
    for(const ship of ms.myShips){
        for(const cell of ship){
            const gx=cell%gs,gy=Math.floor(cell/gs);
            const x=gx*cellW/2,y=gy*cellH;
            ctx.fillStyle='#44aa88';
            ctx.shadowBlur=4;ctx.shadowColor='#44aa88';
            ctx.fillRect(x+1,y+1,cellW/2-2,cellH-2);
            ctx.shadowBlur=0;
        }
    }
    // My hits on enemy (displayed on right half)
    for(const cell of ms.hits){
        const gx=cell%gs,gy=Math.floor(cell/gs);
        const x=half+gx*cellW/2,y=gy*cellH;
        ctx.fillStyle='#ff4444';
        ctx.shadowBlur=8;ctx.shadowColor='#ff4444';
        ctx.beginPath();ctx.arc(x+cellW/4,y+cellH/2,8,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
    }
    for(const cell of ms.misses){
        const gx=cell%gs,gy=Math.floor(cell/gs);
        const x=half+gx*cellW/2,y=gy*cellH;
        ctx.fillStyle='rgba(255,255,255,0.2)';
        ctx.beginPath();ctx.arc(x+cellW/4,y+cellH/2,5,0,Math.PI*2);ctx.fill();
    }
    // Enemy hits on me (displayed on left half)
    for(const cell of ms.enemyHits){
        const gx=cell%gs,gy=Math.floor(cell/gs);
        const x=gx*cellW/2,y=gy*cellH;
        ctx.fillStyle='#ff4444';
        ctx.shadowBlur=8;ctx.shadowColor='#ff4444';
        ctx.beginPath();ctx.arc(x+cellW/4,y+cellH/2,8,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
    }
    for(const cell of ms.enemyMisses){
        const gx=cell%gs,gy=Math.floor(cell/gs);
        const x=gx*cellW/2,y=gy*cellH;
        ctx.fillStyle='rgba(255,255,255,0.2)';
        ctx.beginPath();ctx.arc(x+cellW/4,y+cellH/2,5,0,Math.PI*2);ctx.fill();
    }
    // HUD
    ctx.fillStyle='#fff';ctx.font='16px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    if(ms.winner){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,WORLD_W,WORLD_H);
        ctx.fillStyle='#ffdd44';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(ms.winner===state.playerId?'YOU WIN!':'YOU LOSE!',WORLD_W/2,WORLD_H/2);
    } else if(ms.ready){
        const isMyTurn=ms.turn===state.playerId;
        ctx.fillText(isMyTurn?'Your turn — fire!':'Enemy\'s turn...',10,10);
        ctx.fillText('Hits: '+ms.hits.length+'  Misses: '+ms.misses.length,10,34);
    }
};

// === SOCKET EVENTS ===
function saveSession(){
    fetch('/api/save-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:state.username,color:state.color})}).catch(()=>{});
}
function setupSocketEvents(){
    socket.on('connect',()=>{
        if(window.initialUser&&state.screen==='login'){
            state.username=window.initialUser.username;state.color=window.initialUser.color;
            socket.emit('login',{username:state.username,color:state.color});
            window.initialUser=null;return;
        }
        if(state.screen==='game') addSystemMessage('Reconnected');
    });
    socket.on('disconnect',()=>addSystemMessage('Disconnected'));
    socket.on('logged_in',(data)=>{
        state.username=data.username;state.color=data.color;saveSession();
        $('lobby-user').textContent='Logged in as '+data.username;
        buildTemplateGrid();showScreen('lobby');socket.emit('get_rooms');
    });
    socket.on('room_created',(data)=>{
        saveSession();applyRoomData(data,true);
    });
    socket.on('room_joined',(data)=>{
        saveSession();applyRoomData(data,false);
    });
    socket.on('player_joined',(data)=>{
        state.players[data.player.id]=data.player;
        addSystemMessage(data.player.username+' joined');updatePlayerCount();
        if(MODES[state.template]&&MODES[state.template].onPlayerJoined) MODES[state.template].onPlayerJoined(data);
    });
    socket.on('player_left',(data)=>{
        if(state.players[data.player_id]){addSystemMessage(state.players[data.player_id].username+' left');delete state.players[data.player_id];updatePlayerCount();}
    });
    socket.on('player_moved',(data)=>{
        if(state.players[data.player_id]){state.players[data.player_id].x=data.x;state.players[data.player_id].y=data.y;}
    });
    socket.on('chat_message',(data)=>{
        addChatMessage(data);
        if(state.players[data.player_id]) state.players[data.player_id].speech={type:'text',text:data.text,timestamp:Date.now()};
    });
    socket.on('chat_image',(data)=>{
        addImageMessage(data);
        if(state.players[data.player_id]) state.players[data.player_id].speech={type:'image',url:data.url,timestamp:Date.now()};
        if(!state.imageCache[data.url]){const img=new Image();img.crossOrigin='anonymous';img.src=data.url;state.imageCache[data.url]=img;}
    });
    socket.on('block_placed',(data)=>{state.blocks[data.block_id]={grid_x:data.grid_x,grid_y:data.grid_y,color:data.color};});
    socket.on('block_removed',(data)=>{delete state.blocks[data.block_id];});
    socket.on('room_closed',(data)=>{addSystemMessage(data.message||'Room closed');leaveGame();});
    socket.on('rooms_list',(data)=>{
        updateRoomsList(data.rooms);
        updateLoginRoomsList(data.rooms);
    });
    socket.on('error',(data)=>{if(state.screen==='login')$('login-msg').textContent=data.message;else addSystemMessage('Error: '+data.message);});
    // Game mode sync events
    socket.on('snake_state',(data)=>{
        if(state.players[data.player_id]){state.players[data.player_id].snakeSegments=data.segments;state.players[data.player_id].snakeDead=data.dead;}
    });
    socket.on('xo_move',(data)=>{
        if(MODES[state.template]&&MODES[state.template].onMove) MODES[state.template].onMove(data);
    });
    socket.on('race_finished',(data)=>{
        addSystemMessage('Player '+data.player_id+' finished the race!');
    });
    socket.on('battleship_state',(data)=>{
        if(MODES.battleship&&state.template==='battleship'){
            const ms=state.modeState;
            if(!ms.myId){
                const pids=Object.keys(state.players);
                ms.myId=state.playerId;
                ms.enemyId=pids.find(pid=>pid!==state.playerId)||null;
            }
            const myShips=(data.ships&&data.ships[ms.myId])||[];
            const enemyShips=(data.ships&&data.ships[ms.enemyId])||[];
            // Convert ships from [[(x,y),...],...] to cell indices
            const gs=ms.gridSize;
            ms.myShips=myShips.map(ship=>ship.map(([x,y])=>y*gs+x));
            ms.hits=data.hits&&data.hits[ms.enemyId]||[];
            ms.misses=data.misses&&data.misses[ms.enemyId]||[];
            ms.enemyHits=data.hits&&data.hits[ms.myId]||[];
            ms.enemyMisses=data.misses&&data.misses[ms.myId]||[];
            ms.turn=data.turn;
            ms.winner=data.winner;
            ms.ready=true;
        }
    });
}
function applyRoomData(data,isHost){
    // Preserve battleship state if already received via socket
    const prev=state.modeState;
    state.roomCode=data.code;state.isHost=isHost;state.playerId=data.your_player_id;
    state.players=data.room.players;state.blocks=data.room.blocks;
    state.bgColor=data.room.bg_color||'#0f0f18';state.template=data.room.template||'blank';
    // Clear mode state (but keep battleship data if we already got it)
    if(prev.ready&&prev.myId){state.modeState=prev;}
    else{state.modeState={};}
    enterGame();
}

// === UI ===
function setupUI(canvas,ctx){
    state.ctx=ctx;state.canvas=canvas;
    $('username-input').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
    setupColorPicker('color-picker',COLORS,c=>state.color=c);
    $('login-enter-btn').addEventListener('click',doLogin);
    $('login-create-btn').addEventListener('click',doLoginCreate);
    $('login-join-btn').addEventListener('click',doLoginJoin);
    $('room-code-input').addEventListener('keydown',e=>{if(e.key==='Enter')doLoginJoin();});
    buildTemplateGrid();
    setupColorPicker('bg-color-picker',BG_COLORS,c=>state.bgColor=c);
    $('join-room-btn').addEventListener('click',()=>{const c=$('lobby-code-input').value.trim().toUpperCase();if(c)socket.emit('join_room',{code:c});});
    $('lobby-code-input').addEventListener('keydown',e=>{if(e.key==='Enter')$('join-room-btn').click();});
    $('refresh-rooms-btn').addEventListener('click',()=>socket.emit('get_rooms'));
    $('leave-btn').addEventListener('click',()=>{socket.emit('leave_room');leaveGame();});
    $('chat-send').addEventListener('click',sendChat);
    $('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
    $('img-send').addEventListener('click',sendImage);
    $('img-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendImage();});
    $('build-toggle').addEventListener('click',()=>{
        state.buildMode=!state.buildMode;
        $('build-toggle').textContent=state.buildMode?'ON':'OFF';
        $('build-toggle').classList.toggle('active',state.buildMode);
        canvas.style.cursor=state.buildMode?'crosshair':'default';
    });
    $('build-place').addEventListener('click',()=>{state.buildAction='place';$('build-place').classList.add('active');$('build-remove').classList.remove('active');});
    $('build-remove').addEventListener('click',()=>{state.buildAction='remove';$('build-remove').classList.add('active');$('build-place').classList.remove('active');});
    setupColorPicker('build-colors',BUILD_COLORS,c=>state.buildColor=c);
    canvas.addEventListener('click',e=>handleCanvasClick(e,canvas));
    canvas.addEventListener('mousemove',e=>handleCanvasMove(e,canvas));
    canvas.addEventListener('mouseleave',()=>{state.hoverGridX=-1;state.hoverGridY=-1;});
    window.addEventListener('keydown',e=>{state.keys[e.key.toLowerCase()]=true;});
    window.addEventListener('keyup',e=>{state.keys[e.key.toLowerCase()]=false;});
}
function setupColorPicker(containerId,colors,onChange){
    const container=$(containerId);container.innerHTML='';
    colors.forEach((c,i)=>{
        const btn=document.createElement('button');
        btn.className='color-btn'+(i===0?' selected':'');btn.style.background=c;btn.dataset.color=c;
        btn.addEventListener('click',()=>{container.querySelectorAll('.color-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');onChange(c);});
        container.appendChild(btn);
    });
}
function buildTemplateGrid(){
    const grid=$('template-grid');if(!grid)return;
    grid.innerHTML='';
    TEMPLATES.forEach(t=>{
        const card=document.createElement('div');
        card.className='template-card'+(t.id===state.template?' selected':'');
        card.style.setProperty('--tmpl-bg',t.bg);
        card.innerHTML=`<span class="tmpl-name">${t.label}</span><span class="tmpl-desc">${t.desc}</span>`;
        card.addEventListener('click',()=>{
            state.template=t.id;state.bgColor=t.bg;
            socket.emit('create_room',{template:t.id,bg_color:t.bg});
        });
        grid.appendChild(card);
    });
}
function showScreen(screen){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $('screen-'+screen).classList.add('active');state.screen=screen;
    if(screen==='lobby'){buildTemplateGrid();socket.emit('get_rooms');}
}
function updateRoomsList(rooms){
    const list=$('rooms-list');
    if(!rooms||rooms.length===0){list.innerHTML='<div class="room-empty">No active rooms. Create one!</div>';return;}
    list.innerHTML=rooms.map(r=>{
        const tmpl=TEMPLATES.find(t=>t.id===r.template)||TEMPLATES[0];
        return `<div class="room-item" onclick="quickJoin('${r.code}')">
            <span class="room-code">${r.code}</span>
            <span class="room-tmpl" style="color:${tmpl.bg};background:${tmpl.bg}33">${tmpl.label}</span>
            <span class="room-host">${r.host_username}</span>
            <span class="room-players">${r.player_count} online</span>
        </div>`;
    }).join('');
}
function updateLoginRoomsList(rooms){
    const list=$('login-rooms-list');
    if(!list)return;
    if(!rooms||rooms.length===0){list.innerHTML='';return;}
    list.innerHTML=rooms.slice(0,3).map(r=>{
        const tmpl=TEMPLATES.find(t=>t.id===r.template)||TEMPLATES[0];
        return `<div class="room-item" onclick="quickJoinFromLogin('${r.code}')" style="padding:6px 10px;font-size:0.8rem">
            <span class="room-code" style="font-size:0.8rem">${r.code}</span>
            <span style="color:#888">${r.host_username}</span>
            <span style="color:#4ade80;font-size:0.75rem">${r.player_count}</span>
        </div>`;
    }).join('');
}
function quickJoin(code){$('lobby-code-input').value=code;socket.emit('join_room',{code});}
function quickJoinFromLogin(code){
    const uname=$('username-input').value.trim();
    if(!uname){$('login-msg').textContent='Enter a username first';return;}
    state.username=uname;
    socket.emit('login_and_join',{username:uname,color:state.color,code});
}

// === LOGIN ===
function doLogin(){
    const u=$('username-input').value.trim();
    if(!u){$('login-msg').textContent='Please enter a username';return;}
    state.username=u;socket.emit('login',{username:u,color:state.color});
}
function doLoginCreate(){
    const u=$('username-input').value.trim();
    if(!u){$('login-msg').textContent='Please enter a username';return;}
    state.username=u;state.template='blank';state.bgColor='#0f0f18';
    socket.emit('login_and_create',{username:u,color:state.color,template:'blank',bg_color:'#0f0f18'});
}
function doLoginJoin(){
    const u=$('username-input').value.trim(),c=$('room-code-input').value.trim().toUpperCase();
    if(!u){$('login-msg').textContent='Please enter a username';return;}
    if(!c){$('login-msg').textContent='Please enter a room code';return;}
    state.username=u;socket.emit('login_and_join',{username:u,color:state.color,code:c});
}

// === GAME ===
function enterGame(){
    showScreen('game');
    $('room-code-display').textContent='Room: '+state.roomCode;
    $('game-user-display').textContent=state.username;
    updatePlayerCount();$('chat-log').innerHTML='';$('chat-input').focus();
    state.buildMode=false;
    if($('build-toggle')){$('build-toggle').textContent='OFF';$('build-toggle').classList.remove('active');}
    state.canvas.style.cursor='default';
    // Init mode
    const mode=MODES[state.template];
    if(mode&&mode.init) mode.init();
}
function leaveGame(){
    state.players={};state.blocks={};state.isHost=false;state.roomCode=null;
    state.playerId=null;state.buildMode=false;state.modeState={};
    showScreen('lobby');socket.emit('get_rooms');
}
function updatePlayerCount(){const c=Object.keys(state.players).length;$('player-count-display').textContent=c+' online';}

// === GAME LOOP ===
function update(dt){
    if(state.screen!=='game'||!state.playerId) return;
    const me=state.players[state.playerId];
    if(!me) return;
    const mode=MODES[state.template];
    if(mode&&mode.update) mode.update(dt,me);
}
function render(ctx){
    if(state.screen!=='game') return;
    const mode=MODES[state.template];
    ctx.clearRect(0,0,WORLD_W,WORLD_H);
    ctx.fillStyle=state.bgColor;ctx.fillRect(0,0,WORLD_W,WORLD_H);
    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
    for(let x=0;x<=WORLD_W;x+=GRID){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_H);ctx.stroke();}
    for(let y=0;y<=WORLD_H;y+=GRID){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_W,y);ctx.stroke();}
    // Blocks
    const skipBlocks=mode&&mode.renderBlocks===false;
    const scrollBlocks=mode&&mode.renderBlocks==='scroll';
    if(!skipBlocks){
        const sx=scrollBlocks?(state.modeState.scrollX||0):0;
        for(const bid in state.blocks){
            const b=state.blocks[bid];
            let bx=b.grid_x*GRID-sx,by=b.grid_y*GRID;
            if(scrollBlocks&&(bx+GRID<0||bx>WORLD_W)) continue;
            ctx.fillStyle=b.color;
            ctx.fillRect(bx,by,GRID-1,GRID-1);
            ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.strokeRect(bx,by,GRID-1,GRID-1);
        }
    }
    // Hover
    if(state.buildMode&&state.hoverGridX>=0&&state.hoverGridY>=0){
        const gx=state.hoverGridX*GRID,gy=state.hoverGridY*GRID;
        ctx.fillStyle=state.buildAction==='place'?'rgba(108,140,255,0.25)':'rgba(255,80,80,0.25)';
        ctx.fillRect(gx,gy,GRID-1,GRID-1);
        ctx.strokeStyle=state.buildAction==='place'?'rgba(108,140,255,0.6)':'rgba(255,80,80,0.6)';
        ctx.lineWidth=2;ctx.strokeRect(gx,gy,GRID-1,GRID-1);ctx.lineWidth=0.5;
    }
    // Players (render custom for snake mode, standard for others)
    if(state.template!=='snake'){
        for(const pid in state.players){
            const p=state.players[pid],isMe=pid===state.playerId;
            if(state.template==='x_o'||state.template==='tiles'||state.template==='battleship'||state.template==='racer') continue;
            ctx.fillStyle=isMe?'#fff':'#aaa';
            ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
            ctx.fillText(p.username,p.x+PS/2,p.y-6);
            const r=5,ax=p.x,ay=p.y,aw=PS,ah=PS;
            ctx.beginPath();
            ctx.moveTo(ax+r,ay);ctx.lineTo(ax+aw-r,ay);
            ctx.quadraticCurveTo(ax+aw,ay,ax+aw,ay+r);
            ctx.lineTo(ax+aw,ay+ah-r);ctx.quadraticCurveTo(ax+aw,ay+ah,ax+aw-r,ay+ah);
            ctx.lineTo(ax+r,ay+ah);ctx.quadraticCurveTo(ax,ay+ah,ax,ay+ah-r);
            ctx.lineTo(ax,ay+r);ctx.quadraticCurveTo(ax,ay,ax+r,ay);
            ctx.closePath();
            ctx.fillStyle=p.color;ctx.fill();
            ctx.strokeStyle=isMe?'#fff':'rgba(255,255,255,0.2)';ctx.lineWidth=2;ctx.stroke();
            if(p.speech){
                const elapsed=Date.now()-p.speech.timestamp;
                if(elapsed<SPEECH_DUR) renderSpeechBubble(ctx,p);
                else p.speech=null;
            }
        }
    }
    // Mode-specific rendering
    if(mode&&mode.render) mode.render(ctx);
    if(mode&&mode.renderOverlay) mode.renderOverlay(ctx);
}
function renderSpeechBubble(ctx,p){
    const cx=p.x+PS/2,by=p.y-14,pad=8,maxW=180;
    if(p.speech.type==='text'){
        ctx.font='13px sans-serif';
        const tw=Math.min(ctx.measureText(p.speech.text).width,maxW),bw=tw+pad*2,bh=28;
        ctx.fillStyle='rgba(30,30,40,0.92)';ctx.strokeStyle='#2a2a3a';ctx.lineWidth=1;
        roundRect(ctx,cx-bw/2,by-bh,bw,bh,6);ctx.fill();ctx.stroke();
        ctx.fillStyle='rgba(30,30,40,0.92)';
        ctx.beginPath();ctx.moveTo(cx-5,by);ctx.lineTo(cx,by+7);ctx.lineTo(cx+5,by);ctx.closePath();ctx.fill();
        ctx.fillStyle='#e0e0e0';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(p.speech.text,cx,by-bh/2);
    } else if(p.speech.type==='image'){
        const s=64,bw=s+pad*2,bh=s+pad*2;
        ctx.fillStyle='rgba(30,30,40,0.92)';ctx.strokeStyle='#2a2a3a';ctx.lineWidth=1;
        roundRect(ctx,cx-bw/2,by-bh,bw,bh,6);ctx.fill();ctx.stroke();
        const img=state.imageCache[p.speech.url];
        if(img&&img.complete){ctx.save();ctx.beginPath();roundRect(ctx,cx-s/2,by-bh+pad,s,s,4);ctx.clip();ctx.drawImage(img,cx-s/2,by-bh+pad,s,s);ctx.restore();}
        else{ctx.fillStyle='#555';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Image',cx,by-bh/2);}
    }
}
function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// === CANVAS ===
function handleCanvasMove(e,canvas){
    const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;
    const mx=(e.clientX-rect.left)*sx,my=(e.clientY-rect.top)*sy;
    state.hoverGridX=Math.floor(mx/GRID);state.hoverGridY=Math.floor(my/GRID);
}
function handleCanvasClick(e,canvas){
    const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;
    const mx=(e.clientX-rect.left)*sx,my=(e.clientY-rect.top)*sy;
    // Mode-specific click
    const mode=MODES[state.template];
    if(mode&&mode.handleClick){mode.handleClick(mx,my);return;}
    // Build mode
    if(!state.buildMode||!state.isHost) return;
    const gx=Math.floor(mx/GRID),gy=Math.floor(my/GRID);
    if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;
    if(state.buildAction==='place') socket.emit('place_block',{grid_x:gx,grid_y:gy,color:state.buildColor});
    else socket.emit('remove_block',{grid_x:gx,grid_y:gy});
}

// === CHAT ===
function sendChat(){const i=$('chat-input'),t=i.value.trim();if(!t)return;socket.emit('chat_message',{text:t});i.value='';i.focus();}
function sendImage(){const i=$('img-input'),u=i.value.trim();if(!u)return;socket.emit('chat_image',{url:u});i.value='';i.focus();}
function addChatMessage(d){const l=$('chat-log'),div=document.createElement('div');div.className='chat-msg';
    div.innerHTML=`<span class="chat-name" style="color:${d.color}">${esc(d.username)}</span><span class="chat-text">${esc(d.text)}</span>`;
    l.appendChild(div);l.scrollTop=l.scrollHeight;}
function addImageMessage(d){const l=$('chat-log'),div=document.createElement('div');div.className='chat-msg';
    div.innerHTML=`<span class="chat-name" style="color:${d.color}">${esc(d.username)}</span><img class="chat-img" src="${esc(d.url)}" alt="Image" onerror="this.style.display='none'">`;
    l.appendChild(div);l.scrollTop=l.scrollHeight;}
function addSystemMessage(t){const l=$('chat-log'),div=document.createElement('div');div.className='chat-system';div.textContent=t;l.appendChild(div);l.scrollTop=l.scrollHeight;}
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}

// === START ===
document.addEventListener('DOMContentLoaded',()=>{
    const canvas=$('game-canvas'),ctx=canvas.getContext('2d');
    setupSocketEvents();setupUI(canvas,ctx);
    state.lastTime=performance.now();
    function loop(now){const dt=(now-state.lastTime)/1000;state.lastTime=now;update(dt);render(ctx);requestAnimationFrame(loop);}
    requestAnimationFrame(loop);
});
