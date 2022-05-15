let level = 2;
let buildingBoxes,points,edges,roomPoints,doorPoints,stairPoints;

let canvas,ctx,viewCanvas,viewCtx,map;

let fromFinal,toFinal,steps;
let stepIndex = 0;

let currentBox;
let nextBox = null;
let transitionTime = 0;
let realCurrentBox,realNextBox;

let drawer = Point(40,700);
let lastPoint = -1;
let keys = {}

function combinedBox(a,b) {
  let minX = Math.min(a.x,b.x);
  let maxX = Math.max(a.x + a.w,b.x + b.w);
  let minY = Math.min(a.y,b.y);
  let maxY = Math.max(a.y + a.h,b.y + b.h);
  return Rectangle(
    minX,
    minY,
    maxX - minX,
    maxY - minY
  );
}

function scaledTransitionBox(a,b,t) {
  t = Math.max(Math.min(t,1),0);
  let xd = b.x - a.x;
  let yd = b.y - a.y;
  let wd = b.w - a.w;
  let hd = b.h - a.h;
  return Rectangle(
    a.x + xd * t,
    a.y + yd * t,
    a.w + wd * t,
    a.h + hd * t,
  );
}

function calculateRealBox(b) {
  let wDim,hDim;
  if ( b.h > b.w ) {
    hDim = b.h + 40;
    wDim = hDim * (viewCanvas.width / viewCanvas.height);
  } else {
    wDim = b.w + 40;
    hDim = wDim * (viewCanvas.height / viewCanvas.width);
  }

  return Rectangle(
    b.x + (b.w / 2) - (wDim / 2),
    b.y + (b.h / 2) - (hDim / 2),
    wDim,
    hDim
  );
}

function buildingOfPoint(p) {
  for ( let i in buildingBoxes ) {
    if (
      p.x >= buildingBoxes[i].x &&
      p.y >= buildingBoxes[i].y &&
      p.x <= buildingBoxes[i].x + buildingBoxes[i].w &&
      p.y <= buildingBoxes[i].y + buildingBoxes[i].h
    ) return i;
  }
}

function clonePoint(p) { return Point(p.x,p.y); }

function getPointPath(from,to) {
  let edgeMatrix = Array.from(Array(points.length),_ => new Array(points.length).fill(0));
  let distanceMatrix = Array.from(Array(points.length),_ => new Array(points.length).fill(0));
  for ( let i = 0; i < points.length - 1; i++ ) {
    for ( let j = i + 1; j < points.length; j++ ) {
      let val = Math.hypot(points[i].x - points[j].x,points[i].y - points[j].y);
      distanceMatrix[i][j] = val;
      distanceMatrix[j][i] = val;
    }
  }
  for ( let i in edges ) {
    let edge = edges[i];
    let a = edge[0];
    let b = edge[1];
    edgeMatrix[a][b] = distanceMatrix[a][b];
    edgeMatrix[b][a] = distanceMatrix[a][b];
  }
  return aStar(edgeMatrix,distanceMatrix,from,to);
}

function distanceOfPath(path) {
  let dist = 0;
  for ( let i = 0; i < path.length - 1; i++ ) {
    dist += Math.hypot(points[path[i]].x - points[path[i + 1]].x,points[path[i]].y - points[path[i + 1]].y);
  }
  return dist;
}

function closestStaircase(origin) {
  let building = buildingOfPoint(points[origin.point]);
  let minCandidate = null;
  let minDist = Number.MAX_VALUE;
  for ( let i in stairPoints ) {
    if ( buildingOfPoint(points[stairPoints[i].point]) == building ) {
      let path = getPointPath(origin.point,stairPoints[i].point);
      let dist = distanceOfPath(path);
      if ( dist < minDist ) {
        minDist = dist;
        minCandidate = stairPoints[i];
      }
    }
  }
  return minCandidate;
}

