var actions = require("./actions")
var u = require("./utils")
var sq = require("./spawnQueue")
var motion = require("./motion")

var rT = {
    name: "transporter",
    type: "transporter",
    target: () => 0,

    /** @param {Creep} creep **/
    run: function(creep) {
        if(rT.endLife(creep)){
            return
        }
        var city = creep.memory.city
        if (creep.saying > 0){
            creep.say(creep.saying - 1)
            return
        }
        if (creep.store.energy == 0) {
            //refill on energy
            if(rT.refill(creep, city) === 1){
                //start moving to target
                const target = rT.findTarget(creep, null)
                if(!target){
                    creep.say(20)
                    return
                }
                if(!creep.pos.isNearTo(target.pos)){
                    motion.newMove(creep, target.pos, 1)
                }
            }
        } else {
            const target = rT.findTarget(creep, null)

            if(!target){
                creep.say(20)
                return
            }

            const result = actions.charge(creep, target)
            if(result === 1){//successful deposit
                //if creep still has energy, start moving to next target
                if(creep.store[RESOURCE_ENERGY] > target.store.getFreeCapacity(RESOURCE_ENERGY)){
                    //start moving to next target if target not already in range
                    const newTarget = rT.findTarget(creep, target)//make sure to remove current target from search list
                    if(!newTarget){
                        creep.say(20)
                        return
                    }
                    if(!newTarget.pos.isNearTo(creep.pos)){
                        motion.newMove(creep, newTarget.pos, 1)
                    }
                } else {
                    //start moving to storage already
                    rT.refill(creep, city)
                }

            }
        }
    },
 
    findTarget: function(creep, oldTarget){
        let id = 0
        if(oldTarget){
            id = oldTarget.id
        }
        return creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return structure.id !== id && rT.needsEnergy(structure)
            }
        })
    },


    needsEnergy: function(structure){
        if(!structure){
            return false
        }
        const store = structure.store
        switch(structure.structureType){
        case STRUCTURE_EXTENSION:
        case STRUCTURE_SPAWN:
        case STRUCTURE_LAB:
        case STRUCTURE_NUKER:
            //if there is any room for energy, needs energy
            return (store.getFreeCapacity(RESOURCE_ENERGY) > 0)
        case STRUCTURE_TOWER:
        case STRUCTURE_POWER_SPAWN:
            //arbitrary buffer
            return (store.getFreeCapacity(RESOURCE_ENERGY) > 400)
        case STRUCTURE_FACTORY:
            //arbitrary max value
            return (store.getUsedCapacity(RESOURCE_ENERGY) < 10000)
        default:
            return false
        }
    },

    endLife: function(creep){
        if(creep.ticksToLive == 200){
            const transporters = _.filter(creep.room.find(FIND_MY_CREEPS), c => c.memory.role == "transporter")
            if(transporters.length < 2){
                sq.respawn(creep)
            }
        }
        if(creep.ticksToLive > 10 || !creep.room.storage){
            return false
        }
        if(creep.store.getUsedCapacity() > 0){
            actions.charge(creep, creep.room.storage)
        } else {
            creep.suicide()
        }
        return true
    },

    refill: function(creep){
        let result = 0
        if (Game.getObjectById(creep.memory.location)) {
            var bucket = Game.getObjectById(creep.memory.location)
            if(creep.store.getUsedCapacity() > 0){
                if(!creep.pos.isNearTo(bucket.pos)){
                    motion.newMove(creep, bucket.pos, 1)
                }
                return result
            }
            result = actions.withdraw(creep, bucket)
            if (result == ERR_NOT_ENOUGH_RESOURCES){
                const targets = u.getWithdrawLocations(creep)
                creep.memory.target = u.getNextLocation(creep.memory.target, targets)
                if (targets[creep.memory.target]){
                    creep.memory.location = targets[creep.memory.target].id
                }
            }
        } else {
            const location = u.getStorage(creep.room)
            creep.memory.location = location.id
            if(creep.store.getUsedCapacity() > 0){
                if(!creep.pos.isNearTo(location.pos)){
                    motion.newMove(creep, location.pos, 1)
                }
                return result
            }
            result = actions.withdraw(creep, location)
        }
        return result
    }
}
module.exports = rT