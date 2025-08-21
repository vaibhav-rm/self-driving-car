const carCanvas=document.getElementById("carCanvas");
carCanvas.width=200;
const networkCanvas=document.getElementById("networkCanvas");
networkCanvas.width=600;

// global trackers
let generation = 1;
let bestScoreEver = 0;
let scoreHistory = [];


const carCtx = carCanvas.getContext("2d");
const networkCtx = networkCanvas.getContext("2d");

const statsCtx = document.getElementById("statsCanvas").getContext("2d");

const road = new Road(carCanvas.width/2,carCanvas.width*0.9);
let traffic = []
const N=500;
const cars=generateCars(N);
let bestCar=cars[0];
if(localStorage.getItem("bestBrain")){
    for(let i=0;i<cars.length;i++){
        cars[i].brain=JSON.parse(
            localStorage.getItem("bestBrain"));
        if(i!=0){
            NeuralNetwork.mutate(cars[i].brain,0.1);
        }
    }
}

// const traffic=[
//     new Car(road.getLaneCenter(1),-100,30,50,"DUMMY",2,getRandomColor()),
//     new Car(road.getLaneCenter(0),-300,30,50,"DUMMY",2,getRandomColor()),
//     new Car(road.getLaneCenter(2),-300,30,50,"DUMMY",2,getRandomColor()),
//     new Car(road.getLaneCenter(0),-500,30,50,"DUMMY",2,getRandomColor()),
//     new Car(road.getLaneCenter(1),-500,30,50,"DUMMY",2,getRandomColor()),
//     new Car(road.getLaneCenter(1),-700,30,50,"DUMMY",2,getRandomColor()),
//     new Car(road.getLaneCenter(2),-700,30,50,"DUMMY",2,getRandomColor()),
// ];

function updateTraffic(){
    // Remove cars that are far behind
    traffic = traffic.filter(car => car.y < bestCar.y + 500);

    // If not enough traffic ahead, spawn new cars
    while(traffic.length < 20){ // keep max 20 cars active
        const lane = Math.floor(Math.random() * road.laneCount);
        const lastY = Math.min(...traffic.map(c => c.y).concat([bestCar.y-200]));
        const y = lastY - 200 - Math.random() * 200;

        traffic.push(
            new Car(
                road.getLaneCenter(lane),
                y,
                30,
                50,
                "DUMMY",
                2,
                getRandomColor()
            )
        );
    }
}

function generateTraffic(count){
    const traffic=[];
    for(let i=0;i<count;i++){
        const lane=Math.floor(Math.random()*road.laneCount); // pick random lane
        const y=-100 - i*200 - Math.random()*200;  // stagger cars along the road
        traffic.push(
            new Car(
                road.getLaneCenter(lane),
                y,
                30,
                50,
                "DUMMY",
                2,
                getRandomColor()
            )
        );
    }
    return traffic;
}

animate();