function constructSteps() {
  let base = [fromFinal];
  let mirror = [null];

  let fromPoint = points[fromFinal.point];
  let toPoint = mapData[toFinal.level].points[toFinal.point];
  let fromBuilding = buildingOfPoint(fromPoint);
  let toBuilding = buildingOfPoint(toPoint);
  if ( fromBuilding == toBuilding ) {
    let staircase = closestStaircase(fromFinal);
    base.push({level: level,point: staircase.point});
    mirror.push({level: toFinal.level,point: staircase.paths[toFinal.level]});
  } else {
    let fromGround = fromFinal;
    if ( fromGround.level != 1 ) {
      let staircase = closestStaircase(fromFinal);
      base.push({level: level,point: staircase.point});
      mirror.push({level: 1,point: staircase.paths[1]});
      fromGround = staircase;
    }
    let toGround = toFinal;
    let toStaircase = null;
    if ( toGround.level != 1 ) {
      level = toGround.level;
      loadLevelData();

      toStaircase = closestStaircase(toFinal);
      toGround = toStaircase;
    }

    level = 1;
    loadLevelData();
    let path = getPointPath(fromGround.point,toGround.point);
    for ( let i in path ) {
      if ( doorPoints.indexOf(path[i]) > -1 ) {
        base.push({level: 1,point: path[i]});
        mirror.push(null);
      }
    }

    if ( toStaircase ) {
      base.push({level: 1,point: toStaircase.paths[1]});
      mirror.push({level: toFinal.level,point: toStaircase.point});
    }
    level = fromFinal.level;
    loadLevelData();
  }

  base.push(toFinal);
  mirror.push(null);
  return {base,mirror};
}

function redrawView() {
  ctx.drawImage(map,2,2,map.width - 2,map.height - 2,0,0,map.width,map.height);

  if ( location.search == "?drawer" ) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(drawer.x,drawer.y,5,0,Math.PI * 2);
    ctx.fill();
    if ( keys.KeyW > 0 ) drawer.y -= 5;
    if ( keys.KeyA > 0 ) drawer.x -= 5;
    if ( keys.KeyS > 0 ) drawer.y += 5;
    if ( keys.KeyD > 0 ) drawer.x += 5;
    if ( keys.Space == 1 ) {
      keys.Space = 2;
      points.push(clonePoint(drawer));
      if ( lastPoint != -1 ) edges.push([lastPoint,points.length - 1]);
      lastPoint = points.length - 1;
    }
    if ( keys.KeyZ == 1 ) {
      keys.KeyZ = 2;
      lastPoint--;
      lastPoint = Math.max(lastPoint,0);
    }
    if ( keys.KeyX == 1 ) {
      keys.KeyX = 2;
      lastPoint++;
      lastPoint = Math.min(lastPoint,points.length - 1);
    }

    ctx.font = "16px Arial";
    for ( let i in points ) {
      if ( i != lastPoint ) ctx.fillStyle = "navy";
      else ctx.fillStyle = "cyan";
      ctx.beginPath();
      ctx.arc(points[i].x,points[i].y,5,0,Math.PI * 2);
      ctx.fill();
      ctx.fillText(i,points[i].x + 5,points[i].y - 5);
    }
    for ( let i in edges ) {
      ctx.strokeStyle = "navy";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(points[edges[i][0]].x,points[edges[i][0]].y)
      ctx.lineTo(points[edges[i][1]].x,points[edges[i][1]].y);
      ctx.stroke();
    }
  }

  let boxInUse;
  if ( ! nextBox ) {
    boxInUse = currentBox;
  } else {
    boxInUse = scaledTransitionBox(realCurrentBox,realNextBox,transitionTime / 100);
    transitionTime += 5;
    if ( transitionTime >= 100 ) {
      currentBox = nextBox;
      realCurrentBox = realNextBox;
      nextBox = null;
      transitionTime = 0;
    }
  }
  viewCtx.fillStyle = "white";
  viewCtx.fillRect(0,0,viewCanvas.width,viewCanvas.height);
  let wDim,hDim;
  if ( boxInUse.h > boxInUse.w ) {
    hDim = boxInUse.h + 40;
    wDim = hDim * (viewCanvas.width / viewCanvas.height);
  } else {
    wDim = boxInUse.w + 40;
    hDim = wDim * (viewCanvas.height / viewCanvas.width);
  }

  if ( location.search != "?drawer" ) {
    let fromPoint = steps.base[stepIndex];
    if ( fromPoint.level != steps.base[stepIndex + 1].level ) fromPoint = steps.mirror[stepIndex];
    let path = getPointPath(fromPoint.point,steps.base[stepIndex + 1].point);
    ctx.strokeStyle = "red";
    ctx.lineWidth = (5 / 696) * Math.max(wDim,hDim);
    ctx.beginPath();
    ctx.moveTo(points[path[0]].x,points[path[0]].y);
    for ( let i = 1; i < path.length; i++ ) {
      ctx.lineTo(points[path[i]].x,points[path[i]].y);
    }
    ctx.stroke();

    /*let instructionText;
    if ( steps.length == 2 ) {
      instructionText = "Go to your destination";
    } else if ( steps.length == 4 ) {
      if ( stepIndex == 0 ) instructionText = `Leave ${buildingOfPoint(points[fromFinal])}`;
      else if ( stepIndex == 1 ) instructionText = `Go to ${buildingOfPoint(points[toFinal])}`;
      else instructionText = "Go to your destination";
    }
    document.getElementById("instruction").innerText = `${stepIndex + 1}. ${instructionText}`;*/
  }

  viewCtx.drawImage(
    canvas,
    boxInUse.x + (boxInUse.w / 2) - (wDim / 2),
    boxInUse.y + (boxInUse.h / 2) - (hDim / 2),
    wDim,
    hDim,
    0,
    0,
    viewCanvas.width,
    viewCanvas.height
  );
}

