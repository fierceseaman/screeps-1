var a = require("../lib/actions")
var sq = require("../lib/spawnQueue")

var rM = {
    name: "remoteMiner",
    type: "miner",

    /** @param {Creep} creep **/
    run: function(creep) {
        // Use the spawn queue to set respawn at 20 ttl
        if(creep.ticksToLive == 20 && Game.spawns[creep.memory.city].memory.remoteMiner > 0) {
            sq.respawn(creep)
        }
        if(creep.hits < creep.hitsMax){
            Game.spawns[creep.memory.city].memory.towersActive = true
            creep.moveTo(Game.spawns[creep.memory.city])
            return
        }
        if(creep.memory.source == null) {
            rM.nextSource(creep)
        } else if (Game.getObjectById(creep.memory.source) == null){
            creep.moveTo(new RoomPosition(25, 25, creep.memory.sourceRoom), {reusePath: 50}) 
        } else {
            if (creep.saying != "*"){
                rM.harvestTarget(creep)
            }
            if (Game.time % 50 === 0){
                if (Game.spawns[creep.memory.city].room.controller.level >= 6){
                    if (!creep.memory.link){
                        //find link
                        var source = Game.getObjectById(creep.memory.source)
                        var structures = creep.room.find(FIND_MY_STRUCTURES)
                        const links = _.filter(structures, structure => structure.structureType === STRUCTURE_LINK && structure.pos.inRangeTo(source.pos, 3))
                        //Log.info(link)
                        if (links.length > 1){
                            creep.memory.link = source.pos.findClosestByRange(links).id
                        } else if(links.length){
                            creep.memory.link = links[0].id
                        }
                    }
                }
            }
            if (creep.memory.link){
                if (creep.store.energy == creep.store.getCapacity()){
                    const link = Game.getObjectById(creep.memory.link)
                    a.charge(creep, link)
                    if (link && link.energy >= link.energyCapacity * .5){
                        creep.say("*", true)
                    }
                }
            }
        }
    },

    harvestTarget: function(creep) {
        var source = Game.getObjectById(creep.memory.source)
        if (!((Game.time % 2 == 0) && (creep.body.length == 15) && (creep.pos.isNearTo(source.pos)))){
            a.harvest(creep, source)
        }
    },

    /** pick a target id for creep **/
    nextSource: function(creep) {
        var city = creep.memory.city
        var miners = _.filter(Game.creeps, c => c.memory.role === "remoteMiner")
        var occupied = []
        _.each(miners, function(minerInfo){
            occupied.push(minerInfo.memory.source)
        })
        var sources = Object.keys(Game.spawns[city].memory.sources)
        var openSources = _.filter(sources, Id => !occupied.includes(Id))
        //Log.info(sources)
        if (openSources.length){
            creep.memory.source = openSources[0]
            creep.memory.sourceRoom = Game.spawns[city].memory.sources[openSources[0]].roomName
        }
    }
}
module.exports = rM