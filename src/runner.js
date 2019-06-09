var actions = require('actions');
var t = require('types');
var u = require('utils');

var rR = {
    name: "runner",
    type: "runner",
    target: () => 0,

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Game.spawns[creep.memory.city].room.controller.level > 7){
            //RCL 8 mode
            if (_.sum(creep.carry) > 0){
                if (!creep.memory.location){
                    creep.memory.location = Game.spawns[creep.memory.city].room.storage.id;
                }
                var target = Game.getObjectById(creep.memory.location)
                if (target){
                    actions.charge(creep, target)
                }
                return;
            }
            //check for flag
            let flagName = creep.memory.city + 'powerMine';
            if (Game.flags[flagName] && Game.flags[flagName].pos.roomName !== creep.pos.roomName){
                //move to flag range 5
                creep.moveTo(Game.flags[flagName], {reusePath: 50}, {range: 5})
                return;
            }
            if (Game.flags[flagName]){
                //check for resources under flag
                let resource = Game.flags[flagName].room.lookForAt(LOOK_RESOURCES, Game.flags[flagName].pos);
                if (resource.length){
                    //pickup resource
                    if (creep.pickup(resource[0]) == ERR_NOT_IN_RANGE){
                        creep.moveTo(Game.flags[flagName], {reusePath: 5})
                    }

                    return;
                }
                //move to flag
                if (!creep.pos.inRangeTo(Game.flags[flagName].pos, 5)){
                    creep.moveTo(Game.flags[flagName].pos, {reusePath: 50}, {range: 5})
                }
                // every 50 ticks check for powerbank
                if (Game.time % 50 == 0){
                    let powerBank = Game.flags[flagName].room.lookForAt(LOOK_STRUCTURES, Game.flags[flagName].pos);
                    // if no powerbank, remove flag
                    if (!powerBank.length){
                        Game.flags[flagName].remove()
                    }
                }
                return;
            }
            if (Game.time % 50 == 0){
                Game.spawns[creep.memory.city].memory.runner = 0;
                creep.suicide();
            }
            
        }
       // notice if there's stuff next to you before wandering off!  
      if (Game.time % 2) {
        actions.notice(creep); // cost: 15% when running, so 7% now
      }

      // if there's room for more energy, go find some more
      // else find storage
      if (creep.carry.energy < 0.5 * creep.carryCapacity) {
          actions.pickup(creep);
      } else {
          // check if we are walking on sidewalk/construction, and adjust as needed.
          var myPos = creep.pos;
          if (!myPos.lookFor(LOOK_STRUCTURES).length && !myPos.lookFor(LOOK_CONSTRUCTION_SITES).length) {
              // temp
              if(creep.memory.new) {
                  //console.log("new road");
                 // myPos.createConstructionSite(STRUCTURE_ROAD); // let's build more road
              }
          }
          if (creep.memory.location){
              var target = Game.getObjectById(creep.memory.location)
              if (target){
                  if (actions.charge(creep, target) == ERR_FULL) {
                        console.log('Container Full');
                        var locations = u.getTransferLocations(creep)
                        var nextLocation = u.getNextLocation(creep.memory.target, locations);
                        if (locations[nextLocation] == undefined){
                            creep.memory.location = Game.spawns[creep.memory.city].id
                        } else {
                            creep.memory.target = nextLocation;
                            creep.memory.location = locations[nextLocation].id
                        }
                  }
              }
          } else {
              var targets =  u.getTransferLocations(creep);
              var bucket = targets[creep.memory.target];
              if (bucket == undefined) {
                  var city = creep.memory.city;
                  bucket = Game.spawns[city];
              }
              creep.memory.location = bucket.id;
              if (actions.charge(creep, bucket) == ERR_FULL) {
                    console.log('Container Full');
                    rR.flipTarget(creep);
              }
          }
      }
    },
    flipTarget: function(creep) {
        creep.memory.target = u.getNextLocation(creep.memory.target, u.getTransferLocations(creep));
    }
    
};
module.exports = rR;