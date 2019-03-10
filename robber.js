var actions = require('actions');
var t = require('types');
var u = require('utils');

var rRo = {
    name: "robber",
    type: "runner",
    target: () => 0,

    /** @param {Creep} creep **/
    run: function(creep) {
       // notice if there's stuff next to you before wandering off!  
      if (Game.time % 2) {
        actions.notice(creep); // cost: 15% when running, so 7% now
      }

      // if there's room for more energy, go find some more
      // else find storage
      if (creep.carry.energy < 0.5 * creep.carryCapacity) {
          var target = Game.getObjectById('5c2239769ebc272ce2b1f57a');
          return actions.interact(creep, target, () => creep.withdraw(target, RESOURCE_ENERGY));

      } else {
          // check if we are walking on sidewalk/construction, and adjust as needed.
         
          var targets =  u.getTransferLocations(creep);
          var bucket = targets[creep.memory.target];
          if (bucket == undefined) {
              bucket = Game.spawns['Home'];
          }
          actions.charge(creep, bucket);
          if (actions.charge(creep, bucket) == ERR_FULL) {
                console.log('Container Full');
                rR.flipTarget(creep);
          }

      }
      
      
    },
    flipTarget: function(creep) {
        creep.memory.target = u.getNextLocation(creep.memory.target, u.getTransferLocations(creep));
    }
    
};
module.exports = rRo;