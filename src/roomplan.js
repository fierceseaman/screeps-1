let u = require("utils")
let template = require("template")
let rM = require("remoteMiner")

let p = {
    frequency: 2000,

    findRooms: function() {
        if (!p.newRoomNeeded()) {
            return
        }
        let rooms = p.getAllRoomsInRange()
        let validRooms = p.getValidRooms(rooms)
        let rankings = p.sortByScore(validRooms)
        if (rankings.length) {
            p.addRoom(rankings[0])
        }
        return
    },

    planRooms: function() {
        // TODO

        // 1. for rooms I own. If room has a spawn or a plan, ignore. otherwise plan.
        // 2. if bucket is less than 3k, return
        // 

    },

    buildConstructionSites: function() {
        let firstRoom = Object.keys(Game.rooms).length == 1

        Object.keys(Game.rooms).forEach((roomName) => {
            var room = Game.rooms[roomName]
            if (firstRoom && !room.memory.plan) {
                let spawnPos = Game.spawns[roomName + "0"].pos
                room.memory.plan = {}
                room.memory.plan.x = spawnPos.x - 5 // TODO get these values from the template
                room.memory.plan.y = spawnPos.y - 3
            }

            if(Game.flags.plan && Game.flags.plan.pos.roomName == roomName && room.controller.owner && room.controller.owner.username == "Yoner"){
                room.memory.plan = {}
                room.memory.plan.x = Game.flags.plan.pos.x
                room.memory.plan.y = Game.flags.plan.pos.y
                Game.flags.plan.remove();
                p.clearAllStructures(room);
            }
            if (room.memory.plan) {
                var plan = room.memory.plan
                var spawnCount = 0
                _.forEach(template.buildings, function(locations, structureType) {
                    locations.pos.forEach(location => {
                        var pos = {"x": plan.x + location.x - template.offset.x, 
                                   "y": plan.y + location.y - template.offset.y}
                        var name = roomName + spawnCount
                        spawnCount = structureType == STRUCTURE_SPAWN ? spawnCount + 1 : spawnCount
                        if (Game.cpu.getUsed() + 20 > Game.cpu.tickLimit) {
                            return
                        }
                        p.buildConstructionSite(room, structureType, pos, name)
                    })
                })
                p.buildRoads(room, plan);
                if(room.controller.level >= 7){
                    p.buildWalls(room, plan);
                    p.buildSourceLinks(room)
                }
            }
        })
    },

    buildConstructionSite: function(room, structureType, pos, name) {
        //console.log(room.lookAt(pos.x, pos.y)[0].type)
        let look = room.lookAt(pos.x, pos.y)
        if(room.controller.level < 5 && structureType == STRUCTURE_TERMINAL){
            structureType = STRUCTURE_CONTAINER
        } else if(structureType == STRUCTURE_TERMINAL){
            let struct = _.find(look, object => object.type == 'structure')
            if(struct && struct.structure.structureType == STRUCTURE_CONTAINER){
                struct.structure.destroy()
            }
        }
        if (look.length == 1) {
            //console.log("hi")
            room.createConstructionSite(pos.x, pos.y, structureType, name)
        }
    },

    buildWalls: function(room, plan){
        //first identify all locations to be walled, if there is a road there, place a rampart instead. if there is a terrain wall don't make anything
        let startPoint = new RoomPosition(plan.x - 3, plan.y - 3, room.name)
        let wallSpots = []
        for(let i = startPoint.x; i < startPoint.x + 19; i++){//walls are 19 by 17
            let location = new RoomPosition(i, startPoint.y, room.name)
            let location2 = new RoomPosition(i, startPoint.y + 16, room.name)
            wallSpots.push(location)
            wallSpots.push(location2)
        }
        for(let i = startPoint.y; i < startPoint.y + 17; i++){//walls are 19 by 17
            let location = new RoomPosition(startPoint.x, i, room.name)
            let location2 = new RoomPosition(startPoint.x + 18, i, room.name)
            wallSpots.push(location)
            wallSpots.push(location2)
        }
        const terrain = new Room.Terrain(room.name);

        let costs = new PathFinder.CostMatrix();
        _.forEach(wallSpots, function(wallSpot) {//CM of just walls
            costs.set(wallSpot.x, wallSpot.y, 0xff)
        })
        room.wallCosts = costs;

        let roomExits = p.getRoomExits(room.name);//list of list of room exits
        let counter = 0;
        let csites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if(csites.length){
            counter = csites.length;
        }

        for(let i = 0; i < wallSpots.length; i++){//build stuff
            if(terrain.get(wallSpots[i].x, wallSpots[i].y) === TERRAIN_MASK_WALL){
                continue;
            }
            let structures = room.lookForAt(LOOK_STRUCTURES, wallSpots[i])
            let wall = false;
            for(let j = 0; j < structures.length; j++){
                if(structures[j].structureType === STRUCTURE_WALL || structures[j].structureType === STRUCTURE_RAMPART){
                    wall = true;
                    break;
                }
            }
            if(wall){
                continue;
            }
            //if we make it here, no wall or rampart has been placed on this spot
            //first we will check to see if we even need a barrier
            //then, if we do need one, it'll be a ramp if structures.length, else it'll be a wall

            //check by attempting to path to all exits
            let wallNeeded = false;
            for(let j = 0; j < roomExits.length; j++){
                if(roomExits[j].length){
                    //we only need to path to one of the exit points (it does not matter which one)
                    let origin = new RoomPosition(wallSpots[i].x, wallSpots[i].y, room.name)
                    let path = PathFinder.search(origin, roomExits[j][0], {
                        plainCost: 1,
                        swampCost: 1,
                        maxOps: 1000,
                        maxRooms: 1,
                        roomCallback: function(roomName) {
                            return Game.rooms[roomName].wallCosts;
                        }
                    })
                    //if path is complete, we need a wall
                    if(!path.incomplete){
                        wallNeeded = true;
                        break;
                    }
                }
            }
            if(!wallNeeded){//at this point we will not build a wall if a path cannot be achieved outside anyway
                continue;
            }

            //now we need a wall
            if(structures.length){//rampart
                room.createConstructionSite(wallSpots[i], STRUCTURE_RAMPART)
                room.visual.circle(wallSpots[i], {fill: 'transparent', radius: 0.25, stroke: 'green'});
            } else {//wall
                room.createConstructionSite(wallSpots[i], STRUCTURE_WALL)
                room.visual.circle(wallSpots[i], {fill: 'transparent', radius: 0.25, stroke: 'blue'});
            }
            counter++
            if(counter > 10){
                break
            }
        }
    },

    buildSourceLinks: function(room) {
        let sources = room.find(FIND_SOURCES)
        let neighbors = _.find(sources, p.tooCloseToSource)
        if (neighbors != undefined) {  // sources are next to eachother.
            console.log("Sources are next to each other in: " + room.name)
            return
        }

        _.forEach(sources, source => {
            if (p.sourceHasLink(source)) {
                return // We already have links
            }

            let creeps = source.pos.findInRange(FIND_MY_CREEPS, 3)
            let miners = _.filter(creeps, creep => creep.memory.role == rM.name)
            if (miners.length != 1) {
                console.log("Wrong number of miners near source: " + room.name)
                return
            }

            console.log("Building link: " + room.name)
            p.buildSourceLink(room, miners[0])
        })
    },

    buildSourceLink: function(room, miner) {
        let x = miner.pos.x
        let y = miner.pos.y
        let area = room.lookAtArea(y - 1, x - 1, y + 1, x + 1)
        for (let row of Object.entries(area)) {
          let cols = row[1]
          for (let col of Object.entries(cols)) {
            let items = area[row[0]][col[0]]
            let x = Number(col[0])
            let y = Number(row[0])
            if (items.length == 1 &&
                room.getTerrain().get(x, y) != TERRAIN_MASK_WALL) {
                room.createConstructionSite(x, y, STRUCTURE_LINK)
                return
            }
          }
        }
        // find empty square next to miner. lookAt all positions around miner
        // check they have only creeps or terrain(not terrain wall)
    },

    tooCloseToSource: function(source) {
        return source.pos.findInRange(FIND_SOURCES, 3).length > 1
    },

    sourceHasLink: function(source) {
        let links = source.pos.findInRange(FIND_MY_STRUCTURES, 3, {
                filter: { structureType: STRUCTURE_LINK }
        })
        return links.length > 0
    },

    makeRoadMatrix: function(room, plan){
        let costs = new PathFinder.CostMatrix();
        _.forEach(template.buildings, function(locations, structureType) {//don't make roads anywhere that a structure needs to go
            locations.pos.forEach(location => {
                var pos = {"x": plan.x + location.x - template.offset.x, 
                           "y": plan.y + location.y - template.offset.y}
                if(structureType !== STRUCTURE_ROAD){
                    costs.set(pos.x, pos.y, 0xff)
                }
            })
        })
        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                // Favor roads over plain tiles
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                        (struct.structureType !== STRUCTURE_WALL) && //allow roads on walls so that path to controller still works
                         (struct.structureType !== STRUCTURE_RAMPART)) {
                // Can't walk through non-walkable buildings
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            } else if(!struct.my){//allow roads on walls so that path to controller still works
                costs.set(struct.pos.x, struct.pos.y, 5);
            }
        });
        room.find(FIND_MY_CONSTRUCTION_SITES).forEach(function(site) {
            if (site.structureType === STRUCTURE_ROAD) {
                // Favor roads over plain tiles
                costs.set(site.pos.x, site.pos.y, 1);
            }
        });
        return costs;
    },

    getSourcePaths: function(room, exits, roadMatrix){
        const sources = Object.keys(Game.spawns[room.memory.city].memory.sources)
        let sourcePaths = []
        for (var i = 0; i < sources.length; i++) {
            let sourcePos = Game.getObjectById(sources[i]).pos;
            let sourcePath = PathFinder.search(sourcePos, exits, {
                plainCost: 4, swampCost: 4, maxRooms: 1, 
                roomCallback: () => roadMatrix
            })
            for(var j = 0; j < sourcePath.path.length; j++){
                sourcePaths.push(sourcePath.path[j]);
            }
        }
        return sourcePaths.reverse()
    },

    getMineralPath: function(room, exits, roadMatrix){
        const mineralPos = room.find(FIND_MINERALS)[0].pos;
        let mineralPath = PathFinder.search(mineralPos, exits, {
            plainCost: 4, swampCost: 4, maxRooms: 1, 
            roomCallback: () => roadMatrix
        })
        return mineralPath.path.reverse()
    },

    getControllerPath: function(room, exits, roadMatrix){
        let path = []
        const structures = room.find(FIND_MY_STRUCTURES);
        const controller = _.find(structures, structure => structure.structureType === STRUCTURE_CONTROLLER);
        const controllerPos = controller.pos;
        let controllerPath = PathFinder.search(controllerPos, exits, {
            plainCost: 4, swampCost: 4, maxRooms: 1, 
            roomCallback: () => roadMatrix
        })
        for(var i = 2; i < controllerPath.path.length; i++){// don't include first two paths (not needed)
            path.push(controllerPath.path[i]);
        } 
        return path.reverse()
    },

    getExitPaths: function(room, exits, plan, roadMatrix){
        let roomExits = p.getRoomExits(room.name);
        let path = [];

        let startPoint = template.buildings.storage.pos[0];
        let startPos = new RoomPosition(plan.x + startPoint.x - template.offset.x, plan.y + startPoint.y - template.offset.y, room.name)
        for(var i = 0; i < 4; i++){//find closest Exit point for each side and then path to it
            if(roomExits[i].length){
                let exitPath0 = PathFinder.search(startPos, roomExits[i], {
                    plainCost: 4, swampCost: 4, maxRooms: 1, 
                    roomCallback: () => roadMatrix
                })
                let exitPoint = exitPath0.path[exitPath0.path.length - 1];
                //now path from this point to template exits
                let exitPath = PathFinder.search(exitPoint, exits, {
                    plainCost: 4, swampCost: 4, maxRooms: 1, 
                    roomCallback: () => roadMatrix
                })
                let exitPathPath = exitPath.path
                exitPathPath.reverse()
                for(var j = 0; j < Math.min(exitPath.path.length, 4); j++){
                    path.push(exitPath.path[j]);
                }
            }
        }
        return path
    },

    compileRoads: function(a, b, c, d){
        return a.concat(b, c, d)
    },

    buildRoads: function(room, plan){
        //need roads to sources, mineral, controller (3 spaces away), exits (nearest exit point for each)
        if(!(room.memory.city && Game.spawns[room.memory.city] && Game.spawns[room.memory.city].memory.sources)){
            return;
        }
        let exits = [];
        for(let i = 0; i < template.exits.length; i++){
            let posX = plan.x + template.exits[i].x - template.offset.x;
            let posY = plan.y + template.exits[i].y - template.offset.y;
            let roomPos = new RoomPosition(posX, posY, room.name)
            exits.push(roomPos);
        }//exits now filled with roomPos of all exits from template

        //generateCM
        const roadMatrix = p.makeRoadMatrix(room, plan);

        //roads from sources
        const sourcePaths = p.getSourcePaths(room, exits, roadMatrix)

        //road from mineral
        const mineralPath = p.getMineralPath(room, exits, roadMatrix)

        //road from controller
        const controllerPath = p.getControllerPath(room, exits, roadMatrix)

        //roads from exits
        const exitPaths = p.getExitPaths(room, exits, plan, roadMatrix)

        //push all paths onto big list
        const roads = p.compileRoads(sourcePaths, mineralPath, controllerPath, exitPaths)
        
        //place Csites
        let counter = 0;
        let csites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if(csites.length){
            counter = csites.length;
        }
        for(let i = 0; i < roads.length; i++){
            room.visual.circle(roads[i], {fill: '#ff1111', radius: 0.1, stroke: 'red'});
            if(counter < 20){//doesn't update during the tick
                let look = room.lookForAt(LOOK_STRUCTURES, roads[i])
                if(look.length){
                    continue
                }
                if(!room.createConstructionSite(roads[i], STRUCTURE_ROAD)){
                    counter++
                }
            }
        }
        //TODO: cut this function up, plan and build walls + ramparts, limit number of roads total using static or global, make this happen less frequently
    },

    clearAllStructures: function(room) {
        let structures = room.find(FIND_STRUCTURES);
        _.forEach(structures, structure => {
            if(!structure.my){
                structure.destroy();
            }
        })
    },

    getRoomExits: function(roomName){
        const terrain = Game.map.getRoomTerrain(roomName)
        let nExits = []
        let sExits = []
        let eExits = []
        let wExits = []
        for(let i = 0; i < 50; i++){
            if(terrain.get(0,i) !== TERRAIN_MASK_WALL){
                let pos = new RoomPosition(0, i, roomName)
                wExits.push(pos)
            }
        }
        for(let i = 0; i < 50; i++){
            if(terrain.get(i,0) !== TERRAIN_MASK_WALL){
                let pos = new RoomPosition(i, 0, roomName)
                nExits.push(pos)
            }
        }
        for(let i = 0; i < 50; i++){
            if(terrain.get(49,i) !== TERRAIN_MASK_WALL){
                let pos = new RoomPosition(49, i, roomName)
                eExits.push(pos)
            }
        }
        for(let i = 0; i < 50; i++){
            if(terrain.get(i,49) !== TERRAIN_MASK_WALL){
                let pos = new RoomPosition(i, 49, roomName)
                sExits.push(pos)
            }
        }
        return [nExits, sExits, eExits, wExits];
    },

    planRoom: function(roomName) {
        // TODO
        // var room = Game.rooms[roomName]
        var ter = Game.map.getRoomTerrain(roomName)
        var sqd = Array(50).fill().map(() => Array(50))
        var i, j;
        for (i = 0; i < 50; i++) {
            for (j = 0; j < 50; j++) {
                sqd[i][j] = ter.get(i, j) == TERRAIN_MASK_WALL ? 0 : 
                    i < 2 || i > 47 || j < 2 || j > 47 ? 0 : 
                    Math.min(sqd[i - 1][j], sqd[i][j - 1], sqd[i - 1][j - 1]) + 1
            }
        }
        
        for (i = 47; i >= 2; i--) {
            for (j = 2; j <= 47; j++) {
                sqd[i][j] = Math.min(sqd[i][j], Math.min(sqd[i + 1][j], sqd[i + 1][j - 1]) + 1)
            }
        }
        
        for (i = 47; i >= 2; i--) {
            for (j = 47; j >= 2; j--) {
                sqd[i][j] = Math.min(sqd[i][j], Math.min(sqd[i + 1][j + 1], sqd[i][j + 1]) + 1)
            }
        }
        
        for (i = 2; i <= 47; i++) {
            for (j = 47; j >= 2; j--) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i - 1][j + 1] + 1)
            }
        }
        
        for (i = 0; i < 50; i++) {
            for (j = 0; j < 50; j++) {
                if (sqd[i][j] > 6) {
                    //console.log(i, j)--- save i & j as "planned"
                    //return
                }
                //var hex = sqd[i][j].toString(16)
                //room.visual.text(sqd[i][j], i, j, {color: "#" + "00" + hex + hex + hex + hex})
            }
        }
    },

    newRoomNeeded: function() {    
        return (Game.time % p.frequency === 0) &&
            (Game.gcl.level > p.roomsSelected.length) &&
            p.hasCpu() &&
            p.totalEnergy() > 200000 &&
            p.isRcl4() &&
            p.myRooms().length === p.roomsSelected().length
    },

    getAllRoomsInRange: function() {
        let d = 10
        let myRooms = p.roomsSelected()
        let pos = _.map(myRooms, p.roomNameToPos)
        let posXY = _.unzip(pos);
        let ranges = _.map(posXY, coords => _.range(_.min(coords) - d, _.max(coords) + 1 + d))
        let roomCoords = _.flatten(_.map(ranges[0], x => _.map(ranges[1], y => [x, y])))
        let roomNames = _.map(roomCoords, p.roomPosToName)
        return roomNames
    },

    roomNameToPos: function(roomName) {
        let quad = roomName.match(/[NSEW]/g)
        let coords = roomName.match(/[0-9]+/g)
        let x = Number(coords[0])
        let y = Number(coords[1])
        return [
            quad[0] === 'W' ? 0 - x : 1 + x,
            quad[1] === 'S' ? 0 - y : 1 + y
        ]
    },

    roomPosToName: function(roomPos) {
        let x = roomPos[0]
        let y = roomPos[1]
        return (x <= 0 ? "W" + String(-x) : "E" + String(x - 1)) +
            (y <= 0 ? "S" + String(-y) : "N" + String(y - 1))
    },

    getValidRooms: function(rooms) {
        return _.filter(rooms, p.isValidRoom)
    },

    isValidRoom: function(roomName) {
        if (!Game.map.isRoomAvailable(roomName)) return false
        return false
    },

    sortByScore: function(rooms) {
        return rooms // TODO
    },

    addRoom: function(room) {
        let selected = p.roomsSelected()
        selected.push(room.name)
    },

    roomsSelected: function() {
        let selected = Memory.rooms.selected
        if (!selected) {
            selected = p.myRoomNames()
            Memory.rooms.selected = selected
        }
        return selected
    },

    isRcl4: function() {
        let rooms = p.myRooms();
        let rcls = _.map(rooms, (room) => room.controller.level)
        return _.max(rcls) >= 4;
    },

    totalEnergy: function() {
        let rooms = p.myRooms();
        let energy = _.map(rooms, p.getStorageEnergy)
        return _.sum(energy)
    },

    getStorageEnergy: function(room) {
        return room.storage ? room.storage.store.energy : 0
    },

    myRooms: function() {
        return _.filter(Game.rooms, (room) => u.iOwn(room.name))
    },

    myRoomNames: function() {
        return _.map(p.myRooms(), (room) => room.name)
    },

    hasCpu: function () {
        let used = Memory.stats['cpu.getUsed']
        return (used !== undefined) && (used < Game.cpu.tickLimit / 2)
    }
}

module.exports = p
