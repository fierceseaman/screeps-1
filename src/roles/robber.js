var actions = require("../lib/actions")
var u = require("../lib/utils")

var rRo = {
    name: "robber",
    type: "robber",

    /** @param {Creep} creep **/
    run: function(creep) {
        if (_.sum(creep.store) < 0.1 * creep.store.getCapacity()) {
            if(creep.ticksToLive < 150){
                creep.suicide()
            }
            var target = Game.getObjectById("5d86e27a2a6b4021bee17629")
            const mineral = RESOURCE_ENERGY
            if (target){
                if(!target.store[mineral]){
                    Game.notify("Robbery complete")
                    return
                }
                return actions.interact(creep, target, () => creep.withdraw(target, mineral))
            } else {
                const flag = Memory.flags["steal"]
                return creep.moveTo(new RoomPosition(flag.x, flag.y, flag.roomName), {reusePath: 50})
            }

        } else {
            actions.charge(creep, Game.spawns[creep.memory.city].room.storage)
        }
      
      
    },
    flipTarget: function(creep) {
        creep.memory.target = u.getNextLocation(creep.memory.target, u.getTransferLocations(creep))
    }
    
}
module.exports = rRo