function saveBestCar(){
    const data = JSON.stringify(bestCar.brain);
    const blob = new Blob([data], {type: "application/json"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "bestCarBrain.json";
    a.click();

    URL.revokeObjectURL(url);
}

function loadBestCar(event){
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(e){
        const data = JSON.parse(e.target.result);
        for(let i=0;i<cars.length;i++){
            cars[i].brain = JSON.parse(JSON.stringify(data));
            if(i!=0){
                NeuralNetwork.mutate(cars[i].brain,0.1);
            }
        }
        bestCar = cars[0];
    };
    reader.readAsText(file);
}

function save(){
    localStorage.setItem("bestBrain",
        JSON.stringify(bestCar.brain));
}

function discard(){
    localStorage.removeItem("bestBrain");
}

function generateCars(N){
    const cars=[];
    traffic = generateTraffic(20);
    for(let i=1;i<=N;i++){
        cars.push(new Car(road.getLaneCenter(1),100,30,50,"AI"));
    }
    return cars;
}

// set bigger canvas in HTML
// <canvas id="statsCanvas" width="400" height="300"></canvas>


function animate(time){
    let bestScore = -Infinity;
    updateTraffic();

    for(let i=0;i<traffic.length;i++){
        traffic[i].update(road.borders,[]);
    }
    for(let i=0;i<cars.length;i++){
        cars[i].update(road.borders,traffic);
        const score = getScore(cars[i]);
        cars[i].score = score;
        if(score > bestScore){
            bestScore = score;
            bestCar = cars[i];
        }
    }

    bestCar=cars.find(c=>c.y==Math.min(...cars.map(c=>c.y)));

    if(bestScore > bestScoreEver){
        bestScoreEver = bestScore;
    }

    carCanvas.height=window.innerHeight;
    networkCanvas.height=window.innerHeight;

    carCtx.save();
    carCtx.translate(0,-bestCar.y+carCanvas.height*0.7);

    road.draw(carCtx);
    for(let i=0;i<traffic.length;i++){
        traffic[i].draw(carCtx);
    }
    carCtx.globalAlpha=0.2;
    for(let i=0;i<cars.length;i++){
        cars[i].draw(carCtx);
    }
    carCtx.globalAlpha=1;
    bestCar.draw(carCtx,true);

    carCtx.restore();

    // === STATS HUD ===
    statsCtx.clearRect(0,0,800,600);

    // background panel
    statsCtx.fillStyle = "rgba(20,20,20,0.9)";
    statsCtx.fillRect(0,0,800,600   );

    statsCtx.strokeStyle = "white";
    statsCtx.lineWidth = 2;
    statsCtx.strokeRect(0,0,800,600);

    // Title
    statsCtx.fillStyle = "white";
    statsCtx.font = "22px Arial Black";
    statsCtx.fillText("🚗 Simulation Dashboard", 20, 35);

    // Section 1: Simulation Info
    statsCtx.font = "16px Arial";
    statsCtx.fillStyle = "lime";
    statsCtx.fillText("Generation: " + generation, 20, 70);
    statsCtx.fillText("Alive Cars: " + cars.filter(c => !c.damaged).length + "/" + cars.length, 20, 95);

    // Section 2: Performance
    statsCtx.fillStyle = "yellow";
    statsCtx.fillText("Current Score: " + Math.floor(bestCar.score), 20, 135);
    statsCtx.fillText("Best Score: " + Math.floor(bestScoreEver), 20, 160);

    // compute avg
    const aliveScores = cars.map(c => c.score);
    const avgScore = aliveScores.reduce((a,b)=>a+b,0)/aliveScores.length;
    statsCtx.fillText("Avg Score: " + Math.floor(avgScore), 20, 185);

    // Section 3: Car Status
    statsCtx.fillStyle = "cyan";
    statsCtx.fillText("Speed: " + bestCar.speed.toFixed(2) + " / " + bestCar.maxSpeed, 20, 225);

    // speed bar
    const barX=150, barY=215, barW=200, barH=15;
    statsCtx.fillStyle="gray";
    statsCtx.fillRect(barX, barY, barW, barH);
    statsCtx.fillStyle="cyan";
    const ratio = Math.max(0, bestCar.speed/bestCar.maxSpeed);
    statsCtx.fillRect(barX, barY, barW*ratio, barH);
    statsCtx.strokeStyle="white";
    statsCtx.strokeRect(barX, barY, barW, barH);

    // damage status
    statsCtx.fillStyle = bestCar.damaged ? "red" : "lime";
    statsCtx.fillText("Status: " + (bestCar.damaged ? "Crashed" : "Running"), 20, 260);

    // Section 4: Score trend (mini chart)
    scoreHistory.push(bestScore);
    if(scoreHistory.length>50) scoreHistory.shift();

    const chartX=300, chartY=70, chartW=90, chartH=80;
    statsCtx.strokeStyle="white";
    statsCtx.strokeRect(chartX, chartY, chartW, chartH);

    statsCtx.beginPath();
    statsCtx.strokeStyle="orange";
    statsCtx.moveTo(chartX, chartY+chartH);
    for(let i=0;i<scoreHistory.length;i++){
        const val = scoreHistory[i]/(bestScoreEver||1); // normalize
        const x = chartX + (i/50)*chartW;
        const y = chartY+chartH - val*chartH;
        statsCtx.lineTo(x,y);
    }
    statsCtx.stroke();

    // draw network
    networkCtx.lineDashOffset=-time/50;
    Visualizer.drawNetwork(networkCtx,bestCar.brain);

    requestAnimationFrame(animate);
}
