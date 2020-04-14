const u = require("./utils")
const template = require("./template")
const rM = require("./remoteMiner")
const rU = require("./upgrader")

const p = {
    frequency: 2000,

    findRooms: function() {
        if (!p.newRoomNeeded()) {
            return
        }
        const rooms = u.getAllRoomsInRange(10, p.roomsSelected())
        const validRooms = p.getValidRooms(rooms)
        const rankings = p.sortByScore(validRooms)
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
        const firstRoom = Object.keys(Game.rooms).length == 1

        Object.keys(Game.rooms).forEach((roomName) => {
            var room = Game.rooms[roomName]
            if (firstRoom && !room.memory.plan) {
                const spawnPos = Game.spawns[roomName + "0"].pos
                room.memory.plan = {}
                room.memory.plan.x = spawnPos.x - 5 // TODO get these values from the template
                room.memory.plan.y = spawnPos.y - 3
            }

            const planFlag = Memory.flags.plan
            if(planFlag && planFlag.roomName == roomName && room.controller.owner && room.controller.owner.username == "Yoner"){
                room.memory.plan = {}
                room.memory.plan.x = planFlag.x
                room.memory.plan.y = planFlag.y
                delete Memory.flags.plan
                p.clearAllStructures(room)
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
                p.buildRoads(room, plan)
                if (room.controller.level >= 6) {
                    p.buildExtractor(room)
                }
                if (room.controller.level >= 7){
                    p.buildWalls(room, plan)
                    p.buildSourceLinks(room)
                    p.buildControllerLink(room)
                }
            }
        })
    },

    buildConstructionSite: function(room, structureType, pos, name) {
        //Log.info(room.lookAt(pos.x, pos.y)[0].type)
        const look = room.lookAt(pos.x, pos.y)
        if(room.controller.level < 5 && structureType == STRUCTURE_TERMINAL){
            structureType = STRUCTURE_CONTAINER
        } else if(structureType == STRUCTURE_TERMINAL){
            const struct = _.find(look, object => object.type == "structure")
            if(struct && struct.structure.structureType == STRUCTURE_CONTAINER){
                struct.structure.destroy()
            }
        }
        if (look.length == 1) {
            //Log.info("hi")
            room.createConstructionSite(pos.x, pos.y, structureType, name)
        }
    },

    buildExtractor: function(room) {
        const minerals = room.find(FIND_MINERALS)
        if (!minerals) {
            return
        }

        const mineralPos = minerals[0].pos
        if (mineralPos.lookFor(LOOK_STRUCTURES).length > 0) {
            return
        }

        Log.info("Building extractor: " + room.name)
        mineralPos.createConstructionSite(STRUCTURE_EXTRACTOR)
    },

    buildWalls: function(room, plan){
        //first identify all locations to be walled, if there is a road there,
        //place a rampart instead. if there is a terrain wall don't make anything
        const startX = plan.x - 3
        const startY = plan.y - 3
        const wallSpots = []
        for(let i = startX; i < startX + 19; i++){//walls are 19 by 17
            if(i > 0 && i < 49){
                if(startY > 0 && startY < 49){
                    wallSpots.push(new RoomPosition(i, startY, room.name))
                }
                if(startY + 16 > 0 && startY + 16 < 49){
                    wallSpots.push(new RoomPosition(i, startY + 16, room.name))
                }
            }
        }
        for(let i = startY; i < startY + 17; i++){//walls are 19 by 17
            if(i > 0 && i < 49){
                if(startX > 0 && startX < 49){
                    wallSpots.push(new RoomPosition(startX, i, room.name))
                }
                if(startX + 18 > 0 && startX + 18 < 49){
                    wallSpots.push(new RoomPosition(startX + 18, i, room.name))
                }
            }  
        }
        const terrain = new Room.Terrain(room.name)

        const costs = new PathFinder.CostMatrix()
        _.forEach(wallSpots, function(wallSpot) {//CM of just walls
            costs.set(wallSpot.x, wallSpot.y, 0xff)
        })
        room.wallCosts = costs

        const roomExits = p.getRoomExits(room.name)//list of list of room exits
        let counter = 0
        const csites = room.find(FIND_MY_CONSTRUCTION_SITES)
        if(csites.length){
            counter = csites.length
        }

        for(let i = 0; i < wallSpots.length; i++){//build stuff
            if(terrain.get(wallSpots[i].x, wallSpots[i].y) === TERRAIN_MASK_WALL){
                continue
            }
            const structures = room.lookForAt(LOOK_STRUCTURES, wallSpots[i])
            let wall = false
            for(let j = 0; j < structures.length; j++){
                if(structures[j].structureType === STRUCTURE_WALL || structures[j].structureType === STRUCTURE_RAMPART){
                    wall = true
                    break
                }
            }
            if(wall){
                continue
            }
            //if we make it here, no wall or rampart has been placed on this spot
            //first we will check to see if we even need a barrier
            //then, if we do need one, it'll be a ramp if structures.length, else it'll be a wall

            //check by attempting to path to all exits
            let wallNeeded = false
            for(let j = 0; j < roomExits.length; j++){
                if(roomExits[j].length){
                    //we only need to path to one of the exit points (it does not matter which one)
                    const origin = new RoomPosition(wallSpots[i].x, wallSpots[i].y, room.name)
                    const path = PathFinder.search(origin, roomExits[j][0], {
                        plainCost: 1,
                        swampCost: 1,
                        maxOps: 1000,
                        maxRooms: 1,
                        roomCallback: function(roomName) {
                            return Game.rooms[roomName].wallCosts
                        }
                    })
                    //if path is complete, we need a wall
                    if(!path.incomplete){
                        wallNeeded = true
                        break
                    }
                }
            }
            if(!wallNeeded){//at this point we will not build a wall if a path cannot be achieved outside anyway
                continue
            }

            //now we need a wall
            if(structures.length || wallSpots[i].getRangeTo(room.controller) == 3){//rampart
                room.createConstructionSite(wallSpots[i], STRUCTURE_RAMPART)
                room.visual.circle(wallSpots[i], {fill: "transparent", radius: 0.25, stroke: "green"})
            } else {//wall
                room.createConstructionSite(wallSpots[i], STRUCTURE_WALL)
                room.visual.circle(wallSpots[i], {fill: "transparent", radius: 0.25, stroke: "blue"})
            }
            counter++
            if(counter > 10){
                break
            }
        }
    },

    buildControllerLink: function(room) {
        p.buildLinkInArea(room, room.controller.pos, 3, rU.name, 1)
    },

    buildSourceLinks: function(room) {
        const sources = room.find(FIND_SOURCES)
        const neighbors = _.find(sources, p.tooCloseToSource)
        if (neighbors != undefined) {  // sources are next to eachother.
            Log.info("Sources are next to each other in: " + room.name)
            return
        }

        _.forEach(sources, source => p.buildLinkInArea(room, source.pos, 1, rM.name, 1))
    },

    buildLinkInArea: function(room, structPos, creepRange, creepType, range) {
        if (p.hasLink(structPos, range + creepRange)) {
            return // We already have links
        }

        const creeps = structPos.findInRange(FIND_MY_CREEPS, creepRange)
        const workers = _.filter(creeps, creep => creep.memory.role == creepType)
        if (workers.length != 1) {
            Log.info("Wrong number of " + creepType + " for link placement: " + room.name)
            return
        }

        Log.info("Building link: " + room.name)
        const workerPos = workers[0].pos
        const wx = workerPos.x
        const wy = workerPos.y
        const area = room.lookAtArea(wy - range, wx - range, wy + range, wx + range)
        for (const row of Object.entries(area)) {
            const cols = row[1]
            for (const col of Object.entries(cols)) {
                const items = area[row[0]][col[0]]
                const x = Number(col[0])
                const y = Number(row[0])
                if (items.length == 1 && room.getTerrain().get(x, y) != TERRAIN_MASK_WALL)
                {
                    room.createConstructionSite(x, y, STRUCTURE_LINK)
                    return
                }
            }
        }
    },

    tooCloseToSource: function(source) {
        return source.pos.findInRange(FIND_SOURCES, 3).length > 1
    },

    hasLink: function(pos, distance) {
        const links = pos.findInRange(FIND_MY_STRUCTURES, distance, {
            filter: { structureType: STRUCTURE_LINK }
        })
        const newLinks = pos.findInRange(FIND_MY_CONSTRUCTION_SITES, distance, {
            filter: { structureType: STRUCTURE_LINK }
        })
        return links.length > 0 || newLinks.length > 0
    },

    makeRoadMatrix: function(room, plan){
        const costs = new PathFinder.CostMatrix()
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
                costs.set(struct.pos.x, struct.pos.y, 1)
            } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                        (struct.structureType !== STRUCTURE_WALL) && //allow roads on walls so that path to controller still works
                         (struct.structureType !== STRUCTURE_RAMPART)) {
                // Can't walk through non-walkable buildings
                costs.set(struct.pos.x, struct.pos.y, 0xff)
            } else if(!struct.my){//allow roads on walls so that path to controller still works
                costs.set(struct.pos.x, struct.pos.y, 5)
            }
        })
        room.find(FIND_MY_CONSTRUCTION_SITES).forEach(function(site) {
            if (site.structureType === STRUCTURE_ROAD) {
                // Favor roads over plain tiles
                costs.set(site.pos.x, site.pos.y, 1)
            }
        })
        return costs
    },

    getSourcePaths: function(room, exits, roadMatrix){
        const sources = Object.keys(Game.spawns[room.memory.city].memory.sources)
        const sourcePaths = []
        for (var i = 0; i < sources.length; i++) {
            const sourcePos = Game.getObjectById(sources[i]).pos
            const sourcePath = PathFinder.search(sourcePos, exits, {
                plainCost: 4, swampCost: 4, maxRooms: 1, 
                roomCallback: () => roadMatrix
            })
            for(var j = 0; j < sourcePath.path.length; j++){
                sourcePaths.push(sourcePath.path[j])
            }
        }
        return sourcePaths.reverse()
    },

    getMineralPath: function(room, exits, roadMatrix){
        const mineralPos = room.find(FIND_MINERALS)[0].pos
        const mineralPath = PathFinder.search(mineralPos, exits, {
            plainCost: 4, swampCost: 4, maxRooms: 1, 
            roomCallback: () => roadMatrix
        })
        return mineralPath.path.reverse()
    },

    getControllerPath: function(room, exits, roadMatrix){
        const path = []
        const structures = room.find(FIND_MY_STRUCTURES)
        const controller = _.find(structures, structure => structure.structureType === STRUCTURE_CONTROLLER)
        const controllerPos = controller.pos
        const controllerPath = PathFinder.search(controllerPos, exits, {
            plainCost: 4, swampCost: 4, maxRooms: 1, 
            roomCallback: () => roadMatrix
        })
        for(var i = 2; i < controllerPath.path.length; i++){// don't include first two paths (not needed)
            path.push(controllerPath.path[i])
        } 
        return path.reverse()
    },

    getExitPaths: function(room, exits, plan, roadMatrix){
        const roomExits = p.getRoomExits(room.name)
        const path = []

        const startPoint = template.buildings.storage.pos[0]
        const startPos = new RoomPosition(plan.x + startPoint.x - template.offset.x, plan.y + startPoint.y - template.offset.y, room.name)
        for(var i = 0; i < 4; i++){//find closest Exit point for each side and then path to it
            if(roomExits[i].length){
                const exitPath0 = PathFinder.search(startPos, roomExits[i], {
                    plainCost: 4, swampCost: 4, maxRooms: 1, 
                    roomCallback: () => roadMatrix
                })
                const exitPoint = exitPath0.path[exitPath0.path.length - 1]
                //now path from this point to template exits
                const exitPath = PathFinder.search(exitPoint, exits, {
                    plainCost: 4, swampCost: 4, maxRooms: 1, 
                    roomCallback: () => roadMatrix
                })
                const exitPathPath = exitPath.path
                exitPathPath.reverse()
                for(var j = 0; j < Math.min(exitPath.path.length, 4); j++){
                    path.push(exitPath.path[j])
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
            return
        }
        const exits = []
        for(let i = 0; i < template.exits.length; i++){
            const posX = plan.x + template.exits[i].x - template.offset.x
            const posY = plan.y + template.exits[i].y - template.offset.y
            const roomPos = new RoomPosition(posX, posY, room.name)
            exits.push(roomPos)
        }//exits now filled with roomPos of all exits from template

        //generateCM
        const roadMatrix = p.makeRoadMatrix(room, plan)

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
        let counter = 0
        const csites = room.find(FIND_MY_CONSTRUCTION_SITES)
        if(csites.length){
            counter = csites.length
        }
        for(let i = 0; i < roads.length; i++){
            room.visual.circle(roads[i], {fill: "#ff1111", radius: 0.1, stroke: "red"})
            if(counter < 20){//doesn't update during the tick
                const look = room.lookForAt(LOOK_STRUCTURES, roads[i])
                if(look.length){
                    if(look[0].structureType != STRUCTURE_RAMPART){
                        continue
                    }
                }
                if(!room.createConstructionSite(roads[i], STRUCTURE_ROAD)){
                    counter++
                }
            }
        }
        //TODO: cut this function up, plan and build walls + ramparts, limit number of roads total using static or global, make this happen less frequently
    },

    clearAllStructures: function(room) {
        const structures = room.find(FIND_STRUCTURES)
        _.forEach(structures, structure => {
            if(!structure.my){
                structure.destroy()
            }
        })
    },

    getRoomExits: function(roomName){
        const terrain = Game.map.getRoomTerrain(roomName)
        const nExits = []
        const sExits = []
        const eExits = []
        const wExits = []
        for(let i = 0; i < 50; i++){
            if(terrain.get(0,i) !== TERRAIN_MASK_WALL){
                const pos = new RoomPosition(0, i, roomName)
                wExits.push(pos)
            }
        }
        for(let i = 0; i < 50; i++){
            if(terrain.get(i,0) !== TERRAIN_MASK_WALL){
                const pos = new RoomPosition(i, 0, roomName)
                nExits.push(pos)
            }
        }
        for(let i = 0; i < 50; i++){
            if(terrain.get(49,i) !== TERRAIN_MASK_WALL){
                const pos = new RoomPosition(49, i, roomName)
                eExits.push(pos)
            }
        }
        for(let i = 0; i < 50; i++){
            if(terrain.get(i,49) !== TERRAIN_MASK_WALL){
                const pos = new RoomPosition(i, 49, roomName)
                sExits.push(pos)
            }
        }
        return [nExits, sExits, eExits, wExits]
    },

    planRoom: function(roomName) {
        // TODO
        const room = Game.rooms[roomName]
        const ter = Game.map.getRoomTerrain(roomName)
        const sqd = _(Array(50)).map((r, i) => { 
            return _(Array(50))
                .map((v, j) => ter.get(i, j) == TERRAIN_MASK_WALL ? 0 : Infinity)
                .value()
        }).value()
        const b = 4 // buffer
        const r = 50 // room size
        const min = b 
        const max = r - b - 1

        for (let i = min; i <= max; i++) {
            for (let j = min; j <= max; j++) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i - 1][j] + 1, sqd[i - 1][j - 1] + 1)     
            }
        }
        
        for (let i = max; i >= min; i--) {
            for (let j = min; j <= max; j++) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i][j - 1] + 1, sqd[i + 1][j - 1] + 1)
            }
        }
        
        for (let i = max; i >= min; i--) {
            for (let j = max; j >= min; j--) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i + 1][j] + 1, sqd[i + 1][j + 1] + 1)
            }
        }
        
        for (let i = min; i <= max; i++) {
            for (let j = max; j >= min; j--) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i][j + 1] + 1, sqd[i - 1][j + 1] + 1)
            }
        }

        return _(sqd).find(row => _(row).find(score => score >= 7))
    },

    newRoomNeeded: function() {    
        return (Game.time % p.frequency === 0) &&
            (Game.gcl.level > p.roomsSelected.length) &&
            p.hasCpu() &&
            p.totalEnergy() > 200000 &&
            p.isRcl4() &&
            p.myRooms().length === p.roomsSelected().length
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
        const selected = p.roomsSelected()
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
        const rooms = p.myRooms()
        const rcls = _.map(rooms, (room) => room.controller.level)
        return _.max(rcls) >= 4
    },

    totalEnergy: function() {
        const rooms = p.myRooms()
        const energy = _.map(rooms, p.getStorageEnergy)
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
        const used = Memory.stats["cpu.getUsed"]
        return (used !== undefined) && (used < Game.cpu.tickLimit / 2)
    }
}

module.exports = p