function moveInstruction(move) {
  if ( stepIndex <= 0 && move == -1 ) return;
  if ( stepIndex >= steps.base.length - 2 && move == 1 ) return;
  stepIndex += move;

  let quickChangeBox = false;
  let fromPoint = steps.base[stepIndex];
  let toPoint = steps.base[stepIndex + 1];
  if ( level != toPoint.level ) {
    if ( fromPoint.level != toPoint.level ) fromPoint = steps.mirror[stepIndex];
    level = toPoint.level;
    loadLevelData();
    map.src = `map_level${level}.png`;
    quickChangeBox = true;
  }

  let fromBuilding = buildingOfPoint(points[fromPoint.point]);
  let toBuilding = buildingOfPoint(points[toPoint.point]);
  nextBox = combinedBox(buildingBoxes[fromBuilding],buildingBoxes[toBuilding]);
  realNextBox = calculateRealBox(nextBox);
  if ( quickChangeBox ) {
    currentBox = nextBox;
    realCurrentBox = realNextBox;
    nextBox = null;
  }
}

function loadLevelData() {
  let levelData = mapData[level];
  buildingBoxes = levelData.buildingBoxes;
  points = levelData.points;
  edges = levelData.edges;
  roomPoints = levelData.roomPoints;
  doorPoints = levelData.doorPoints;
  stairPoints = levelData.stairPoints;
}

window.onload = _ => {
  loadLevelData();

  fromFinal = {level: 2,point: roomPoints["Baker 217"]};
  toFinal = {level: 2,point: roomPoints["Shattuck 2 Memorial Room"]};
  currentBox = buildingBoxes["Baker"];
  steps = constructSteps();

  viewCanvas = document.getElementById("viewCanvas");
  viewCtx = viewCanvas.getContext("2d");
  viewCanvas.width = window.innerWidth;
  viewCanvas.height = window.innerHeight * 0.8;
  canvas = new OffscreenCanvas(1,1);
  ctx = canvas.getContext("2d");
  map = new Image();
  map.onload = _ => {
    canvas.width = map.width;
    canvas.height = map.height;
    setInterval(redrawView,25);
  }
  map.src = `map_level${level}.png`;

  realCurrentBox = calculateRealBox(currentBox);
}

window.onkeydown = event => {
  keys[event.code] = 1;
}

window.onkeyup = event => {
  keys[event.code] = 0;
}
