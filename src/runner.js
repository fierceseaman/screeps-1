var actions = require("./actions")
var u = require("./utils")

var rR = {
    name: "runner",
    type: "runner",
    target: () => 0,

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Game.spawns[creep.memory.city].room.controller.level > 7 && Game.spawns[creep.memory.city].room.energyCapacityAvailable > 12500
                && Game.spawns[creep.memory.city].room.storage && Game.spawns[creep.memory.city].room.storage.store.energy > 50000){
            //RCL 8 mode
            if (_.sum(creep.carry) > 0){
                if (!creep.memory.location){
                    creep.memory.location = Game.spawns[creep.memory.city].room.storage.id
                }
                const target = Game.getObjectById(creep.memory.location)
                if (target && target.pos.isNearTo(creep.pos)){
                    actions.charge(creep, target)
                } else {
                    u.multiRoomMove(creep, target.pos, true)
                }
                return
            }
            //check for flag
            const flagName = creep.memory.city + "powerMine"
            const flag = Memory.flags[flagName]
            if (flag && flag.roomName !== creep.pos.roomName){
                //move to flag range 5
                u.multiRoomMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName), true)
                return
            }
            if (flag) {
                const flagPos = new RoomPosition(flag.x, flag.y, flag.roomName)
                //check for resources under flag
                const resource = Game.rooms[flag.roomName].lookForAt(LOOK_RESOURCES, flagPos)
                if (resource.length){
                    //pickup resource
                    if (creep.pickup(resource[0]) == ERR_NOT_IN_RANGE){
                        creep.moveTo(flagPos, {reusePath: 2})
                    }

                    return
                }
                const ruin = Game.rooms[flag.roomName].lookForAt(LOOK_RUINS, flagPos)
                if (ruin.length){
                    //pickup resource
                    if (creep.withdraw(ruin[0], RESOURCE_POWER) == ERR_NOT_IN_RANGE){
                        creep.moveTo(flagPos, {reusePath: 2})
                    }

                    return
                }
                //move to flag
                if (!creep.pos.inRangeTo(flagPos, 4)){
                    creep.moveTo(flagPos, {reusePath: 50}, {range: 4})
                }
                // every 50 ticks check for powerbank
                if (Game.time % 50 == 0){
                    const powerBank = Game.rooms[flag.roomName].lookForAt(LOOK_STRUCTURES, flagPos)
                    // if no powerbank, remove flag
                    if (!powerBank.length){
                        delete Memory.flags[flagName]
                    }
                }
                return
            }
            if (Game.time % 50 == 0){
                Game.spawns[creep.memory.city].memory.runner = 0
                creep.suicide()
            }
            
        }
        // notice if there's stuff next to you before wandering off!  
        if (Game.time % 2) {
            actions.notice(creep) // cost: 15% when running, so 7% now
        }

        // if there's room for more energy, go find some more
        // else find storage
        if (creep.carry.energy < 0.5 * creep.carryCapacity) {
            actions.pickup(creep)
        } else {
            // check if we are walking on sidewalk/construction, and adjust as needed.
            var myPos = creep.pos
            if (!myPos.lookFor(LOOK_STRUCTURES).length && !myPos.lookFor(LOOK_CONSTRUCTION_SITES).length) {
                // temp
                if(creep.memory.new) {
                    //Log.info("new road");
                    // myPos.createConstructionSite(STRUCTURE_ROAD); // let's build more road
                }
            }
            if (creep.memory.location && Game.getObjectById(creep.memory.location)){
                const target = Game.getObjectById(creep.memory.location)
                if (actions.charge(creep, target) == ERR_FULL) {
                    var locations = u.getTransferLocations(creep)
                    var nextLocation = u.getNextLocation(creep.memory.target, locations)
                    if (locations[nextLocation] == undefined){
                        creep.memory.location = Game.spawns[creep.memory.city].id
                    } else {
                        creep.memory.target = nextLocation
                        creep.memory.location = locations[nextLocation].id
                    }
                }
            } else {
                var targets =  u.getTransferLocations(creep)
                var bucket = targets[creep.memory.target]
                if (bucket == undefined) {
                    var city = creep.memory.city
                    bucket = Game.spawns[city]
                }
                creep.memory.location = bucket.id
                if (actions.charge(creep, bucket) == ERR_FULL) {
                    Log.info("Container Full")
                    rR.flipTarget(creep)
                }
            }
        }
    },
    flipTarget: function(creep) {
        creep.memory.target = u.getNextLocation(creep.memory.target, u.getTransferLocations(creep))
    }
    
}
module.exports = rR